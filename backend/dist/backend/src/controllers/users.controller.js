"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersController = void 0;
class UsersController {
    constructor(usersService) {
        this.usersService = usersService;
        this.list = async (_req, res) => {
            try {
                const users = await this.usersService.list();
                res.json(users);
            }
            catch {
                res.status(500).json({ message: 'Ошибка сервера' });
            }
        };
        this.create = async (req, res) => {
            const { username, name, roleId, password } = req.body;
            if (!username || !name || !roleId || !password) {
                res.status(400).json({ message: 'username, name, roleId, password обязательны' });
                return;
            }
            try {
                const user = await this.usersService.create({
                    username,
                    name,
                    roleId,
                    password,
                    actorUserId: req.user?.userId
                });
                res.status(201).json({
                    _id: user._id,
                    username: user.username,
                    name: user.name,
                    roleId: user.roleId?._id?.toString?.() ?? user.roleId,
                    roleKey: user.roleId?.key ?? user.role,
                    roleName: user.roleId?.name ?? user.role,
                    isActive: user.isActive,
                    mustChangePassword: user.mustChangePassword,
                    createdAt: user.createdAt
                });
            }
            catch (e) {
                const duplicateField = e?.keyPattern ? Object.keys(e.keyPattern)[0] : undefined;
                const details = e?.code === 11000
                    ? `Конфликт уникального поля: ${duplicateField || 'unknown'}`
                    : (typeof e?.message === 'string' ? e.message : 'Unknown error');
                res.status(400).json({
                    message: e?.message || 'Ошибка создания пользователя',
                    details
                });
            }
        };
        this.patch = async (req, res) => {
            try {
                const user = await this.usersService.update(req.params.id, {
                    username: req.body?.username,
                    name: req.body?.name,
                    roleId: req.body?.roleId,
                    isActive: req.body?.isActive,
                    mustChangePassword: req.body?.mustChangePassword,
                    actorUserId: req.user?.userId,
                    actorRoleKey: req.user?.roleKey
                });
                res.json(user);
            }
            catch (e) {
                res.status(400).json({ message: e?.message || 'Ошибка обновления пользователя' });
            }
        };
        this.resetPassword = async (req, res) => {
            const { password } = req.body;
            if (!password) {
                res.status(400).json({ message: 'Новый пароль обязателен' });
                return;
            }
            try {
                const result = await this.usersService.resetPassword(req.params.id, password, req.user?.userId);
                res.json(result);
            }
            catch (e) {
                res.status(400).json({ message: e?.message || 'Ошибка сброса пароля' });
            }
        };
        this.remove = async (req, res) => {
            try {
                const result = await this.usersService.delete(req.params.id, req.user?.userId);
                res.json(result);
            }
            catch (e) {
                res.status(400).json({ message: e?.message || 'Ошибка удаления пользователя' });
            }
        };
    }
}
exports.UsersController = UsersController;
