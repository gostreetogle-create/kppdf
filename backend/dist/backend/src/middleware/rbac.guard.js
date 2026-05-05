"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = requirePermission;
const auth_middleware_1 = require("./auth.middleware");
function requirePermission(permission) {
    return (0, auth_middleware_1.requirePermission)(permission);
}
