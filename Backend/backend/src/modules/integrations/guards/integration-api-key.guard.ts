import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';

interface ApiKeyRequest extends Request {
  apiKey?: {
    id: string;
    tenantId: string;
    permissions: string[];
  };
}

@Injectable()
export class IntegrationApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiKeyRequest>();
    const apiKey = request.headers['x-api-key'] as string | undefined;

    if (!apiKey) {
      throw new UnauthorizedException('Missing X-Api-Key header');
    }

    const prefix = apiKey.substring(0, 8);
    const candidate = await this.prisma.integrationApiKey.findFirst({
      where: { keyPrefix: prefix, isActive: true },
    });

    if (!candidate) {
      throw new UnauthorizedException('Invalid API key');
    }

    const hash = createHash('sha256').update(apiKey).digest('hex');
    const storedHashBuffer = Buffer.from(candidate.keyHash, 'hex');
    const candidateHashBuffer = Buffer.from(hash, 'hex');

    if (
      storedHashBuffer.length !== candidateHashBuffer.length ||
      !timingSafeEqual(storedHashBuffer, candidateHashBuffer)
    ) {
      throw new UnauthorizedException('Invalid API key');
    }

    await this.prisma.integrationApiKey.update({
      where: { id: candidate.id },
      data: { lastUsedAt: new Date() },
    });

    request.apiKey = {
      id: candidate.id,
      tenantId: candidate.tenantId,
      permissions: candidate.permissions,
    };

    return true;
  }
}
