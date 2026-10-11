import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, extractCookies } from './utils/test-app';

/**
 * End-to-end coverage for the deepened school experience:
 * timetable clash detection, staff directory, results publishing and the
 * parent portal (guardian accounts scoped to their own children).
 */
describe('School experience (e2e)', () => {
  let app: INestApplication;
  let unique: string;

  let adminCookie: string;
  let tenantId: string;

  let sessionId: string;
  let termId: string;
  let classId: string;
  let subjectId: string;
  let teacherId: string;
  let studentId: string;
  let guardianId: string;
  let parentEmail: string;
  let parentPassword: string;
  let parentCookie: string;

  const adminHdr = () => ({ Cookie: adminCookie, 'x-tenant-id': tenantId });
  const parentHdr = () => ({ Cookie: parentCookie, 'x-tenant-id': tenantId });

  beforeAll(async () => {
    app = await createTestApp();
    unique = `${Date.now()}`;

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'School',
        lastName: 'Owner',
        email: `school-${unique}@test.com`,
        password: 'password123',
        organizationName: `Bright Academy ${unique}`,
        type: 'SCHOOL',
      })
      .expect(201);

    adminCookie = extractCookies(reg);
    tenantId = reg.body.tenant.id;

    const session = await request(app.getHttpServer())
      .post('/api/v1/school/sessions')
      .set(adminHdr())
      .send({ name: `2025/2026-${unique}`, isCurrent: true })
      .expect(201);
    sessionId = session.body.id;

    const term = await request(app.getHttpServer())
      .post('/api/v1/school/terms')
      .set(adminHdr())
      .send({ sessionId, name: 'First Term', isCurrent: true })
      .expect(201);
    termId = term.body.id;

    const classroom = await request(app.getHttpServer())
      .post('/api/v1/school/classes')
      .set(adminHdr())
      .send({ name: `JSS 1A ${unique}`, level: 'JSS1', capacity: 40 })
      .expect(201);
    classId = classroom.body.id;

    const subject = await request(app.getHttpServer())
      .post('/api/v1/school/subjects')
      .set(adminHdr())
      .send({ name: `Mathematics ${unique}`, code: `MTH${unique.slice(-4)}` })
      .expect(201);
    subjectId = subject.body.id;

    const teacher = await request(app.getHttpServer())
      .post('/api/v1/school/staff')
      .set(adminHdr())
      .send({
        firstName: 'Ada',
        lastName: 'Teacher',
        category: 'TEACHER',
        email: `ada-${unique}@test.com`,
      })
      .expect(201);
    teacherId = teacher.body.id;

    const student = await request(app.getHttpServer())
      .post('/api/v1/school/students')
      .set(adminHdr())
      .send({
        firstName: 'Chinedu',
        lastName: 'Eze',
        gender: 'MALE',
        currentClassId: classId,
      })
      .expect(201);
    studentId = student.body.id;

    const guardian = await request(app.getHttpServer())
      .post('/api/v1/school/guardians')
      .set(adminHdr())
      .send({
        firstName: 'Chukwudi',
        lastName: 'Eze',
        phone: '+2348031112233',
        email: `parent-${unique}@test.com`,
      })
      .expect(201);
    guardianId = guardian.body.id;

    await request(app.getHttpServer())
      .post(`/api/v1/school/students/${studentId}/guardians`)
      .set(adminHdr())
      .send({ guardianId, relationship: 'Father', isPrimary: true })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates timetable periods and rejects class clashes', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/school/timetable')
      .set(adminHdr())
      .send({
        classId,
        subjectId,
        teacherId,
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '09:00',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/school/timetable')
      .set(adminHdr())
      .send({
        classId,
        subjectId,
        dayOfWeek: 'MONDAY',
        startTime: '08:30',
        endTime: '09:30',
      })
      .expect(409);
  });

  it('lists the teacher in the school staff directory', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/school/staff?category=TEACHER')
      .set(adminHdr())
      .expect(200);

    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: teacherId, firstName: 'Ada' }),
      ]),
    );
  });

  it('records, approves and publishes results', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/school/grading/results')
      .set(adminHdr())
      .send({
        classId,
        subjectId,
        sessionId,
        termId,
        scores: [{ studentId, caScore: 34, examScore: 52 }],
      })
      .expect(201);

    const approve = await request(app.getHttpServer())
      .post('/api/v1/school/grading/approve')
      .set(adminHdr())
      .send({ classId, sessionId, termId, action: 'PUBLISH' })
      .expect(201);
    expect(approve.body).toMatchObject({ success: true, action: 'PUBLISH' });

    const sheet = await request(app.getHttpServer())
      .get(
        `/api/v1/school/grading/class-sheet?classId=${classId}&sessionId=${sessionId}&termId=${termId}`,
      )
      .set(adminHdr())
      .expect(200);
    expect(sheet.body.students[0]).toMatchObject({ studentId, position: 1 });
  });

  it('lets a guardian access only their own children', async () => {
    const invite = await request(app.getHttpServer())
      .post('/api/v1/school/parent/invite')
      .set(adminHdr())
      .send({ guardianId })
      .expect(201);

    expect(invite.body.accountCreated).toBe(true);
    parentEmail = invite.body.email;
    parentPassword = invite.body.temporaryPassword;

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: parentEmail, password: parentPassword })
      .expect(200);
    parentCookie = extractCookies(login);

    const me = await request(app.getHttpServer())
      .get('/api/v1/school/parent/me')
      .set(parentHdr())
      .expect(200);
    expect(me.body.guardian.id).toBe(guardianId);
    expect(me.body.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: studentId }),
      ]),
    );

    await request(app.getHttpServer())
      .get(`/api/v1/school/parent/children/${studentId}/results?sessionId=${sessionId}&termId=${termId}`)
      .set(parentHdr())
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/school/parent/children/${studentId}/report-card?sessionId=${sessionId}&termId=${termId}`)
      .set(parentHdr())
      .expect(200)
      .expect((res) => {
        expect(res.body.summary).toMatchObject({ position: 1, totalInClass: 1 });
      });

    // A guardian cannot read a student they are not linked to.
    await request(app.getHttpServer())
      .get('/api/v1/school/parent/children/non-owned-student/attendance')
      .set(parentHdr())
      .expect(403);
  });

  it('rejects tenant users without a linked guardian record on the parent portal', async () => {
    // Admin has broad school permissions but not SCHOOL_PARENT_VIEW.
    await request(app.getHttpServer())
      .get('/api/v1/school/parent/me')
      .set(adminHdr())
      .expect(403);
  });
});
