import { Request } from 'express';
import { UserRole } from '../../generated/prisma/enums';

export interface JwtPayload {
  sub: string;
  email?: string;
  userRole?: UserRole;
  type: 'access' | 'refresh';
  jti?: string;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
