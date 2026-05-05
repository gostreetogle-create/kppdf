"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const permissions_1 = require("../auth/permissions");
const router = (0, express_1.Router)();
router.get('/', (_req, res) => {
    res.json(permissions_1.PERMISSIONS);
});
exports.default = router;
