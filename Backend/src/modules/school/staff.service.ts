import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateSchoolStaffDto,
  QuerySchoolStaffDto,
  UpdateSchoolStaffDto,
} from './dto/staff.dto';

@Injectable()
export class SchoolStaffService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateEmployeeNumber(tenantId: string): Promise<string> {
    const count = await this.prisma.schoolStaff.count({ where: { tenantId } });
    return `STF-${String(count + 1).padStart(4, '0')}`;
  }

  async list(tenantId: string, query: QuerySchoolStaffDto) {
    return this.prisma.schoolStaff.findMany({
      where: {
        tenantId,
        ...(query.category ? { category: query.category } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { firstName: { contains: query.search, mode: 'insensitive' } },
                { lastName: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
                { employeeNumber: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async create(tenantId: string, dto: CreateSchoolStaffDto) {
    const employeeNumber =
      dto.employeeNumber ?? (await this.generateEmployeeNumber(tenantId));

    const existing = await this.prisma.schoolStaff.findFirst({
      where: { tenantId, employeeNumber },
    });
    if (existing) {
      throw new ConflictException(
        `Employee number ${employeeNumber} is already in use`,
      );
    }

    return this.prisma.schoolStaff.create({
      data: {
        tenantId,
        employeeNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        department: dto.department,
        designation: dto.designation,
        category: dto.category,
        employmentDate: dto.employmentDate ? new Date(dto.employmentDate) : null,
        photo: dto.photo,
        status: dto.status,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateSchoolStaffDto) {
    const staff = await this.prisma.schoolStaff.findFirst({
      where: { id, tenantId },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    if (dto.employeeNumber && dto.employeeNumber !== staff.employeeNumber) {
      const clash = await this.prisma.schoolStaff.findFirst({
        where: { tenantId, employeeNumber: dto.employeeNumber },
      });
      if (clash) {
        throw new ConflictException(
          `Employee number ${dto.employeeNumber} is already in use`,
        );
      }
    }

    return this.prisma.schoolStaff.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.employeeNumber !== undefined
          ? { employeeNumber: dto.employeeNumber }
          : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.department !== undefined ? { department: dto.department } : {}),
        ...(dto.designation !== undefined ? { designation: dto.designation } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.employmentDate !== undefined
          ? {
              employmentDate: dto.employmentDate
                ? new Date(dto.employmentDate)
                : null,
            }
          : {}),
        ...(dto.photo !== undefined ? { photo: dto.photo } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const staff = await this.prisma.schoolStaff.findFirst({
      where: { id, tenantId },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    await this.prisma.schoolStaff.delete({ where: { id } });
    return { success: true };
  }
}
