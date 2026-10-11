import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SchoolAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(tenantId: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const [
      studentStatusCounts,
      studentGenderCounts,
      staffByCategory,
      classCount,
      subjectCount,
      guardianCount,
      enrollmentByClass,
      attendanceToday,
      invoiceStatusCounts,
      feeAggregate,
      approvedResults,
      publishedResults,
      currentSession,
      currentTerm,
      announcementCount,
    ] = await Promise.all([
      this.prisma.student.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.student.groupBy({
        by: ['gender'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.schoolStaff.groupBy({
        by: ['category'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.classRoom.count({ where: { tenantId } }),
      this.prisma.subject.count({ where: { tenantId } }),
      this.prisma.guardian.count({ where: { tenantId } }),
      this.prisma.classRoom.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          level: true,
          _count: { select: { students: { where: { status: 'ACTIVE' } } } },
        },
        orderBy: [{ level: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.schoolAttendance.groupBy({
        by: ['status'],
        where: {
          tenantId,
          date: { gte: startOfToday, lt: startOfTomorrow },
        },
        _count: { _all: true },
      }),
      this.prisma.studentInvoice.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.studentInvoice.aggregate({
        where: { tenantId },
        _sum: { totalAmount: true, paidAmount: true, balance: true },
      }),
      this.prisma.academicResult.count({
        where: { tenantId, status: 'APPROVED' },
      }),
      this.prisma.academicResult.count({
        where: { tenantId, status: 'PUBLISHED' },
      }),
      this.prisma.academicSession.findFirst({
        where: { tenantId, isCurrent: true },
        select: {
          id: true,
          name: true,
          isCurrent: true,
          startDate: true,
          endDate: true,
        },
      }),
      this.prisma.term.findFirst({
        where: { tenantId, isCurrent: true },
        select: {
          id: true,
          name: true,
          status: true,
          isCurrent: true,
          resultPublished: true,
          resultEntryOpen: true,
          startDate: true,
          endDate: true,
        },
      }),
      this.prisma.schoolAnnouncement.count({ where: { tenantId } }),
    ]);

    const totalStudents = studentStatusCounts.reduce(
      (acc, row) => acc + row._count._all,
      0,
    );
    const activeStudents =
      studentStatusCounts.find((row) => row.status === 'ACTIVE')?._count
        ?._all ?? 0;
    const totalStaff = staffByCategory.reduce(
      (acc, row) => acc + row._count._all,
      0,
    );
    const attendanceTotal = attendanceToday.reduce(
      (acc, row) => acc + row._count._all,
      0,
    );
    const totalInvoiced = feeAggregate._sum.totalAmount ?? 0;
    const totalPaid = feeAggregate._sum.paidAmount ?? 0;
    const outstanding = feeAggregate._sum.balance ?? 0;

    return {
      students: {
        total: totalStudents,
        active: activeStudents,
        byStatus: studentStatusCounts.map((row) => ({
          status: row.status,
          count: row._count._all,
        })),
        byGender: studentGenderCounts.map((row) => ({
          gender: row.gender,
          count: row._count._all,
        })),
      },
      staff: {
        total: totalStaff,
        byCategory: staffByCategory.map((row) => ({
          category: row.category,
          count: row._count._all,
        })),
      },
      academics: {
        classes: classCount,
        subjects: subjectCount,
        guardians: guardianCount,
        enrollmentByClass: enrollmentByClass.map((row) => ({
          id: row.id,
          name: row.name,
          level: row.level,
          students: row._count.students,
        })),
      },
      attendanceToday: {
        total: attendanceTotal,
        byStatus: attendanceToday.map((row) => ({
          status: row.status,
          count: row._count._all,
        })),
      },
      fees: {
        totalInvoiced,
        totalPaid,
        outstanding,
        byStatus: invoiceStatusCounts.map((row) => ({
          status: row.status,
          count: row._count._all,
        })),
      },
      results: {
        approved: approvedResults,
        published: publishedResults,
      },
      currentSession,
      currentTerm,
      announcements: announcementCount,
    };
  }
}