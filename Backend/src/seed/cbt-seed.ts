import { PrismaClient } from '../generated/prisma/client';
import type { CbtCategory, CbtDifficulty } from '../generated/prisma/enums';
import { DEMO_SCHOOL_SLUG } from './school-results-seed';

interface SeedOption {
  text: string;
  isCorrect: boolean;
}

interface SeedQuestion {
  /** Subject name as configured on the demo school (falls back if missing). */
  subject: string;
  topic: string;
  category: CbtCategory;
  difficulty: CbtDifficulty;
  text: string;
  options: string[];
  /** Index of the correct option inside `options`. */
  correct: number;
  explanation: string;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

/**
 * A small, clearly-labelled practice bank. These are illustrative questions
 * written for the demo school — they are NOT official JAMB/WAEC/NECO past
 * questions and are tagged `TGMANAGER` to make that explicit.
 */
const QUESTIONS: SeedQuestion[] = [
  {
    subject: 'Mathematics',
    topic: 'Algebra',
    category: 'JAMB',
    difficulty: 'EASY',
    text: 'Solve for x: 2x + 5 = 17.',
    options: ['4', '6', '11', '22'],
    correct: 1,
    explanation: 'Subtract 5 from both sides (2x = 12), then divide by 2 to get x = 6.',
  },
  {
    subject: 'Mathematics',
    topic: 'Algebra',
    category: 'JAMB',
    difficulty: 'MEDIUM',
    text: 'If 3(x − 2) = 9, what is the value of x?',
    options: ['3', '5', '7', '9'],
    correct: 1,
    explanation: 'Divide both sides by 3 (x − 2 = 3), then add 2 to get x = 5.',
  },
  {
    subject: 'Mathematics',
    topic: 'Number and Numeration',
    category: 'JAMB',
    difficulty: 'EASY',
    text: 'What is the least common multiple (LCM) of 4 and 6?',
    options: ['10', '12', '18', '24'],
    correct: 1,
    explanation: 'Multiples of 4: 4, 8, 12, … and of 6: 6, 12, … so the LCM is 12.',
  },
  {
    subject: 'Mathematics',
    topic: 'Geometry',
    category: 'JAMB',
    difficulty: 'MEDIUM',
    text: 'The angles of a triangle are in the ratio 1 : 2 : 3. What is the largest angle?',
    options: ['30°', '60°', '90°', '120°'],
    correct: 2,
    explanation: 'The ratios sum to 6 parts over 180°, so one part is 30° and the largest is 3 × 30° = 90°.',
  },
  {
    subject: 'Mathematics',
    topic: 'Number and Numeration',
    category: 'JAMB',
    difficulty: 'HARD',
    text: 'Express 0.45 as a fraction in its lowest terms.',
    options: ['45/100', '9/20', '4/5', '5/9'],
    correct: 1,
    explanation: '0.45 = 45/100; dividing the numerator and denominator by 5 gives 9/20.',
  },
  {
    subject: 'English Language',
    topic: 'Grammar',
    category: 'WAEC',
    difficulty: 'EASY',
    text: 'Choose the option that best completes the sentence: She has been living here ____ 2015.',
    options: ['for', 'since', 'from', 'during'],
    correct: 1,
    explanation: '“Since” is used with a specific point in time for actions that continue to the present.',
  },
  {
    subject: 'English Language',
    topic: 'Grammar',
    category: 'WAEC',
    difficulty: 'MEDIUM',
    text: 'Identify the synonym of the underlined word: The manager’s decision was <b>prudent</b>.',
    options: ['reckless', 'wise', 'hasty', 'unclear'],
    correct: 1,
    explanation: '“Prudent” means showing careful, sensible judgement — closest in meaning to “wise”.',
  },
  {
    subject: 'English Language',
    topic: 'Comprehension',
    category: 'WAEC',
    difficulty: 'EASY',
    text: 'Which of these sentences is punctuated correctly?',
    options: [
      'Where are you going?',
      'Where are you going.',
      'where are you going?',
      'Where, are you going?',
    ],
    correct: 0,
    explanation: 'A direct question begins with a capital letter and ends with a question mark.',
  },
  {
    subject: 'English Language',
    topic: 'Grammar',
    category: 'WAEC',
    difficulty: 'MEDIUM',
    text: 'Choose the correct plural form of “criterion”.',
    options: ['criterions', 'criteria', 'criterias', 'criterion'],
    correct: 1,
    explanation: '“Criterion” is a Greek loanword; its plural is “criteria”.',
  },
  {
    subject: 'English Language',
    topic: 'Comprehension',
    category: 'WAEC',
    difficulty: 'HARD',
    text: 'Select the option that is opposite in meaning to “frugal”.',
    options: ['thrifty', 'wasteful', 'careful', 'modest'],
    correct: 1,
    explanation: '“Frugal” means economical; its opposite is “wasteful”.',
  },
  {
    subject: 'Basic Science',
    topic: 'Living Things',
    category: 'MOCK',
    difficulty: 'EASY',
    text: 'Which of the following is NOT a characteristic of living things?',
    options: ['Respiration', 'Reproduction', 'Rusting', 'Growth'],
    correct: 2,
    explanation: 'Rusting is a chemical change in metals, not a characteristic of living things.',
  },
  {
    subject: 'Basic Science',
    topic: 'Living Things',
    category: 'MOCK',
    difficulty: 'MEDIUM',
    text: 'The process by which green plants make their own food is called ____.',
    options: ['respiration', 'photosynthesis', 'transpiration', 'digestion'],
    correct: 1,
    explanation: 'Photosynthesis uses sunlight, water and carbon dioxide to make glucose in plants.',
  },
  {
    subject: 'Basic Science',
    topic: 'Matter',
    category: 'MOCK',
    difficulty: 'EASY',
    text: 'Which state of matter has a definite volume but no definite shape?',
    options: ['Solid', 'Liquid', 'Gas', 'Plasma'],
    correct: 1,
    explanation: 'A liquid keeps a definite volume but takes the shape of its container.',
  },
  {
    subject: 'Basic Science',
    topic: 'Matter',
    category: 'MOCK',
    difficulty: 'MEDIUM',
    text: 'What is the chemical symbol for water?',
    options: ['HO', 'H₂O', 'O₂', 'CO₂'],
    correct: 1,
    explanation: 'A water molecule contains two hydrogen atoms and one oxygen atom: H₂O.',
  },
  {
    subject: 'Basic Science',
    topic: 'Energy',
    category: 'MOCK',
    difficulty: 'HARD',
    text: 'Which of the following is a renewable source of energy?',
    options: ['Coal', 'Crude oil', 'Solar', 'Natural gas'],
    correct: 2,
    explanation: 'Solar energy is naturally replenished, unlike fossil fuels such as coal and oil.',
  },
];

export interface SeedCbtResult {
  topics: number;
  questions: number;
  exams: number;
}

/**
 * Seeds the demo school with a small, labelled CBT practice bank and three
 * published examinations (a JAMB practice, a WAEC practice and a class-targeted
 * mock).
 *
 * Idempotent: if the demo school already has any CBT question the seed does
 * nothing, so hand-authored content is never duplicated or clobbered.
 */
export async function seedCbt(prisma: PrismaClient): Promise<SeedCbtResult> {
  const summary: SeedCbtResult = { topics: 0, questions: 0, exams: 0 };

  const tenant = await prisma.tenant.findUnique({
    where: { slug: DEMO_SCHOOL_SLUG },
    select: { id: true },
  });
  if (!tenant) {
    console.log(`   CBT seed skipped: demo school (${DEMO_SCHOOL_SLUG}) not found.`);
    return summary;
  }

  const existing = await prisma.cbtQuestion.count({ where: { tenantId: tenant.id } });
  if (existing > 0) {
    console.log(`   CBT seed skipped: ${existing} question(s) already present.`);
    return summary;
  }

  const [subjects, classes, author] = await Promise.all([
    prisma.subject.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true },
    }),
    prisma.classRoom.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.schoolStaff.findFirst({
      where: { tenantId: tenant.id, email: 'teacher.math@tgeasymodel.edu.ng' },
      select: { userId: true },
    }),
  ]);

  if (subjects.length === 0) {
    console.log('   CBT seed skipped: the demo school has no subjects.');
    return summary;
  }

  const subjectByName = new Map(subjects.map((subject) => [subject.name, subject.id]));
  const fallbackSubjectId = subjects[0].id;
  const resolveSubject = (name: string): string =>
    subjectByName.get(name) ?? fallbackSubjectId;

  // Topics first (unique per tenant + name so they can be reused).
  const topicIds = new Map<string, string>();
  for (const name of [...new Set(QUESTIONS.map((item) => item.topic))]) {
    const topic = await prisma.cbtTopic.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: {},
      create: { tenantId: tenant.id, name },
      select: { id: true },
    });
    topicIds.set(name, topic.id);
    summary.topics += 1;
  }

  const questionIds: string[] = [];
  for (const item of QUESTIONS) {
    const question = await prisma.cbtQuestion.create({
      data: {
        tenantId: tenant.id,
        subjectId: resolveSubject(item.subject),
        topicId: topicIds.get(item.topic) ?? null,
        topicName: item.topic,
        category: item.category,
        difficulty: item.difficulty,
        text: item.text,
        explanation: item.explanation,
        marks: 1,
        source: 'TGMANAGER',
        status: 'ACTIVE',
        createdByUserId: author?.userId ?? null,
        options: {
          create: item.options.map((text, index) => ({
            label: OPTION_LABELS[index] ?? String(index + 1),
            text,
            isCorrect: index === item.correct,
            order: index,
          })),
        },
      },
      select: { id: true },
    });
    questionIds.push(question.id);
    summary.questions += 1;
  }

  /** Collect the seeded question ids whose topic matches a predicate. */
  const idsWhere = (predicate: (item: SeedQuestion) => boolean): string[] =>
    QUESTIONS.map((item, index) => ({ item, id: questionIds[index] }))
      .filter(({ item }) => predicate(item))
      .map(({ id }) => id);

  const firstClassId = classes[0]?.id ?? null;

  const exams: Array<{
    title: string;
    category: CbtCategory;
    mode: 'PRACTICE' | 'MOCK';
    subjectName: string;
    classId: string | null;
    durationMinutes: number;
    passMark: number;
    showCorrectAnswers: boolean;
    description: string;
    instructions: string;
    questionIds: string[];
  }> = [
    {
      title: 'JAMB Practice — Mathematics',
      category: 'JAMB',
      mode: 'PRACTICE',
      subjectName: 'Mathematics',
      classId: null,
      durationMinutes: 10,
      passMark: 60,
      showCorrectAnswers: true,
      description: 'Warm-up practice questions covering algebra, geometry and number work.',
      instructions:
        'This is a practice set. Answers and explanations are shown as soon as you submit.',
      questionIds: idsWhere((item) => item.subject === 'Mathematics'),
    },
    {
      title: 'WAEC Practice — English Language',
      category: 'WAEC',
      mode: 'PRACTICE',
      subjectName: 'English Language',
      classId: null,
      durationMinutes: 10,
      passMark: 50,
      showCorrectAnswers: true,
      description: 'Practice comprehension and grammar questions.',
      instructions: 'Practice mode: feedback and explanations follow your submission.',
      questionIds: idsWhere((item) => item.subject === 'English Language'),
    },
    {
      title: 'Mock Examination — Basic Science',
      category: 'MOCK',
      mode: 'MOCK',
      subjectName: 'Basic Science',
      classId: firstClassId,
      durationMinutes: 15,
      passMark: 50,
      showCorrectAnswers: false,
      description:
        'A timed mock examination. Correct answers are withheld until the school releases them.',
      instructions:
        'Answer every question. The examination submits automatically when the timer reaches zero.',
      questionIds: idsWhere((item) => item.subject === 'Basic Science'),
    },
  ];

  for (const exam of exams) {
    const questionIdsForExam = exam.questionIds;
    if (questionIdsForExam.length === 0) continue;

    const created = await prisma.cbtExam.create({
      data: {
        tenantId: tenant.id,
        title: exam.title,
        category: exam.category,
        mode: exam.mode,
        subjectId: resolveSubject(exam.subjectName),
        classId: exam.classId,
        description: exam.description,
        instructions: exam.instructions,
        durationMinutes: exam.durationMinutes,
        totalMarks: questionIdsForExam.length,
        passMark: exam.passMark,
        randomizeQuestions: true,
        randomizeOptions: false,
        maxAttempts: exam.mode === 'PRACTICE' ? 3 : 1,
        showResultImmediately: true,
        showCorrectAnswers: exam.showCorrectAnswers,
        status: 'PUBLISHED',
        createdByUserId: author?.userId ?? null,
        questions: {
          create: questionIdsForExam.map((questionId, index) => ({
            questionId,
            order: index,
            marks: 1,
          })),
        },
      },
      select: { id: true },
    });

    if (exam.classId) {
      await prisma.cbtExamAssignment.create({
        data: { tenantId: tenant.id, examId: created.id, classId: exam.classId },
      });
    }

    summary.exams += 1;
  }

  return summary;
}
