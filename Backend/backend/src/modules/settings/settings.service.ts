import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { isValidTimeZone } from '../../common/utils/time.util';
import type { SaveSettingsDto, TenantSettingsShape } from './dto/settings.dto';

const SETTING_ACTION = 'TENANT_SETTINGS_UPDATED';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(tenantId: string): Promise<TenantSettingsShape> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    return pickKnownFields(tenant?.settings);
  }

  async update(
    tenantId: string,
    userId: string,
    dto: SaveSettingsDto,
  ): Promise<TenantSettingsShape> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    const current = pickKnownFields(tenant?.settings);
    const next: TenantSettingsShape = { ...current };
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        (next as Record<string, unknown>)[key] = value;
      }
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: next as unknown as Prisma.InputJsonObject,
      },
      select: { settings: true },
    });

    this.audit.record(tenantId, {
      userId,
      action: SETTING_ACTION,
      entityType: 'Tenant',
      entityId: tenantId,
      metadata: { keys: Object.keys(dto) },
    });

    return pickKnownFields(updated.settings);
  }
}

function pickKnownFields(raw: unknown): TenantSettingsShape {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const record = raw as Record<string, unknown>;
  const shape: TenantSettingsShape = {};
  if (typeof record.defaultLatitude === 'number') {
    shape.defaultLatitude = record.defaultLatitude;
  }
  if (typeof record.defaultLongitude === 'number') {
    shape.defaultLongitude = record.defaultLongitude;
  }
  if (typeof record.defaultRadiusMeters === 'number') {
    shape.defaultRadiusMeters = record.defaultRadiusMeters;
  }
  if (typeof record.defaultResumptionTime === 'string') {
    shape.defaultResumptionTime = record.defaultResumptionTime;
  }
  if (typeof record.defaultClosingTime === 'string') {
    shape.defaultClosingTime = record.defaultClosingTime;
  }
  if (typeof record.defaultLatePeriodMinutes === 'number') {
    shape.defaultLatePeriodMinutes = record.defaultLatePeriodMinutes;
  }
  if (
    Array.isArray(record.defaultWorkingDays) &&
    record.defaultWorkingDays.every(
      (d) => typeof d === 'number' && d >= 0 && d <= 6,
    )
  ) {
    shape.defaultWorkingDays = record.defaultWorkingDays;
  }
  if (typeof record.timezone === 'string' && isValidTimeZone(record.timezone)) {
    shape.timezone = record.timezone;
  }
  if (typeof record.frontendUrl === 'string') {
    shape.frontendUrl = record.frontendUrl;
  }
  if (typeof record.apiUrl === 'string') {
    shape.apiUrl = record.apiUrl;
  }
  return shape;
}
