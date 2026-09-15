import {
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './prisma/prisma.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  @ApiOperation({
    summary: 'Health check',
    description:
      'Returns the API health status and confirms the database is reachable.',
  })
  @ApiOkResponse({
    description: 'API is healthy and the database is reachable.',
  })
  @ApiResponse({
    status: 503,
    description: 'Database is unreachable.',
  })
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'zarox-connect-api',
        timestamp: new Date().toISOString(),
      });
    }
    return {
      status: 'ok',
      service: 'zarox-connect-api',
      database: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
