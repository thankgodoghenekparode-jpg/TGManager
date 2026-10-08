import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import { ClassesService } from './classes.service';
import {
  assignClassSubjectSchema,
  createAcademicSessionSchema,
  createClassRoomSchema,
  createSubjectSchema,
  createTermSchema,
  schoolProfileSchema,
  updateAcademicSessionSchema,
  updateClassRoomSchema,
  updateSubjectSchema,
  updateTermSchema,
  type AssignClassSubjectDto,
  type CreateAcademicSessionDto,
  type CreateClassRoomDto,
  type CreateSubjectDto,
  type CreateTermDto,
  type SchoolProfileDto,
  type UpdateAcademicSessionDto,
  type UpdateClassRoomDto,
  type UpdateSubjectDto,
  type UpdateTermDto,
} from './dto/classes.dto';

@ApiTags('School - Classes & Setup')
@Controller('school')
@UseGuards(AccessGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  // ================= Profile =================
  @Get('profile')
  @Permissions(PERMISSIONS.SCHOOL_VIEW)
  @ApiOperation({ summary: 'Get school profile settings' })
  async getProfile(@Req() req: PermissionRequest) {
    return this.classesService.getProfile(req.tenant.id);
  }

  @Put('profile')
  @Permissions(PERMISSIONS.SCHOOL_MANAGE)
  @ApiOperation({ summary: 'Update school profile settings' })
  async updateProfile(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(schoolProfileSchema)) dto: SchoolProfileDto,
  ) {
    return this.classesService.updateProfile(req.tenant.id, dto);
  }

  // ================= Sessions =================
  @Get('sessions')
  @Permissions(PERMISSIONS.SCHOOL_VIEW)
  @ApiOperation({ summary: 'List academic sessions' })
  async listSessions(@Req() req: PermissionRequest) {
    return this.classesService.listSessions(req.tenant.id);
  }

  @Post('sessions')
  @Permissions(PERMISSIONS.SCHOOL_MANAGE)
  @ApiOperation({ summary: 'Create academic session' })
  async createSession(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createAcademicSessionSchema)) dto: CreateAcademicSessionDto,
  ) {
    return this.classesService.createSession(req.tenant.id, dto);
  }

  @Patch('sessions/:id')
  @Permissions(PERMISSIONS.SCHOOL_MANAGE)
  @ApiOperation({ summary: 'Update academic session' })
  async updateSession(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAcademicSessionSchema)) dto: UpdateAcademicSessionDto,
  ) {
    return this.classesService.updateSession(req.tenant.id, id, dto);
  }

  // ================= Terms =================
  @Get('terms')
  @Permissions(PERMISSIONS.SCHOOL_VIEW)
  @ApiOperation({ summary: 'List academic terms' })
  async listTerms(@Req() req: PermissionRequest, @Query('sessionId') sessionId?: string) {
    return this.classesService.listTerms(req.tenant.id, sessionId);
  }

  @Post('terms')
  @Permissions(PERMISSIONS.SCHOOL_MANAGE)
  @ApiOperation({ summary: 'Create academic term' })
  async createTerm(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createTermSchema)) dto: CreateTermDto,
  ) {
    return this.classesService.createTerm(req.tenant.id, dto);
  }

  @Patch('terms/:id')
  @Permissions(PERMISSIONS.SCHOOL_MANAGE)
  @ApiOperation({ summary: 'Update academic term' })
  async updateTerm(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTermSchema)) dto: UpdateTermDto,
  ) {
    return this.classesService.updateTerm(req.tenant.id, id, dto);
  }

  // ================= Classes =================
  @Get('classes')
  @Permissions(PERMISSIONS.SCHOOL_VIEW)
  @ApiOperation({ summary: 'List classrooms' })
  async listClasses(@Req() req: PermissionRequest, @Query('sessionId') sessionId?: string) {
    return this.classesService.listClasses(req.tenant.id, sessionId);
  }

  @Get('classes/:id')
  @Permissions(PERMISSIONS.SCHOOL_VIEW)
  @ApiOperation({ summary: 'Get classroom details with enrolled students' })
  async getClass(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.classesService.getClass(req.tenant.id, id);
  }

  @Post('classes')
  @Permissions(PERMISSIONS.SCHOOL_MANAGE)
  @ApiOperation({ summary: 'Create a classroom' })
  async createClass(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createClassRoomSchema)) dto: CreateClassRoomDto,
  ) {
    return this.classesService.createClass(req.tenant.id, dto);
  }

  @Patch('classes/:id')
  @Permissions(PERMISSIONS.SCHOOL_MANAGE)
  @ApiOperation({ summary: 'Update classroom' })
  async updateClass(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateClassRoomSchema)) dto: UpdateClassRoomDto,
  ) {
    return this.classesService.updateClass(req.tenant.id, id, dto);
  }

  @Delete('classes/:id')
  @Permissions(PERMISSIONS.SCHOOL_MANAGE)
  @ApiOperation({ summary: 'Delete classroom' })
  async deleteClass(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.classesService.deleteClass(req.tenant.id, id);
  }

  // ================= Subjects =================
  @Get('subjects')
  @Permissions(PERMISSIONS.SCHOOL_VIEW)
  @ApiOperation({ summary: 'List school subjects' })
  async listSubjects(@Req() req: PermissionRequest) {
    return this.classesService.listSubjects(req.tenant.id);
  }

  @Post('subjects')
  @Permissions(PERMISSIONS.SCHOOL_MANAGE)
  @ApiOperation({ summary: 'Create a subject' })
  async createSubject(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createSubjectSchema)) dto: CreateSubjectDto,
  ) {
    return this.classesService.createSubject(req.tenant.id, dto);
  }

  @Patch('subjects/:id')
  @Permissions(PERMISSIONS.SCHOOL_MANAGE)
  @ApiOperation({ summary: 'Update a subject' })
  async updateSubject(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSubjectSchema)) dto: UpdateSubjectDto,
  ) {
    return this.classesService.updateSubject(req.tenant.id, id, dto);
  }

  @Post('classes/:id/subjects')
  @Permissions(PERMISSIONS.SCHOOL_MANAGE)
  @ApiOperation({ summary: 'Assign a subject to a classroom' })
  async assignSubject(
    @Req() req: PermissionRequest,
    @Param('id') classId: string,
    @Body(new ZodValidationPipe(assignClassSubjectSchema)) dto: AssignClassSubjectDto,
  ) {
    return this.classesService.assignSubjectToClass(req.tenant.id, classId, dto);
  }
}
