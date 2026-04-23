import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { AuthPayload } from '../middleware/auth.middleware';

const JWT_SECRET = () => process.env.JWT_SECRET || 'dev-secret';
const ACCESS_TTL_SECONDS = parseDurationSeconds(process.env.JWT_ACCESS_EXPIRES, 15 * 60);
const REFRESH_TTL_SECONDS = parseDurationSeconds(process.env.JWT_REFRESH_EXPIRES, 7 * 24 * 60 * 60);

function parseDurationSeconds(raw: string | undefined, fallbackSeconds: number): number {
  if (!raw?.trim()) return fallbackSeconds;
  const normalized = raw.trim().toLowerCase();
  const direct = Number(normalized);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const match = normalized.match(/^(\d+)([smhd])$/);
  if (!match) return fallbackSeconds;
  const value = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(value) || value <= 0) return fallbackSeconds;
  const unitToSeconds: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60
  };
  return value * unitToSeconds[unit];
}

export class AuthService {
  signAccessToken(payload: Omit<AuthPayload, 'type'>): string {
    return jwt.sign({ ...payload, type: 'access' }, JWT_SECRET(), { expiresIn: ACCESS_TTL_SECONDS });
  }

  signRefreshToken(payload: Omit<AuthPayload, 'type'>): string {
    return jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET(), { expiresIn: REFRESH_TTL_SECONDS });
  }

  verifyToken<T>(token: string): T {
    return jwt.verify(token, JWT_SECRET()) as T;
  }

  async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10);
  }

  async compareToken(rawToken: string, hash: string): Promise<boolean> {
    return bcrypt.compare(rawToken, hash);
  }

  get refreshTtlMs() {
    return REFRESH_TTL_SECONDS * 1000;
  }
}

