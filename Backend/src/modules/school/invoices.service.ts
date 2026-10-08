import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateFeeStructureDto,
  CreateStudentInvoiceDto,
  GenerateClassInvoicesDto,
  QueryInvoicesDto,
  RecordSchoolPaymentDto,
} from './dto/invoices.dto';

@Injectable()
export class SchoolFeesService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateInvoiceNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.studentInvoice.count({ where: { tenantId } });
    const serial = String(count + 1).padStart(5, '0');
    return `INV-${year}-${serial}`;
  }

  private async generateReceiptNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.schoolPayment.count({ where: { tenantId } });
    const serial = String(count + 1).padStart(5, '0');
    return `RCP-${year}-${serial}`;
  }

  // ================= Fee Structures =================
  async listFeeStructures(tenantId: string, classId?: string, sessionId?: string, termId?: string) {
    return this.prisma.feeStructure.findMany({
      where: {
        tenantId,
        ...(classId ? { classId } : {}),
        ...(sessionId ? { sessionId } : {}),
        ...(termId ? { termId } : {}),
      },
      include: {
        class: { select: { id: true, name: true } },
        session: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFeeStructure(tenantId: string, dto: CreateFeeStructureDto) {
    return this.prisma.feeStructure.create({
      data: {
        tenantId,
        name: dto.name,
        category: dto.category.toUpperCase(),
        amount: dto.amount,
        classId: dto.classId,
        sessionId: dto.sessionId,
        termId: dto.termId,
      },
    });
  }

  // ================= Invoices =================
  async generateClassInvoices(tenantId: string, dto: GenerateClassInvoicesDto) {
    const students = await this.prisma.student.findMany({
      where: {
        tenantId,
        currentClassId: dto.classId,
        status: 'ACTIVE',
      },
    });

    if (students.length === 0) {
      throw new BadRequestException('No active students found in this class');
    }

    const feeStructures = await this.prisma.feeStructure.findMany({
      where: {
        tenantId,
        id: { in: dto.feeStructureIds },
      },
    });

    if (feeStructures.length === 0) {
      throw new BadRequestException('No fee structures found for provided IDs');
    }

    const totalAmount = feeStructures.reduce((sum, f) => sum + f.amount, 0);
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;

    let createdCount = 0;
    for (const student of students) {
      const invoiceNumber = await this.generateInvoiceNumber(tenantId);
      await this.prisma.studentInvoice.create({
        data: {
          tenantId,
          studentId: student.id,
          sessionId: dto.sessionId,
          termId: dto.termId,
          invoiceNumber,
          totalAmount,
          discountAmount: 0,
          paidAmount: 0,
          balance: totalAmount,
          dueDate,
          status: 'UNPAID',
          items: {
            create: feeStructures.map((f) => ({
              feeStructureId: f.id,
              description: f.name,
              amount: f.amount,
            })),
          },
        },
      });
      createdCount++;
    }

    return {
      success: true,
      invoicesGenerated: createdCount,
      totalAmountPerStudent: totalAmount,
    };
  }

  async createStudentInvoice(tenantId: string, dto: CreateStudentInvoiceDto) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const subtotal = dto.items.reduce((sum, i) => sum + i.amount, 0);
    const discount = dto.discountAmount || 0;
    const totalAmount = Math.max(0, subtotal - discount);
    const invoiceNumber = await this.generateInvoiceNumber(tenantId);

    return this.prisma.studentInvoice.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        sessionId: dto.sessionId,
        termId: dto.termId,
        invoiceNumber,
        totalAmount,
        discountAmount: discount,
        paidAmount: 0,
        balance: totalAmount,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: 'UNPAID',
        items: {
          create: dto.items.map((i) => ({
            feeStructureId: i.feeStructureId,
            description: i.description,
            amount: i.amount,
          })),
        },
      },
      include: {
        items: true,
      },
    });
  }

  async listInvoices(tenantId: string, query: QueryInvoicesDto) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.sessionId ? { sessionId: query.sessionId } : {}),
      ...(query.termId ? { termId: query.termId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    if (query.classId) {
      where.student = { currentClassId: query.classId };
    }

    const [items, total] = await Promise.all([
      this.prisma.studentInvoice.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              admissionNumber: true,
              firstName: true,
              lastName: true,
              currentClass: { select: { id: true, name: true } },
            },
          },
          session: { select: { id: true, name: true } },
          term: { select: { id: true, name: true } },
          items: true,
          payments: {
            select: {
              id: true,
              amount: true,
              receiptNumber: true,
              method: true,
              paymentDate: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.studentInvoice.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getInvoice(tenantId: string, id: string) {
    const invoice = await this.prisma.studentInvoice.findFirst({
      where: { id, tenantId },
      include: {
        student: {
          include: {
            currentClass: true,
            guardians: { include: { guardian: true } },
          },
        },
        session: true,
        term: true,
        items: true,
        payments: {
          include: {
            recordedBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { paymentDate: 'desc' },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  // ================= Payments =================
  async recordPayment(tenantId: string, recordedByUserId: string, dto: RecordSchoolPaymentDto) {
    const invoice = await this.prisma.studentInvoice.findFirst({
      where: { id: dto.invoiceId, tenantId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (dto.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }
    if (dto.amount > invoice.balance) {
      throw new BadRequestException(
        `Payment amount (${dto.amount}) exceeds outstanding invoice balance (${invoice.balance})`,
      );
    }

    const receiptNumber = await this.generateReceiptNumber(tenantId);
    const paymentReference = `PAY-${randomBytes(4).toString('hex').toUpperCase()}`;
    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.schoolPayment.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          studentId: invoice.studentId,
          paymentReference,
          receiptNumber,
          amount: dto.amount,
          method: dto.method,
          paymentDate,
          recordedByUserId,
          notes: dto.notes,
        },
      });

      const newPaidAmount = invoice.paidAmount + dto.amount;
      const newBalance = Math.max(0, invoice.totalAmount - newPaidAmount);
      const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIAL';

      const updatedInvoice = await tx.studentInvoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidAmount,
          balance: newBalance,
          status: newStatus,
        },
      });

      return {
        payment,
        invoice: updatedInvoice,
      };
    });
  }

  async getRevenueStats(tenantId: string, sessionId?: string, termId?: string) {
    const where: any = {
      tenantId,
      ...(sessionId ? { sessionId } : {}),
      ...(termId ? { termId } : {}),
    };

    const aggregates = await this.prisma.studentInvoice.aggregate({
      where,
      _sum: {
        totalAmount: true,
        paidAmount: true,
        balance: true,
      },
      _count: true,
    });

    const totalInvoiced = aggregates._sum.totalAmount || 0;
    const totalCollected = aggregates._sum.paidAmount || 0;
    const totalOutstanding = aggregates._sum.balance || 0;
    const collectionRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0;

    return {
      totalInvoicesCount: aggregates._count,
      totalInvoiced,
      totalCollected,
      totalOutstanding,
      collectionRatePercent: collectionRate,
    };
  }
}
