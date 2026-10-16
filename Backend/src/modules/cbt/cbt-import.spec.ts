import { parseQuestionCsv, parseCsvRows, resolveCorrectIndex } from './cbt-import';

const header =
  'subject,category,topic,difficulty,question,optionA,optionB,optionC,optionD,correct,explanation,marks,source';

describe('parseCsvRows', () => {
  it('handles quoted fields, escaped quotes and embedded newlines', () => {
    const rows = parseCsvRows('a,"b,still b","say ""hi""","line1\nline2"\r\nc,d,e,f');
    expect(rows[0]).toEqual(['a', 'b,still b', 'say "hi"', 'line1\nline2']);
    expect(rows[1]).toEqual(['c', 'd', 'e', 'f']);
  });
});

describe('parseQuestionCsv', () => {
  it('accepts a well-formed row using a letter for the correct answer', () => {
    const csv = `${header}\nMATH,MOCK,Algebra,EASY,What is 2 + 2?,3,4,5,6,B,Two plus two,1,SCHOOL`;
    const parsed = parseQuestionCsv(csv);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      subject: 'MATH',
      category: 'MOCK',
      difficulty: 'EASY',
      correct: 'B',
      marks: '1',
    });
    expect(resolveCorrectIndex(parsed.rows[0])).toBe(1);
  });

  it('accepts the exact option text as the correct answer', () => {
    const csv = `${header}\nMATH,MOCK,Algebra,EASY,What is 2 + 2?,3,4,5,6,4,,1,SCHOOL`;
    const parsed = parseQuestionCsv(csv);
    expect(parsed.errors).toHaveLength(0);
    expect(resolveCorrectIndex(parsed.rows[0])).toBe(1);
  });

  it('reports a missing required column', () => {
    const csv = 'subject,question,correct\nMATH,2+2?,B';
    const parsed = parseQuestionCsv(csv);
    expect(parsed.errors.some((issue) => issue.column === 'optionA')).toBe(true);
  });

  it('flags unknown category, difficulty and source', () => {
    const csv = `${header}\nMATH,NOPE,Algebra,EXTREME,Question text?,3,4,5,6,B,,1,ROBOT`;
    const parsed = parseQuestionCsv(csv);
    const columns = parsed.errors.map((issue) => issue.column);
    expect(columns).toContain('category');
    expect(columns).toContain('difficulty');
    expect(columns).toContain('source');
    expect(parsed.rows).toHaveLength(0);
  });

  it('rejects a correct answer that is not one of the options', () => {
    const csv = `${header}\nMATH,MOCK,Algebra,EASY,Question text?,3,4,5,6,Z,,1,SCHOOL`;
    const parsed = parseQuestionCsv(csv);
    expect(parsed.errors.some((issue) => issue.column === 'correct')).toBe(true);
  });

  it('rejects a correct answer pointing at an empty option', () => {
    const csv = `${header}\nMATH,MOCK,Algebra,EASY,Question text?,3,4,,,C,,1,SCHOOL`;
    const parsed = parseQuestionCsv(csv);
    expect(parsed.errors.some((issue) => issue.column === 'correct')).toBe(true);
  });

  it('rejects a bad marks value', () => {
    const csv = `${header}\nMATH,MOCK,Algebra,EASY,Question text?,3,4,5,6,B,,abc,SCHOOL`;
    const parsed = parseQuestionCsv(csv);
    expect(parsed.errors.some((issue) => issue.column === 'marks')).toBe(true);
  });

  it('skips completely blank rows without failing', () => {
    const csv = `${header}\nMATH,MOCK,Algebra,EASY,What is two plus two?,3,4,5,6,B,,1,SCHOOL\n,,,,,,,,,,,,\n`;
    const parsed = parseQuestionCsv(csv);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.rows).toHaveLength(1);
  });

  it('reports when no valid rows were found', () => {
    const csv = `${header}\n`;
    const parsed = parseQuestionCsv(csv);
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.errors.some((issue) => issue.line === 1)).toBe(true);
  });
});
