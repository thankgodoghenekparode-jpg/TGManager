import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { localTimeKey } from '../src/common/utils/time.util';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, extractCookies } from './utils/test-app';

const BRANCH_LAT = 40.7128;
const BRANCH_LNG = -74.006;

const TZ_BY_OFFSET: Record<number, string> = {
  '-11': 'Pacific/Pago_Pago',
  '-10': 'Pacific/Honolulu',
  '-9': 'America/Anchorage',
  '-8': 'America/Los_Angeles',
  '-7': 'America/Denver',
  '-6': 'America/Chicago',
  '-5': 'America/New_York',
  '-4': 'America/Manaus',
  '-3': 'America/Sao_Paulo',
  '-2': 'Atlantic/South_Georgia',
  '-1': 'Atlantic/Azores',
  0: 'UTC',
  1: 'Europe/Berlin',
  2: 'Europe/Helsinki',
  3: 'Europe/Moscow',
  4: 'Asia/Dubai',
  5: 'Asia/Karachi',
  6: 'Asia/Dhaka',
  7: 'Asia/Bangkok',
  8: 'Asia/Shanghai',
  9: 'Asia/Tokyo',
  10: 'Australia/Brisbane',
  11: 'Pacific/Noumea',
  12: 'Pacific/Auckland',
  13: 'Pacific/Apia',
};

/**
 * Picks a timezone where "now" maps to roughly local noon. That keeps all
 * now-relative schedule windows on the same local calendar day, so tests are
 * independent of the UTC time of day the suite happens to run.
 */
function testTimeZone(): string {
  const utcHour = new Date().getUTCHours();
  const offset = Math.min(13, Math.max(-11, 12 - utcHour));
  return TZ_BY_OFFSET[offset];
}

function addMinutes(date: Date, mins: number): Date {
  return new Date(date.getTime() + mins * 60_000);
}

/** Local wall-clock HH:MM of an instant in the given timezone. */
function fmtTimeIn(date: Date, timeZone: string): string {
  return localTimeKey(date, timeZone);
}

function todayWeekday(): number {
  return new Date().getUTCDay();
}

function workingDaysIncludingToday(): number[] {
  return Array.from(new Set([1, 2, 3, 4, 5, todayWeekday()]));
}

