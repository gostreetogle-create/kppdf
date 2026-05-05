"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KP_STATUS_LABELS = exports.KP_STATUS_TRANSITIONS = void 0;
// Бизнес-правила статусов (см. docs/business-rules.md)
exports.KP_STATUS_TRANSITIONS = {
    draft: ['sent'],
    sent: ['accepted', 'rejected'],
    accepted: [],
    rejected: ['draft'],
};
exports.KP_STATUS_LABELS = {
    draft: 'Черновик',
    sent: 'Отправлен',
    accepted: 'Принят',
    rejected: 'Отклонён',
};
