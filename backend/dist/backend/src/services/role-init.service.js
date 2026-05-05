"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initRolesAndMigrateUsers = initRolesAndMigrateUsers;
const mongoose_1 = require("mongoose");
const role_model_1 = require("../models/role.model");
const user_model_1 = require("../models/user.model");
const permissions_1 = require("../auth/permissions");
function toObjectId(value) {
    if (!value)
        return null;
    if (value instanceof mongoose_1.Types.ObjectId)
        return value;
    if (typeof value === 'string' && mongoose_1.Types.ObjectId.isValid(value))
        return new mongoose_1.Types.ObjectId(value);
    return null;
}
async function initRolesAndMigrateUsers() {
    const roleByKey = new Map();
    for (const roleKey of permissions_1.SYSTEM_ROLE_KEYS) {
        const seeded = await role_model_1.Role.findOneAndUpdate({ key: roleKey }, {
            $set: {
                name: roleKey,
                key: roleKey,
                isSystem: true,
                permissions: permissions_1.SYSTEM_ROLE_PERMISSIONS[roleKey]
            }
        }, { new: true, upsert: true, setDefaultsOnInsert: true });
        roleByKey.set(roleKey, seeded._id);
    }
    const users = await user_model_1.User.find().select('_id role roleId').lean();
    for (const user of users) {
        const existingRoleId = toObjectId(user.roleId);
        if (existingRoleId)
            continue;
        const legacyRole = typeof user.role === 'string' ? user.role.trim().toLowerCase() : '';
        const mappedKey = permissions_1.SYSTEM_ROLE_KEYS.includes(legacyRole) ? legacyRole : 'manager';
        const mappedRoleId = roleByKey.get(mappedKey);
        if (!mappedRoleId)
            continue;
        await user_model_1.User.updateOne({ _id: user._id }, {
            $set: {
                roleId: mappedRoleId,
                role: mappedKey
            }
        });
    }
    const customRoles = await role_model_1.Role.find({ isSystem: false }).select('_id permissions').lean();
    for (const role of customRoles) {
        const normalized = (0, permissions_1.normalizePermissions)(role.permissions);
        if (normalized.length !== (role.permissions?.length ?? 0)) {
            await role_model_1.Role.updateOne({ _id: role._id }, { $set: { permissions: normalized } });
        }
    }
}