describe('Schedules & Attendance (e2e)', () => {
  let app: INestApplication;
  let unique: string;

  let adminCookie: string;
  let tenantId: string;

  let branchId: string;
  let departmentId: string;
  let staffRoleId: string;

  const adminHdr = () => ({ Cookie: adminCookie, 'x-tenant-id': tenantId });
  const punch = { latitude: BRANCH_LAT, longitude: BRANCH_LNG };

  const createStaff = async (
    tag: string,
  ): Promise<{ staffRecordId: string; userId: string; cookie: string }> => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/staff')
      .set(adminHdr())
      .send({
        email: `${tag}-${unique}@test.com`,
        firstName: tag,
        lastName: 'Worker',
        branchId,
        departmentId,
        jobTitle: 'Crew',
        roleIds: [staffRoleId],
      })
      .expect(201);
    const { staffRecord, user, temporaryPassword } = res.body as {
      staffRecord: { id: string };
      user: { id: string };
      temporaryPassword: string;
    };
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: `${tag}-${unique}@test.com`, password: temporaryPassword })
      .expect(200);
    return {
      staffRecordId: staffRecord.id,
      userId: user.id,
      cookie: extractCookies(login),
    };
  };

  const createSchedule = async (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/api/v1/schedules')
      .set(adminHdr())
      .send(body)
      .expect(201);

  beforeAll(async () => {
    app = await createTestApp();
    unique = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Att',
        lastName: 'Admin',
        email: `att-admin-${unique}@test.com`,
        password: 'password123',
        companyName: `Att Co ${unique}`,
      })
      .expect(201);
    adminCookie = extractCookies(reg);
    tenantId = reg.body.tenant.id;

    const branch = await request(app.getHttpServer())
      .post('/api/v1/branches')
      .set(adminHdr())
      .send({
        name: 'HQ',
        address: '1 Main St',
        latitude: BRANCH_LAT,
        longitude: BRANCH_LNG,
        radiusMeters: 150,
        timezone: 'UTC',
        workingDays: [1, 2, 3, 4, 5],
      })
      .expect(201);
    branchId = branch.body.id;

    const dept = await request(app.getHttpServer())
      .post('/api/v1/departments')
      .set(adminHdr())
      .send({ branchId, name: 'Operations' })
      .expect(201);
    departmentId = dept.body.id;

    const roles = await request(app.getHttpServer())
      .get('/api/v1/company-roles')
      .set(adminHdr())
      .expect(200);
    staffRoleId = roles.body.find(
      (r: { name: string }) => r.name === 'STAFF',
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('schedules', () => {
    let staff1: Awaited<ReturnType<typeof createStaff>>;

    beforeAll(async () => {
      staff1 = await createStaff('sched');
    });

    it('creates branch, department and staff schedules', async () => {
      const branchSchedule = await createSchedule({
        scope: 'BRANCH',
        branchId,
        resumptionTime: '08:00',
        closingTime: '17:00',
      });
      expect(branchSchedule.body).toMatchObject({
        scope: 'BRANCH',
        branchId,
        resumptionTime: '08:00',
        closingTime: '17:00',
      });

      const deptSchedule = await createSchedule({
        scope: 'DEPARTMENT',
        branchId,
        departmentId,
        resumptionTime: '09:00',
        closingTime: '18:00',
      });
      expect(deptSchedule.body).toMatchObject({
        scope: 'DEPARTMENT',
        departmentId,
      });

      const staffSchedule = await createSchedule({
        scope: 'STAFF',
        staffRecordId: staff1.staffRecordId,
        resumptionTime: '10:00',
        closingTime: '19:00',
      });
      expect(staffSchedule.body).toMatchObject({
        scope: 'STAFF',
        staffRecordId: staff1.staffRecordId,
        branchId,
      });
    });

    it('rejects overlapping schedules for the same target', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/schedules')
        .set(adminHdr())
        .send({
          scope: 'STAFF',
          staffRecordId: staff1.staffRecordId,
          resumptionTime: '11:00',
          closingTime: '18:30',
        })
        .expect(400);
    });

    it('validates scope requirements', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/schedules')
        .set(adminHdr())
        .send({
          scope: 'BRANCH',
          resumptionTime: '08:00',
          closingTime: '17:00',
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/v1/schedules')
        .set(adminHdr())
        .send({ scope: 'STAFF', resumptionTime: '08:00', closingTime: '17:00' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/v1/schedules')
        .set(adminHdr())
        .send({
          scope: 'BRANCH',
          branchId,
          resumptionTime: '17:00',
          closingTime: '08:00',
        })
        .expect(400);
    });

    it('lists, updates and deletes schedules', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/v1/schedules?scope=BRANCH')
        .set(adminHdr())
        .expect(200);
      expect(list.body).toHaveLength(1);

      const scheduleId = list.body[0].id;
      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/schedules/${scheduleId}`)
        .set(adminHdr())
        .send({ resumptionTime: '07:30' })
        .expect(200);
      expect(updated.body.resumptionTime).toBe('07:30');

      const one = await request(app.getHttpServer())
        .get(`/api/v1/schedules/${scheduleId}`)
        .set(adminHdr())
        .expect(200);
      expect(one.body.id).toBe(scheduleId);

      await request(app.getHttpServer())
        .delete(`/api/v1/schedules/${scheduleId}`)
        .set(adminHdr())
        .expect(204);
    });

    it('denies schedule management to staff', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/schedules')
        .set('Cookie', staff1.cookie)
        .set('x-tenant-id', tenantId)
        .send({
          scope: 'BRANCH',
          branchId,
          resumptionTime: '08:00',
          closingTime: '17:00',
        })
        .expect(403);
    });
  });

  describe('attendance', () => {
    const testTz = testTimeZone();
    const now = new Date();
    const days = workingDaysIncludingToday();

    let staff1: Awaited<ReturnType<typeof createStaff>>;
    let staff2: Awaited<ReturnType<typeof createStaff>>;
    let staff3: Awaited<ReturnType<typeof createStaff>>;
    let staff4: Awaited<ReturnType<typeof createStaff>>;
    let staff5: Awaited<ReturnType<typeof createStaff>>;
    let staff6: Awaited<ReturnType<typeof createStaff>>;
    let staff1RecordId: string;
    let staff2RecordId: string;

    const staffHdr = (s: { cookie: string }) => ({
      Cookie: s.cookie,
      'x-tenant-id': tenantId,
    });

    beforeAll(async () => {
      staff1 = await createStaff('on');
      staff2 = await createStaff('late');
      staff3 = await createStaff('offday');
      staff4 = await createStaff('early');
      staff5 = await createStaff('toolate');
      staff6 = await createStaff('afterclose');
    });

    it('clock-in on time within the geofence', async () => {
      await createSchedule({
        scope: 'STAFF',
        staffRecordId: staff1.staffRecordId,
        resumptionTime: fmtTimeIn(addMinutes(now, 10), testTz),
        closingTime: fmtTimeIn(addMinutes(now, 180), testTz),
        workingDays: days,
        timezone: testTz,
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set(staffHdr(staff1))
        .send(punch)
        .expect(201);
      expect(res.body).toMatchObject({
        userId: staff1.userId,
        branchId,
        status: 'ON_TIME',
      });
      expect(res.body.clockInAt).toBeDefined();
      staff1RecordId = res.body.id;
    });

    it('rejects a duplicate clock-in', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set(staffHdr(staff1))
        .send(punch)
        .expect(409);
    });

    it('clock-out early marks EARLY_LEAVE', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-out')
        .set(staffHdr(staff1))
        .send(punch)
        .expect(201);
      expect(res.body.status).toBe('EARLY_LEAVE');
      expect(res.body.clockOutAt).toBeDefined();
    });

    it('marks LATE when clocking in after resumption', async () => {
      await createSchedule({
        scope: 'STAFF',
        staffRecordId: staff2.staffRecordId,
        resumptionTime: fmtTimeIn(addMinutes(now, -5), testTz),
        closingTime: fmtTimeIn(addMinutes(now, 180), testTz),
        workingDays: days,
        timezone: testTz,
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set(staffHdr(staff2))
        .send({ latitude: BRANCH_LAT + 0.05, longitude: BRANCH_LNG })
        .expect(403);
      expect(res.body.message).toContain('geofence');

      const ok = await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set(staffHdr(staff2))
        .send(punch)
        .expect(201);
      expect(ok.body.status).toBe('LATE');
      staff2RecordId = ok.body.id;
    });

    it('rejects clock-in outside the branch geofence', async () => {
      // staff2 already covered geofence rejection; re-verify message shape.
      await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set(staffHdr(staff3))
        .send({ latitude: 41.2, longitude: BRANCH_LNG })
        .expect(403);
    });

    it('rejects clock-in on a non-working day', async () => {
      await createSchedule({
        scope: 'STAFF',
        staffRecordId: staff3.staffRecordId,
        resumptionTime: '00:00',
        closingTime: '23:59',
        workingDays: [(todayWeekday() + 1) % 7],
        timezone: 'UTC',
      });
      await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set(staffHdr(staff3))
        .send(punch)
        .expect(403);
    });

    it('rejects clock-in too early before the window', async () => {
      await createSchedule({
        scope: 'STAFF',
        staffRecordId: staff4.staffRecordId,
        resumptionTime: fmtTimeIn(addMinutes(now, 60), testTz),
        closingTime: fmtTimeIn(addMinutes(now, 180), testTz),
        workingDays: days,
        timezone: testTz,
      });
      await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set(staffHdr(staff4))
        .send(punch)
        .expect(403);
    });

    it('rejects clock-in past the late window', async () => {
      await createSchedule({
        scope: 'STAFF',
        staffRecordId: staff5.staffRecordId,
        resumptionTime: fmtTimeIn(addMinutes(now, -200), testTz),
        closingTime: fmtTimeIn(addMinutes(now, 60), testTz),
        workingDays: days,
        timezone: testTz,
      });
      await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set(staffHdr(staff5))
        .send(punch)
        .expect(403);
    });

    it('rejects clock-in after closing time', async () => {
      await createSchedule({
        scope: 'STAFF',
        staffRecordId: staff6.staffRecordId,
        resumptionTime: fmtTimeIn(addMinutes(now, -120), testTz),
        closingTime: fmtTimeIn(addMinutes(now, -30), testTz),
        workingDays: days,
        timezone: testTz,
      });
      await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set(staffHdr(staff6))
        .send(punch)
        .expect(403);
    });

    it('rejects clock-out without an open record', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-out')
        .set(staffHdr(staff6))
        .send(punch)
        .expect(404);
    });

    it('admin lists attendance and gets a summary', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/v1/attendance')
        .set(adminHdr())
        .expect(200);
      expect(list.body.length).toBeGreaterThanOrEqual(2);
      expect(
        list.body.some((r: { id: string }) => r.id === staff1RecordId),
      ).toBe(true);

      const summary = await request(app.getHttpServer())
        .get('/api/v1/attendance/summary')
        .set(adminHdr())
        .expect(200);
      expect(summary.body.total).toBeGreaterThanOrEqual(2);
      expect(summary.body.present).toBeGreaterThanOrEqual(2);
      expect(summary.body.byStatus.EARLY_LEAVE).toBe(1);
      expect(summary.body.byStatus.LATE).toBe(1);
    });

    it('staff can only see their own records', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/v1/attendance')
        .set(staffHdr(staff1))
        .expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0].id).toBe(staff1RecordId);

      await request(app.getHttpServer())
        .get(`/api/v1/attendance/${staff2RecordId}`)
        .set(staffHdr(staff1))
        .expect(403);
    });

    it('admin corrects a record and writes an audit log', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/attendance/${staff1RecordId}`)
        .set(adminHdr())
        .send({ status: 'ON_TIME', note: 'adjusted by admin' })
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'ON_TIME',
        note: 'adjusted by admin',
      });

      const prisma = app.get(PrismaService);
      const logs = await prisma.auditLog.findMany({
        where: { action: 'ATTENDANCE_CORRECTED', entityId: staff1RecordId },
      });
      expect(logs).toHaveLength(1);
      const metadata = logs[0].metadata as { after?: { status?: string } };
      expect(metadata.after?.status).toBe('ON_TIME');
    });

    it('denies corrections to staff', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/attendance/${staff1RecordId}`)
        .set(staffHdr(staff1))
        .send({ status: 'ABSENT' })
        .expect(403);
    });
  });
});
