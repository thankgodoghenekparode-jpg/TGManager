import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CBT_CATEGORIES, CBT_IMPORT_TEMPLATE } from './cbt.constants';
import { seedCbtDefaults } from './cbt-defaults';
import {
  parseQuestionCsv,
  resolveCorrectIndex,
  type CbtImportRow,
} from './cbt-import';
import type {
  CreateQuestionDto,
  ImportQuestionsDto,
  QueryQuestionsDto,
  UpdateQuestionDto,
} from './dto/cbt.dto';
import type { QuestionOptionInput } from './dto/cbt.dto';

/** Prisma/Cuid-compatible id (`c` + hex) so bulk imports can use createMany. */
const generatedId = () => `c${randomBytes(16).toString('hex')}`;

const questionInclude = {
  subject: { select: { id: true, code: true, name: true } },
  topic: { select: { id: true, name: true } },
  options: {
    orderBy: { order: 'asc' as const },
    select: { id: true, label: true, text: true, isCorrect: true, order: true },
  },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { attemptAnswers: true } },
} as const;

@Injectable()
export class CbtQuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fills in any missing default category banks (WAEC, NECO, JAMB and Mock
   * Examination) for this school. Categories that already have questions are
   * left untouched, so this is safe to run at any time.
   */
  async seedDefaults(tenantId: string, userId: string | null) {
    return seedCbtDefaults(this.prisma, tenantId, { createdByUserId: userId });
  }

  async list(tenantId: string, query: QueryQuestionsDto) {
    const where: Prisma.CbtQuestionWhereInput = {
      tenantId,
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.difficulty ? { difficulty: query.difficulty } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.status
        ? { status: query.status }
        : { status: { not: 'ARCHIVED' } }),
      ...(query.search
        ? { text: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.cbtQuestion.findMany({
        where,
        include: questionInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.cbtQuestion.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  /** Counts for the question bank dashboard (scoped to this tenant only). */
  async summary(tenantId: string) {
    const [byStatus, byDifficulty, subjects] = await Promise.all([
      this.prisma.cbtQuestion.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.cbtQuestion.groupBy({
        by: ['difficulty'],
        where: { tenantId, status: 'ACTIVE' },
        _count: { _all: true },
      }),
      this.prisma.subject.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const statusMap = Object.fromEntries(
      byStatus.map((row) => [row.status, row._count._all]),
    );
    const difficultyMap = Object.fromEntries(
      byDifficulty.map((row) => [row.difficulty, row._count._all]),
    );

    return {
      total: byStatus.reduce((sum, row) => sum + row._count._all, 0),
      active: statusMap.ACTIVE ?? 0,
      draft: statusMap.DRAFT ?? 0,
      archived: statusMap.ARCHIVED ?? 0,
      byDifficulty: {
        EASY: difficultyMap.EASY ?? 0,
        MEDIUM: difficultyMap.MEDIUM ?? 0,
        HARD: difficultyMap.HARD ?? 0,
      },
      subjects,
    };
  }

  async get(tenantId: string, id: string) {
    const question = await this.prisma.cbtQuestion.findFirst({
      where: { id, tenantId },
      include: questionInclude,
    });
    if (!question) throw new NotFoundException('Question not found');
    return question;
  }

  async create(tenantId: string, userId: string, dto: CreateQuestionDto) {
    await this.assertSubject(tenantId, dto.subjectId);
    const topicId = await this.resolveTopicId(
      tenantId,
      dto.subjectId,
      dto.topicId,
      dto.topicName,
    );
    const options = normalizeOptions(dto.options);

    return this.prisma.cbtQuestion.create({
      data: {
        tenantId,
        subjectId: dto.subjectId,
        topicId,
        topicName: dto.topicName ?? null,
        category: dto.category,
        difficulty: dto.difficulty,
        text: dto.text,
        imageUrl: dto.imageUrl ?? null,
        explanation: dto.explanation ?? null,
        marks: dto.marks,
        source: dto.source,
        status: dto.status,
        createdByUserId: userId,
        options: {
          create: options.map((option, index) => ({
            label: option.label,
            text: option.text,
            isCorrect: option.isCorrect,
            order: index,
          })),
        },
      },
      include: questionInclude,
    });
  }

  async update(tenantId: string, id: string, dto: UpdateQuestionDto) {
    const existing = await this.prisma.cbtQuestion.findFirst({
      where: { id, tenantId },
      include: {
        options: { orderBy: { order: 'asc' } },
        _count: { select: { attemptAnswers: true } },
      },
    });
    if (!existing) throw new NotFoundException('Question not found');
    if (dto.subjectId) await this.assertSubject(tenantId, dto.subjectId);

    const usedInAttempts = existing._count.attemptAnswers > 0;

    let options: NormalizedOption[] | undefined;
    if (dto.options) {
      if (dto.options.length !== existing.options.length && usedInAttempts) {
        throw new BadRequestException(
          'This question already has recorded answers, so options cannot be added or removed. Edit the wording only — otherwise archive it and create a new question.',
        );
      }
      options = normalizeOptions(dto.options);
    }

    const topicId =
      dto.topicName !== undefined && dto.topicName !== null
        ? await this.resolveTopicId(
            tenantId,
            dto.subjectId ?? existing.subjectId,
            null,
            dto.topicName,
          )
        : dto.topicId !== undefined
          ? dto.topicId
          : existing.topicId;

    const data: Prisma.CbtQuestionUpdateInput = {
      ...(dto.subjectId ? { subject: { connect: { id: dto.subjectId } } } : {}),
      ...(dto.topicName !== undefined && dto.topicName !== null
        ? { topic: topicId ? { connect: { id: topicId } } : { disconnect: true } }
        : dto.topicId !== undefined
          ? {
              topic:
                dto.topicId === null
                  ? { disconnect: true }
                  : { connect: { id: dto.topicId } },
            }
          : {}),
      ...(dto.topicName !== undefined ? { topicName: dto.topicName } : {}),
      ...(dto.category ? { category: dto.category } : {}),
      ...(dto.difficulty ? { difficulty: dto.difficulty } : {}),
      ...(dto.text !== undefined ? { text: dto.text } : {}),
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      ...(dto.explanation !== undefined ? { explanation: dto.explanation } : {}),
      ...(dto.marks !== undefined ? { marks: dto.marks } : {}),
      ...(dto.source ? { source: dto.source } : {}),
      ...(dto.status ? { status: dto.status } : {}),
    };

    // Same option count → update in place so recorded answers keep their meaning.
    if (options && options.length === existing.options.length) {
      Object.assign(data, {
        options: {
          update: existing.options.map((option, index) => ({
            where: { id: option.id },
            data: {
              label: options![index].label ?? option.label,
              text: options![index].text,
              isCorrect: options![index].isCorrect,
              order: index,
            },
          })),
        },
      });
    } else if (options) {
      Object.assign(data, {
        options: {
          deleteMany: {},
          create: options.map((option, index) => ({
            label: option.label,
            text: option.text,
            isCorrect: option.isCorrect,
            order: index,
          })),
        },
      });
    }

    return this.prisma.cbtQuestion.update({
      where: { id: existing.id },
      data,
      include: questionInclude,
    });
  }

  /**
   * Questions are archived rather than hard-deleted: submitted attempts must
   * keep pointing at the questions the student actually answered.
   */
  async archive(tenantId: string, id: string) {
    const existing = await this.prisma.cbtQuestion.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException('Question not found');

    const archived = await this.prisma.cbtQuestion.update({
      where: { id: existing.id },
      data: { status: 'ARCHIVED' },
      include: questionInclude,
    });
    return { success: true, status: archived.status };
  }

  async restore(tenantId: string, id: string) {
    const existing = await this.prisma.cbtQuestion.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Question not found');

    await this.prisma.cbtQuestion.update({
      where: { id: existing.id },
      data: { status: 'ACTIVE' },
    });
    return { success: true, status: 'ACTIVE' };
  }

  /** Downloadable CSV template describing the accepted import format. */
  template() {    return {
      template: CBT_IMPORT_TEMPLATE,
      columns: [
        'subject',
        'category',
        'topic',
        'difficulty',
        'question',
        'optionA',
        'optionB',
        'optionC',
        'optionD',
        'correct',
        'explanation',
        'marks',
        'source',
      ],
      notes: [
        'Subject must match a subject code or name already configured in this school.',
        'Correct may be a letter (A–D) or the exact text of the right option.',
        `category: ${CBT_CATEGORIES.join(', ')}`,
        'difficulty: EASY, MEDIUM, HARD',
        'source: SCHOOL, TGMANAGER, LICENSED, AI',
        'AI-generated items must be labelled as practice questions, never as past questions.',
      ],
    };
  }

  /**
   * Validates a CSV and (unless `dryRun`) writes the valid rows.
   * All parsing and rule checks happen on the server — the client is never
   * trusted to decide which questions are acceptable.
   */
  async importCsv(tenantId: string, userId: string, dto: ImportQuestionsDto) {
    const parsed = parseQuestionCsv(dto.csv);
    const errors = [...parsed.errors];

    const subjects = await this.prisma.subject.findMany({
      where: { tenantId },
      select: { id: true, code: true, name: true },
    });
    const subjectByKey = new Map<string, string>();
    for (const subject of subjects) {
      if (subject.code) subjectByKey.set(subject.code.toLowerCase(), subject.id);
      subjectByKey.set(subject.name.toLowerCase(), subject.id);
    }
    const knownSubjectNames = subjects
      .map((subject) => subject.code || subject.name)
      .slice(0, 12)
      .join(', ');

    const accepted: {
      row: CbtImportRow;
      subjectId: string;
      subjectLabel: string;
      correctIndex: number;
    }[] = [];

    for (const row of parsed.rows) {
      const subjectId = subjectByKey.get(row.subject.trim().toLowerCase());
      if (!subjectId) {
        errors.push({
          line: row.line,
          column: 'subject',
          message: `Unknown subject "${row.subject}". Known subjects: ${knownSubjectNames || 'none configured yet'}`,
        });
        continue;
      }
      const correctIndex = resolveCorrectIndex(row);
      if (correctIndex < 0) {
        errors.push({
          line: row.line,
          column: 'correct',
          message: 'Correct answer could not be matched to an option',
        });
        continue;
      }
      const subject = subjects.find((item) => item.id === subjectId);
      accepted.push({
        row,
        subjectId,
        subjectLabel: subject ? subject.code || subject.name : row.subject,
        correctIndex,
      });
    }

    if (dto.dryRun) {
      return {
        dryRun: true,
        created: 0,
        errors,
        preview: accepted.map((entry) => ({
          line: entry.row.line,
          subject: entry.subjectLabel,
          category: entry.row.category,
          difficulty: entry.row.difficulty,
          question: entry.row.question,
          options: entry.row.options.filter((text) => text.length > 0),
          correctIndex: entry.correctIndex,
          source: entry.row.source,
        })),
      };
    }

    if (accepted.length === 0) {
      return { dryRun: false, created: 0, errors };
    }

    // Topics first (existing ones are reused, new ones inserted in bulk).
    const topicNames = [
      ...new Set(
        accepted
          .map((entry) => entry.row.topic.trim())
          .filter((name) => name.length > 0),
      ),
    ];
    const topicIdByKey = new Map<string, string>();
    if (topicNames.length > 0) {
      const existingTopics = await this.prisma.cbtTopic.findMany({
        where: { tenantId, name: { in: topicNames } },
        select: { id: true, name: true },
      });
      for (const topic of existingTopics) topicIdByKey.set(topic.name, topic.id);

      const missing = topicNames.filter((name) => !topicIdByKey.has(name));
      if (missing.length > 0) {
        const newTopics = missing.map((name) => ({
          id: generatedId(),
          tenantId,
          name,
        }));
        await this.prisma.cbtTopic.createMany({ data: newTopics });
        for (const topic of newTopics) topicIdByKey.set(topic.name, topic.id);
      }
    }

    const questionRows: {
      questionId: string;
      question: Prisma.CbtQuestionCreateManyInput;
      optionTexts: string[];
      correctIndex: number;
    }[] = accepted.map((entry) => {
      const questionId = generatedId();
      const topicId = entry.row.topic
        ? topicIdByKey.get(entry.row.topic.trim())
        : undefined;
      const question: Prisma.CbtQuestionCreateManyInput = {
        id: questionId,
        tenantId,
        subjectId: entry.subjectId,
        topicName: entry.row.topic.trim() || null,
        category: entry.row.category
          .toUpperCase() as Prisma.CbtQuestionCreateManyInput['category'],
        difficulty: entry.row.difficulty
          .toUpperCase() as Prisma.CbtQuestionCreateManyInput['difficulty'],
        text: entry.row.question,
        explanation: entry.row.explanation || null,
        marks: Number(entry.row.marks),
        source: entry.row.source
          .toUpperCase() as Prisma.CbtQuestionCreateManyInput['source'],
        status: 'ACTIVE',
        createdByUserId: userId,
        ...(topicId ? { topicId } : {}),
      };
      return {
        questionId,
        question,
        optionTexts: entry.row.options,
        correctIndex: entry.correctIndex,
      };
    });

    await this.prisma.$transaction([
      this.prisma.cbtQuestion.createMany({
        data: questionRows.map((entry) => entry.question),
        skipDuplicates: true,
      }),
      this.prisma.cbtQuestionOption.createMany({
        data: questionRows.flatMap((entry) =>
          entry.optionTexts
            .map((text, index) => ({ text, index }))
            .filter((option) => option.text.length > 0)
            .map((option) => ({
              id: generatedId(),
              questionId: entry.questionId,
              label: String.fromCharCode(65 + option.index),
              text: option.text,
              isCorrect: option.index === entry.correctIndex,
              order: option.index,
            })),
        ),
      }),
    ]);

    return {
      dryRun: false,
      created: questionRows.length,
      errors,
      preview: [],
    };
  }

  /** Confirms a subject belongs to this tenant before it is referenced. */
  private async assertSubject(tenantId: string, subjectId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, tenantId },
      select: { id: true },
    });
    if (!subject) throw new BadRequestException('Subject not found for this school');
  }

  private async resolveTopicId(
    tenantId: string,
    subjectId: string,
    topicId: string | null | undefined,
    topicName: string | null | undefined,
  ): Promise<string | null> {
    if (topicId) {
      const topic = await this.prisma.cbtTopic.findFirst({
        where: { id: topicId, tenantId },
        select: { id: true },
      });
      if (!topic) throw new BadRequestException('Topic not found for this school');
      return topic.id;
    }

    const name = topicName?.trim();
    if (!name) return null;

    const existing = await this.prisma.cbtTopic.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' as const } },
      select: { id: true },
    });
    if (existing) return existing.id;

    try {
      const created = await this.prisma.cbtTopic.create({
        data: { tenantId, subjectId, name },
        select: { id: true },
      });
      return created.id;
    } catch {
      const again = await this.prisma.cbtTopic.findFirst({
        where: { tenantId, name },
        select: { id: true },
      });
      if (again) return again.id;
      throw new BadRequestException('Could not save the topic');
    }
  }
}

/** Option shape after defaulting: every field is concrete. */
export interface NormalizedOption {
  label: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

/** Fills in default labels (A, B, C…) and ordering for option input. */
function normalizeOptions(options: QuestionOptionInput[]): NormalizedOption[] {
  return options.map((option, index) => ({
    label: option.label ?? String.fromCharCode(65 + index),
    text: option.text,
    isCorrect: option.isCorrect,
    order: index,
  }));
}
