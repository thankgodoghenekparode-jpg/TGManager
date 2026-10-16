import {
  clamp,
  computeTimeUsedSeconds,
  remainingSeconds,
  round2,
  scoreAttempt,
  type ScoringQuestion,
} from './cbt-scoring';

const questions: ScoringQuestion[] = [
  { questionId: 'q1', marks: 1, correctOptionIds: ['q1a'] },
  { questionId: 'q2', marks: 2, correctOptionIds: ['q2b'] },
  { questionId: 'q3', marks: 3, correctOptionIds: ['q3c'] },
];

const config = { negativeMarking: false, negativeMarkPerWrong: 0, passMark: 50 };

describe('cbt scoring', () => {
  it('awards marks for correct answers', () => {
    const result = scoreAttempt(
      questions,
      [
        { questionId: 'q1', selectedOptionId: 'q1a' },
        { questionId: 'q2', selectedOptionId: 'q2b' },
        { questionId: 'q3', selectedOptionId: 'q3c' },
      ],
      config,
    );

    expect(result.score).toBe(6);
    expect(result.totalMarks).toBe(6);
    expect(result.percentage).toBe(100);
    expect(result.correctCount).toBe(3);
    expect(result.incorrectCount).toBe(0);
    expect(result.unansweredCount).toBe(0);
    expect(result.passed).toBe(true);
  });

  it('separates correct, incorrect and unanswered answers', () => {
    const result = scoreAttempt(
      questions,
      [
        { questionId: 'q1', selectedOptionId: 'q1a' },
        { questionId: 'q2', selectedOptionId: 'q2a' },
        { questionId: 'q3', selectedOptionId: null },
      ],
      config,
    );

    expect(result.correctCount).toBe(1);
    expect(result.incorrectCount).toBe(1);
    expect(result.unansweredCount).toBe(1);
    expect(result.score).toBe(1);
    expect(result.totalMarks).toBe(6);
    expect(round2(result.percentage)).toBe(16.67);
    expect(result.passed).toBe(false);
  });

  it('treats a missing answer row as unanswered', () => {
    const result = scoreAttempt(questions, [], config);
    expect(result.unansweredCount).toBe(3);
    expect(result.score).toBe(0);
    expect(result.totalMarks).toBe(6);
  });

  it('applies negative marking but never drops below zero', () => {
    const result = scoreAttempt(
      questions,
      [
        { questionId: 'q1', selectedOptionId: 'q1b' },
        { questionId: 'q2', selectedOptionId: 'q2a' },
        { questionId: 'q3', selectedOptionId: 'q3a' },
      ],
      { negativeMarking: true, negativeMarkPerWrong: 1, passMark: 50 },
    );

    expect(result.incorrectCount).toBe(3);
    expect(result.score).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.passed).toBe(false);
  });

  it('accepts any option marked correct when a question has several', () => {
    const result = scoreAttempt(
      [{ questionId: 'q1', marks: 1, correctOptionIds: ['a', 'b'] }],
      [{ questionId: 'q1', selectedOptionId: 'b' }],
      config,
    );
    expect(result.correctCount).toBe(1);
    expect(result.score).toBe(1);
  });

  it('marks a pass exactly at the pass mark', () => {
    const result = scoreAttempt(
      questions,
      [
        { questionId: 'q1', selectedOptionId: 'q1a' },
        { questionId: 'q2', selectedOptionId: 'q2b' },
        { questionId: 'q3', selectedOptionId: 'q3a' },
      ],
      { negativeMarking: false, negativeMarkPerWrong: 0, passMark: 50 },
    );
    // 1 + 2 = 3 of 6 = 50%
    expect(result.percentage).toBe(50);
    expect(result.passed).toBe(true);
  });

  it('reports 0% for an exam with no marks', () => {
    const result = scoreAttempt([], [], config);
    expect(result.totalMarks).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.passed).toBe(false);
  });

  it('ignores selections for questions that are not part of the exam', () => {
    const result = scoreAttempt(
      [{ questionId: 'q1', marks: 1, correctOptionIds: ['q1a'] }],
      [
        { questionId: 'q1', selectedOptionId: 'q1a' },
        { questionId: 'ghost', selectedOptionId: 'x' },
      ],
      config,
    );
    expect(result.correctCount).toBe(1);
    expect(result.totalMarks).toBe(1);
  });
});

describe('cbt scoring helpers', () => {
  it('clamps values into range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });

  it('caps time used at the exam duration', () => {
    const started = new Date('2026-01-01T10:00:00.000Z');
    const submitted = new Date('2026-01-01T10:30:00.000Z');
    expect(computeTimeUsedSeconds(started, submitted, 10)).toBe(600);
    expect(computeTimeUsedSeconds(started, submitted, 60)).toBe(1800);
  });

  it('never reports negative time used', () => {
    const started = new Date('2026-01-01T10:00:00.000Z');
    const submitted = new Date('2026-01-01T09:00:00.000Z');
    expect(computeTimeUsedSeconds(started, submitted, 60)).toBe(0);
  });

  it('never reports negative remaining seconds', () => {
    const now = new Date('2026-01-01T10:00:00.000Z');
    expect(remainingSeconds(new Date('2026-01-01T10:05:00.000Z'), now)).toBe(300);
    expect(remainingSeconds(new Date('2026-01-01T09:00:00.000Z'), now)).toBe(0);
  });
});
