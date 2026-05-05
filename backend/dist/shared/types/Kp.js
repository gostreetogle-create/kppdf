"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KP_STATUS_LABELS = exports.KP_STATUS_TRANSITIONS = exports.KP_TYPE_LABELS = void 0;
exports.KP_TYPE_LABELS = {
    standard: 'КП',
    response: 'Ответ на письмо',
    special: 'Спецпредложение',
    tender: 'Для тендера',
    service: 'На услуги',
};
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
