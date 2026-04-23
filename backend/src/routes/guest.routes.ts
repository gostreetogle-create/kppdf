import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthService } from '../auth/auth.service';
import { authGuard, type AuthPayload, requirePermission } from '../middleware/auth.middleware';
import { ALL_PERMISSION_KEYS, type Permission } from '../auth/permissions';

const router = Router();
const authService = new AuthService();

const PREVIEW_LINK_TTL_SECONDS = 7 * 24 * 60 * 60;
const PREVIEW_ACCESS_PERMISSIONS: Permission[] = [...ALL_PERMISSION_KEYS];

function previewSecret(): string {
  return process.env.GUEST_PREVIEW_SECRET || process.env.JWT_SECRET || 'dev-secret';
}

function frontendBaseUrl(): string {
  return process.env.FRONTEND_BASE_URL || process.env.CORS_ORIGIN || 'http://localhost:4200';
}

router.post('/issue', authGuard, requirePermission('users.manage'), (req: Request, res: Response) => {
  const rawTtlDays = Number(req.body?.ttlDays);
  const ttlDays = Number.isFinite(rawTtlDays) && rawTtlDays > 0 ? Math.min(rawTtlDays, 30) : 7;
  const expiresIn = Math.round(ttlDays * 24 * 60 * 60);

  const linkToken = jwt.sign(
    {
      type: 'guest-preview-link',
      createdBy: req.user?.userId ?? 'system'
    },
    previewSecret(),
    { expiresIn }
  );

  const previewUrl = `${frontendBaseUrl().replace(/\/+$/, '')}/guest-preview/${linkToken}`;
  res.json({
    previewUrl,
    expiresInSeconds: expiresIn
  });
});

router.post('/enter/:token', (req: Request, res: Response) => {
  const token = req.params.token;
  if (!token) {
    res.status(400).json({ message: 'Токен приглашения не указан' });
    return;
  }

  try {
    const payload = jwt.verify(token, previewSecret()) as { type?: string };
    if (payload.type !== 'guest-preview-link') {
      res.status(401).json({ message: 'Неверный тип приглашения' });
      return;
    }

    const authPayload: Omit<AuthPayload, 'type'> = {
      userId: 'guest-preview',
      username: 'guest',
      roleId: 'guest-preview',
      roleKey: 'guest',
      permissions: PREVIEW_ACCESS_PERMISSIONS,
      isGuest: true
    };

    const accessToken = authService.signAccessToken(authPayload);
    res.json({
      accessToken,
      user: {
        _id: 'guest-preview',
        username: 'guest',
        name: 'Гостевой просмотр',
        roleId: null,
        roleKey: 'guest',
        roleName: 'Гость',
        permissions: PREVIEW_ACCESS_PERMISSIONS,
        isActive: true,
        mustChangePassword: false
      }
    });
  } catch {
    res.status(401).json({ message: 'Ссылка гостевого доступа недействительна или истекла' });
  }
});

export default router;
