import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessGuard } from '../../common/guards/access.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { SchoolFeesService } from './invoices.service';
import {
  createFeeStructureSchema,
  createStudentInvoiceSchema,
  generateClassInvoicesSchema,
  queryInvoicesSchema,
  recordSchoolPaymentSchema,
  type CreateFeeStructureDto,
  type CreateStudentInvoiceDto,
  type GenerateClassInvoicesDto,
  type QueryInvoicesDto,
  type RecordSchoolPaymentDto,
} from './dto/invoices.dto';

@ApiTags('School - Fees & Invoices')
@Controller('school')
@UseGuards(AccessGuard)
export class SchoolFeesController {
  constructor(private readonly feesService: SchoolFeesService) {}

  @Get('fees/structures')
  @Permissions(PERMISSIONS.SCHOOL_FEE_VIEW)
  @ApiOperation({ summary: 'List fee structures' })
  async listFeeStructures(
    @Req() req: PermissionRequest,
    @Query('classId') classId?: string,
    @Query('sessionId') sessionId?: string,
    @Query('termId') termId?: string,
  ) {
    return this.feesService.listFeeStructures(req.tenant.id, classId, sessionId, termId);
  }

  @Post('fees/structures')
  @Permissions(PERMISSIONS.SCHOOL_FEE_MANAGE)
  @ApiOperation({ summary: 'Create fee structure item' })
  async createFeeStructure(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createFeeStructureSchema)) dto: CreateFeeStructureDto,
  ) {
    return this.feesService.createFeeStructure(req.tenant.id, dto);
  }

  @Get('invoices')
  @Permissions(PERMISSIONS.SCHOOL_FEE_VIEW)
  @ApiOperation({ summary: 'List student invoices with balance and payment status' })
  async listInvoices(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(queryInvoicesSchema)) query: QueryInvoicesDto,
  ) {
    return this.feesService.listInvoices(req.tenant.id, query);
  }

  @Get('invoices/:id')
  @Permissions(PERMISSIONS.SCHOOL_FEE_VIEW)
  @ApiOperation({ summary: 'Get invoice details with payment history' })
  async getInvoice(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.feesService.getInvoice(req.tenant.id, id);
  }

  @Post('invoices')
  @Permissions(PERMISSIONS.SCHOOL_FEE_MANAGE)
  @ApiOperation({ summary: 'Create customized invoice for a student' })
  async createInvoice(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createStudentInvoiceSchema)) dto: CreateStudentInvoiceDto,
  ) {
    return this.feesService.createStudentInvoice(req.tenant.id, dto);
  }

  @Post('invoices/generate-class')
  @Permissions(PERMISSIONS.SCHOOL_FEE_MANAGE)
  @ApiOperation({ summary: 'Bulk generate invoices for all students in a classroom' })
  async generateClassInvoices(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(generateClassInvoicesSchema)) dto: GenerateClassInvoicesDto,
  ) {
    return this.feesService.generateClassInvoices(req.tenant.id, dto);
  }

  @Post('payments')
  @Permissions(PERMISSIONS.SCHOOL_FEE_MANAGE)
  @ApiOperation({ summary: 'Record payment against a student invoice and issue receipt' })
  async recordPayment(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(recordSchoolPaymentSchema)) dto: RecordSchoolPaymentDto,
  ) {
    return this.feesService.recordPayment(req.tenant.id, req.user.sub, dto);
  }

  @Get('fees/stats')
  @Permissions(PERMISSIONS.SCHOOL_FEE_VIEW)
  @ApiOperation({ summary: 'Get school fee revenue and collection stats' })
  async getRevenueStats(
    @Req() req: PermissionRequest,
    @Query('sessionId') sessionId?: string,
    @Query('termId') termId?: string,
  ) {
    return this.feesService.getRevenueStats(req.tenant.id, sessionId, termId);
  }
}
