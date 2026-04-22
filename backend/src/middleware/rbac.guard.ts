import type { RequestHandler } from 'express';
import { requirePermission as baseRequirePermission } from './auth.middleware';
import type { Permission } from '../auth/permissions';

export function requirePermission(permission: Permission): RequestHandler {
  return baseRequirePermission(permission);
}

