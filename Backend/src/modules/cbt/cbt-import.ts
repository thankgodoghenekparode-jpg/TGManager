import {
  CBT_CATEGORIES,
  CBT_DIFFICULTIES,
  CBT_IMPORT_COLUMNS,
  CBT_OPTION_LABELS,
  CBT_SOURCES,
} from './cbt.constants';

/** A single validation problem tied to a CSV line (and optionally a column). */
export interface CbtImportIssue {
  line: number;
  column?: string;
  message: string;
}

/** Normalised content of one imported row, before subject lookup. */
export interface CbtImportRow {
  line: number;
  subject: string;
  category: string;
  topic: string;
  difficulty: string;
  question: string;
  /** Option texts in template order (optionA, optionB, …). */
  options: string[];
  /** The raw `correct` cell — a letter like `B` or the full option text. */
  correct: string;
  explanation: string;
  marks: string;
  source: string;
}

export interface CbtParsedImport {
  /** Column names read from the header row, in file order. */
  columns: string[];
  rows: CbtImportRow[];
  errors: CbtImportIssue[];
}

/**
 * Minimal RFC-4180-ish CSV reader (quotes, escaped quotes, embedded newlines,
 * CRLF). Kept dependency-free because the stack ships no CSV library.
 */
export function parseCsvRows(text: string): string[][] {
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const OPTIONAL_COLUMNS = new Set([
  'category',
  'topic',
  'difficulty',
  'explanation',
  'marks',
  'source',
]);

/**
 * Parses and validates a question-bank CSV export. Every problem is reported
 * with its line number so the import preview can show precise errors.
 */
export function parseQuestionCsv(text: string): CbtParsedImport {
  const errors: CbtImportIssue[] = [];
  const rawRows = parseCsvRows(text);

  if (rawRows.length === 0) {
    return { columns: [], rows: [], errors: [{ line: 1, message: 'The CSV file is empty' }] };
  }

  const headerCells = rawRows[0].map((cell) => cell.trim().toLowerCase());
  const columns = headerCells.filter((cell) => cell.length > 0);
  const columnIndex = new Map<string, number>();
  headerCells.forEach((cell, index) => {
    if (cell && !columnIndex.has(cell)) columnIndex.set(cell, index);
  });

  const required = ['subject', 'question', 'correct'];
  for (const col of required) {
    if (!columnIndex.has(col)) {
      errors.push({
        line: 1,
        column: col,
        message: `Missing required column "${col}". Expected: ${CBT_IMPORT_COLUMNS.join(', ')}`,
      });
    }
  }

  // Option columns may be A–H (optionA … optionH); at least optionA/optionB are needed.
  const optionColumns: { index: number; label: string }[] = [];
  for (const label of CBT_OPTION_LABELS) {
    const index = columnIndex.get(`option${label.toLowerCase()}`);
    if (index !== undefined) optionColumns.push({ index, label });
  }
  if (optionColumns.length < 2) {
    errors.push({
      line: 1,
      column: 'optionA',
      message: 'Missing option columns — provide at least optionA and optionB',
    });
  }

  if (errors.length > 0) return { columns, rows: [], errors };

  const idx = (name: string): number | undefined => columnIndex.get(name);
  const read = (cells: string[], name: string): string => {
    const index = idx(name);
    if (index === undefined) return '';
    return (cells[index] ?? '').trim();
  };

  // Warn (non-fatally) about columns we do not use, so users notice typos.
  const known = new Set<string>([...CBT_IMPORT_COLUMNS]);
  for (const col of columns) {
    if (!known.has(col) && !col.startsWith('option')) {
      errors.push({
        line: 1,
        column: col,
        message: `Unknown column "${col}" was ignored`,
      });
    }
  }

  const rows: CbtImportRow[] = [];

  for (let r = 1; r < rawRows.length; r += 1) {
    const cells = rawRows[r];
    const line = r + 1; // 1-based file line (header is line 1)
    if (cells.every((cell) => cell.trim() === '')) continue;

    const options = optionColumns.map(({ index }) => (cells[index] ?? '').trim());
    const row: CbtImportRow = {
      line,
      subject: read(cells, 'subject'),
      category: read(cells, 'category') || 'GENERAL',
      topic: read(cells, 'topic'),
      difficulty: read(cells, 'difficulty') || 'MEDIUM',
      question: read(cells, 'question'),
      options,
      correct: read(cells, 'correct'),
      explanation: read(cells, 'explanation'),
      marks: read(cells, 'marks') || '1',
      source: read(cells, 'source') || 'SCHOOL',
    };

    let rowErrors = 0;
    const fail = (column: string, message: string) => {
      errors.push({ line, column, message });
      rowErrors += 1;
    };

    if (!row.subject) fail('subject', 'Subject is required');
    if (row.question.length < 3) fail('question', 'Question text is required (min 3 characters)');

    const filledOptions = row.options.filter((text) => text.length > 0);
    if (filledOptions.length < 2) {
      fail('optionA', 'Provide at least two answer options');
    }

    const upperCategory = row.category.toUpperCase();
    if (!CBT_CATEGORIES.includes(upperCategory as never)) {
      fail(
        'category',
        `Unknown category "${row.category}" — use one of ${CBT_CATEGORIES.join(', ')}`,
      );
    }

    const upperDifficulty = row.difficulty.toUpperCase();
    if (!CBT_DIFFICULTIES.includes(upperDifficulty as never)) {
      fail(
        'difficulty',
        `Unknown difficulty "${row.difficulty}" — use one of ${CBT_DIFFICULTIES.join(', ')}`,
      );
    }

    const upperSource = row.source.toUpperCase();
    if (!CBT_SOURCES.includes(upperSource as never)) {
      fail('source', `Unknown source "${row.source}" — use one of ${CBT_SOURCES.join(', ')}`);
    }

    const marks = Number(row.marks);
    if (!Number.isFinite(marks) || marks <= 0 || marks > 100) {
      fail('marks', 'Marks must be a number greater than 0 and at most 100');
    }

    // `correct` may be a letter (A/B/C/…) or the full text of the right option.
    const letter = row.correct.toUpperCase();
    const letterIndex = CBT_OPTION_LABELS.indexOf(letter as never);
    const textMatchIndex = row.options.findIndex(
      (text) => text.length > 0 && text.toLowerCase() === row.correct.toLowerCase(),
    );
    if (!row.correct) {
      fail('correct', 'Correct answer is required');
    } else if (letterIndex >= 0 && letterIndex < row.options.length) {
      if (row.options[letterIndex].length === 0) {
        fail('correct', `Correct answer "${row.correct}" points at an empty option`);
      }
    } else if (textMatchIndex < 0) {
      fail(
        'correct',
        'Correct answer must be a letter (A, B, C, …) or exactly match one of the options',
      );
    }

    if (rowErrors === 0) rows.push(row);
  }

  if (rows.length === 0 && errors.every((issue) => issue.line !== 1)) {
    errors.push({ line: 1, message: 'No valid question rows were found in the file' });
  }

  return { columns, rows, errors };
}

/**
 * Resolves the index of the correct option for a parsed row.
 * Returns -1 when the row's `correct` cell cannot be mapped.
 */
export function resolveCorrectIndex(row: CbtImportRow): number {
  const letterIndex = CBT_OPTION_LABELS.indexOf(row.correct.toUpperCase() as never);
  if (letterIndex >= 0 && letterIndex < row.options.length) return letterIndex;
  const textMatch = row.options.findIndex(
    (text) => text.length > 0 && text.toLowerCase() === row.correct.toLowerCase(),
  );
  if (textMatch >= 0) return textMatch;
  return -1;
}
