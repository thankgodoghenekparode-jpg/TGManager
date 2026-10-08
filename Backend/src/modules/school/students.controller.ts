import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { StudentsService } from './students.service';
import {
  createGuardianSchema,
  createStudentSchema,
  linkGuardianSchema,
  queryStudentsSchema,
  updateStudentSchema,
  type CreateGuardianDto,
  type CreateStudentDto,
  type LinkGuardianDto,
  type QueryStudentsDto,
  type UpdateStudentDto,
} from './dto/students.dto';

@ApiTags('School - Students & Guardians')
@Controller('school')
@UseGuards(AccessGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get('students')
  @Permissions(PERMISSIONS.STUDENT_VIEW)
  @ApiOperation({ summary: 'List students with filters and pagination' })
  async listStudents(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(queryStudentsSchema)) query: QueryStudentsDto,
  ) {
    return this.studentsService.list(req.tenant.id, query);
  }

  @Get('students/:id')
  @Permissions(PERMISSIONS.STUDENT_VIEW)
  @ApiOperation({ summary: 'Get student full profile' })
  async getStudent(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.studentsService.getById(req.tenant.id, id);
  }

  @Post('students')
  @Permissions(PERMISSIONS.STUDENT_MANAGE)
  @ApiOperation({ summary: 'Enroll a new student' })
  async createStudent(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createStudentSchema)) dto: CreateStudentDto,
  ) {
    return this.studentsService.create(req.tenant.id, dto);
  }

  @Patch('students/:id')
  @Permissions(PERMISSIONS.STUDENT_MANAGE)
  @ApiOperation({ summary: 'Update student record' })
  async updateStudent(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateStudentSchema)) dto: UpdateStudentDto,
  ) {
    return this.studentsService.update(req.tenant.id, id, dto);
  }

  @Delete('students/:id')
  @Permissions(PERMISSIONS.STUDENT_MANAGE)
  @ApiOperation({ summary: 'Delete or archive a student' })
  async deleteStudent(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.studentsService.delete(req.tenant.id, id);
  }

  @Post('students/:id/id-card')
  @Permissions(PERMISSIONS.STUDENT_MANAGE)
  @ApiOperation({ summary: 'Issue or re-issue student digital ID card' })
  async issueIdCard(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.studentsService.issueIdCard(req.tenant.id, id);
  }

  @Get('guardians')
  @Permissions(PERMISSIONS.STUDENT_VIEW)
  @ApiOperation({ summary: 'List guardians' })
  async listGuardians(@Req() req: PermissionRequest, @Query('search') search?: string) {
    return this.studentsService.listGuardians(req.tenant.id, search);
  }

  @Post('guardians')
  @Permissions(PERMISSIONS.STUDENT_MANAGE)
  @ApiOperation({ summary: 'Register a new guardian' })
  async createGuardian(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createGuardianSchema)) dto: CreateGuardianDto,
  ) {
    return this.studentsService.createGuardian(req.tenant.id, dto);
  }

  @Post('students/:id/guardians')
  @Permissions(PERMISSIONS.STUDENT_MANAGE)
  @ApiOperation({ summary: 'Link guardian to student' })
  async linkGuardian(
    @Req() req: PermissionRequest,
    @Param('id') studentId: string,
    @Body(new ZodValidationPipe(linkGuardianSchema)) dto: LinkGuardianDto,
  ) {
    return this.studentsService.linkGuardian(req.tenant.id, studentId, dto);
  }
}
