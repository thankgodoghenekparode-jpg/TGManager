/**
 * Backend scoring for CBT attempts.
 *
 * Kept as pure functions so it can be unit-tested without a database and so the
 * frontend never participates in score calculation — the client only renders
 * what the server returns.
 */

export interface ScoringQuestion {
  questionId: string;
  /** Marks awarded for a correct answer on this question (exam weight). */
  marks: number;
  /** Ids of options accepted as correct (normally exactly one). */
  correctOptionIds: string[];
}

export interface ScoringSelection {
  questionId: string;
  selectedOptionId: string | null;
}

export interface ScoringConfig {
  negativeMarking: boolean;
  negativeMarkPerWrong: number;
  passMark: number;
}

export interface QuestionScore {
  questionId: string;
  selectedOptionId: string | null;
  answered: boolean;
  isCorrect: boolean;
  marksAwarded: number;
}

export interface ScoringResult {
  score: number;
  totalMarks: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  passed: boolean;
  questions: QuestionScore[];
}

/** Rounds to 2 decimal places to keep stored scores free of float noise. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Scores a submitted attempt.
 *
 * - unanswered questions score 0 and count as unanswered;
 * - wrong answers score 0, or `-negativeMarkPerWrong` when enabled;
 * - the final score is clamped to `[0, totalMarks]` (negative marking never
 *   produces a negative result);
 * - `passed` compares the percentage against the exam's pass mark.
 */
export function scoreAttempt(
  questions: ScoringQuestion[],
  selections: ScoringSelection[],
  config: ScoringConfig,
): ScoringResult {
  const selectedById = new Map<string, string | null>(
    selections.map((selection) => [selection.questionId, selection.selectedOptionId]),
  );

  const answers: QuestionScore[] = [];
  let totalMarks = 0;
  let rawScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  for (const question of questions) {
    const marks = Number.isFinite(question.marks) ? Math.max(0, question.marks) : 0;
    const selected = selectedById.get(question.questionId) ?? null;
    totalMarks += marks;

    if (!selected) {
      unansweredCount += 1;
      answers.push({
        questionId: question.questionId,
        selectedOptionId: null,
        answered: false,
        isCorrect: false,
        marksAwarded: 0,
      });
      continue;
    }

    const isCorrect = question.correctOptionIds.includes(selected);
    let awarded = 0;

    if (isCorrect) {
      correctCount += 1;
      awarded = marks;
    } else {
      incorrectCount += 1;
      if (config.negativeMarking && config.negativeMarkPerWrong > 0) {
        awarded = -Math.abs(config.negativeMarkPerWrong);
      }
    }

    rawScore += awarded;
    answers.push({
      questionId: question.questionId,
      selectedOptionId: selected,
      answered: true,
      isCorrect,
      marksAwarded: round2(awarded),
    });
  }

  const score = round2(clamp(rawScore, 0, totalMarks));
  const percentage =
    totalMarks > 0 ? round2(clamp((score / totalMarks) * 100, 0, 100)) : 0;

  return {
    score,
    totalMarks: round2(totalMarks),
    percentage,
    correctCount,
    incorrectCount,
    unansweredCount,
    passed: totalMarks > 0 && percentage >= config.passMark,
    questions: answers,
  };
}

/**
 * Seconds spent, always clamped to `[0, duration]` so a stale client clock or
 * a late request can never report more time than the exam allows.
 */
export function computeTimeUsedSeconds(
  startedAt: Date,
  submittedAt: Date,
  durationMinutes: number,
): number {
  const elapsed = Math.max(
    0,
    Math.floor((submittedAt.getTime() - startedAt.getTime()) / 1000),
  );
  const cap = Math.max(0, Math.round(durationMinutes * 60));
  return Math.min(elapsed, cap);
}

/** Remaining whole seconds before `expiresAt` (never negative). */
export function remainingSeconds(expiresAt: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
}
