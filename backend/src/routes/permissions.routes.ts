import { Router } from 'express';
import { PERMISSIONS } from '../auth/permissions';

const router = Router();

router.get('/', (_req, res) => {
  res.json(PERMISSIONS);
});

export default router;
