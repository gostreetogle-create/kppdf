import type { RequestHandler } from 'express';
import { requirePermission as baseRequirePermission } from './auth.middleware';
import { Permission } from '../../../shared/types/User';

export function requirePermission(permission: Permission): RequestHandler {
  return baseRequirePermission(permission);
}

