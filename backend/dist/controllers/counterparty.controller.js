"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CounterpartyController = void 0;
const counterparty_model_1 = require("../models/counterparty.model");
const KP_TYPE_LABELS = {
    standard: 'КП',
    response: 'Ответ на письмо',
    special: 'Спецпредложение',
    tender: 'Для тендера',
    service: 'На услуги',
};
const KP_TYPES_ORDER = ['standard', 'response', 'special', 'tender', 'service'];
class CounterpartyController {
    constructor() {
        this.getBrandingTemplates = async (req, res) => {
            try {
                const company = await counterparty_model_1.Counterparty.findById(req.params.id)
                    .select('isOurCompany role brandingTemplates')
                    .lean();
                if (!company) {
                    res.status(404).json({ message: 'Контрагент не найден' });
                    return;
                }
                const isOurCompany = company.isOurCompany === true || (Array.isArray(company.role) && company.role.includes('company'));
                if (!isOurCompany) {
                    res.status(400).json({ message: 'Выбранный контрагент не является нашей компанией' });
                    return;
                }
                const templates = Array.isArray(company.brandingTemplates) ? company.brandingTemplates : [];
                const templatesByType = {};
                const defaultByType = {};
                for (const kpType of KP_TYPES_ORDER) {
                    templatesByType[kpType] = [];
                }
                for (const template of templates) {
                    const kpType = String(template?.kpType ?? '');
                    if (!KP_TYPES_ORDER.includes(kpType))
                        continue;
                    templatesByType[kpType].push({
                        key: String(template.key),
                        name: String(template.name),
                        isDefault: Boolean(template.isDefault),
                    });
                    if (template.isDefault) {
                        defaultByType[kpType] = String(template.key);
                    }
                }
                const kpTypes = KP_TYPES_ORDER
                    .filter((kpType) => templatesByType[kpType].length > 0)
                    .map((kpType) => ({ value: kpType, label: KP_TYPE_LABELS[kpType] }));
                res.json({ kpTypes, templatesByType, defaultByType });
            }
            catch {
                res.status(500).json({ message: 'Ошибка сервера' });
            }
        };
    }
}
exports.CounterpartyController = CounterpartyController;
