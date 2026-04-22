import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { AuthPayload } from '../middleware/auth.middleware';

const JWT_SECRET = () => process.env.JWT_SECRET || 'dev-secret';
const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

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

