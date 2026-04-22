import { Router, Request, Response } from 'express';
import { UsersService } from '../services/users.service';
import { UsersController } from '../controllers/users.controller';

const router = Router();
const usersService = new UsersService();
const usersController = new UsersController(usersService);

router.get('/', usersController.list);
router.post('/', usersController.create);
router.patch('/:id', usersController.patch);
router.post('/:id/reset-password', usersController.resetPassword);

export default router;

