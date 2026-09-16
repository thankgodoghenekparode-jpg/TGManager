import { AuthenticatedRequest } from './authenticated-request.interface';
import { TenantUser } from '../../generated/prisma/client';

export interface TenantRequest extends AuthenticatedRequest {
  tenant: {
    id: string;
    name: string;
    slug: string;
    planId: string;
    onboardingStatus: string;
    status: string;
    timezone: string;
  };
  membership: TenantUser;
}
