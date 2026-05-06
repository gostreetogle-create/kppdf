"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kpService = exports.KpService = void 0;
const kp_model_1 = require("../models/kp.model");
const settings_model_1 = require("../models/settings.model");
const counterparty_model_1 = require("../models/counterparty.model");
const Kp_1 = require("../../../shared/types/Kp");
const KP_TYPE_VALUES = ['standard', 'response', 'special', 'tender', 'service'];
const KP_TYPE_NUMBER_PREFIX = {
    standard: 'КП',
    response: 'ПИСЬМО',
    special: 'КП',
    tender: 'КП',
    service: 'КП'
};
function numberPrefixForType(kpType) {
    return KP_TYPE_NUMBER_PREFIX[kpType] ?? 'КП';
}
function isAutoNumberForType(value, kpType) {
    const prefix = numberPrefixForType(kpType);
    return new RegExp(`^${prefix}-\\d+$`).test(value);
}
function normalizeTemplateConditions(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw.map((value) => String(value ?? '').trim()).filter(Boolean);
}
function normalizeTemplateAssetsByType(kpType, assets) {
    const normalized = {
        kpPage1: String(assets?.kpPage1 ?? '').trim(),
        kpPage2: String(assets?.kpPage2 ?? '').trim() || undefined,
        passport: String(assets?.passport ?? '').trim() || undefined,
        appendix: String(assets?.appendix ?? '').trim() || undefined,
    };
    if (kpType === 'response') {
        return { kpPage1: normalized.kpPage1 };
    }
    return normalized;
}
function normalizeSnapshotTexts(texts) {
    return {
        headerNote: String(texts?.headerNote ?? '').trim(),
        introText: String(texts?.introText ?? '').trim(),
        footerText: String(texts?.footerText ?? '').trim(),
        closingText: String(texts?.closingText ?? '').trim(),
    };
}
function isCompanyInitiator(company) {
    return Boolean(company &&
        (company.isOurCompany === true ||
            (Array.isArray(company.role) && company.role.includes('company'))));
}
async function resolveCompanyInitiator(preferredCompanyId) {
    if (preferredCompanyId) {
        const company = await counterparty_model_1.Counterparty.findById(preferredCompanyId)
            .select('isOurCompany role name shortName status inn kpp ogrn phone email brandingTemplates defaultMarkupPercent defaultDiscountPercent isDefaultInitiator')
            .lean();
        if (isCompanyInitiator(company))
            return company;
        return null;
    }
    const all = await counterparty_model_1.Counterparty.find({
        status: 'active',
        $or: [{ isOurCompany: true }, { role: 'company' }]
    })
        .select('isOurCompany role name shortName status inn kpp ogrn phone email brandingTemplates defaultMarkupPercent defaultDiscountPercent isDefaultInitiator')
        .lean();
    if (!all.length)
        return null;
    return all.find((item) => item.isDefaultInitiator === true) ?? all[0];
}
function resolveTemplateForType(templates, kpType, templateKey) {
    if (templateKey) {
        return templates.find((template) => String(template?.key ?? '') === templateKey && String(template?.kpType ?? '') === kpType) ?? null;
    }
    const templatesByType = templates.filter((template) => String(template?.kpType ?? '') === kpType);
    return templatesByType.find((template) => template?.isDefault === true)
        ?? templatesByType[0]
        ?? null;
}
class KpService {
    async generateDocNumber(kpType) {
        const prefix = numberPrefixForType(kpType);
        const regex = new RegExp(`^${prefix}-\\d+$`);
        const all = await kp_model_1.Kp.find({ 'metadata.number': { $regex: regex } }, { 'metadata.number': 1 }).lean();
        const maxSerial = all.reduce((max, doc) => {
            const value = typeof doc?.metadata?.number === 'string' ? doc.metadata.number : '';
            const match = new RegExp(`^${prefix}-(\\d+)$`).exec(value);
            if (!match)
                return max;
            return Math.max(max, Number(match[1]));
        }, 0);
        return `${prefix}-${String(maxSerial + 1).padStart(3, '0')}`;
    }
    async getKpSettings() {
        const settings = await settings_model_1.Setting.find({ key: { $in: settings_model_1.DEFAULT_SETTINGS.map((s) => s.key) } });
        const map = {};
        settings_model_1.DEFAULT_SETTINGS.forEach((s) => { map[s.key] = s.value; });
        settings.forEach((s) => { map[s.key] = s.value; });
        return map;
    }
    async list() {
        return kp_model_1.Kp.find().sort({ createdAt: -1 });
    }
    async getById(id) {
        return kp_model_1.Kp.findById(id);
    }
    async create(data) {
        const body = { ...data };
        const companyId = String(body.companyId ?? '').trim() || undefined;
        const kpType = String(body.kpType ?? '').trim() || 'standard';
        const templateKey = String(body.templateKey ?? '').trim();
        if (!KP_TYPE_VALUES.includes(kpType)) {
            throw new Error('kpType обязателен и должен быть одним из: standard, response, special, tender, service');
        }
        if (!body.metadata?.validityDays) {
            const generatedNumber = await this.generateDocNumber(kpType);
            const s = await this.getKpSettings();
            body.metadata = {
                number: body.metadata?.number ?? generatedNumber,
                validityDays: s['kp_validity_days'],
                prepaymentPercent: s['kp_prepayment_percent'],
                productionDays: s['kp_production_days'],
                tablePageBreakAfter: body.metadata?.tablePageBreakAfter ?? 6,
                tablePageBreakFirstPage: body.metadata?.tablePageBreakFirstPage ?? body.metadata?.tablePageBreakAfter ?? 4,
                tablePageBreakNextPages: body.metadata?.tablePageBreakNextPages ?? body.metadata?.tablePageBreakAfter ?? 6,
                photoScalePercent: body.metadata?.photoScalePercent ?? 600,
                showPhotoColumn: body.metadata?.showPhotoColumn ?? true,
                defaultMarkupPercent: body.metadata?.defaultMarkupPercent ?? 0,
                defaultDiscountPercent: body.metadata?.defaultDiscountPercent ?? 0,
            };
            body.vatPercent = body.vatPercent ?? s['kp_vat_percent'];
        }
        if (!body.metadata?.number) {
            body.metadata = { ...body.metadata, number: await this.generateDocNumber(kpType) };
        }
        body.metadata = {
            ...body.metadata,
            tablePageBreakAfter: Math.max(1, Number(body.metadata?.tablePageBreakAfter ?? 6) || 6),
            tablePageBreakFirstPage: Math.max(1, Number(body.metadata?.tablePageBreakFirstPage ?? body.metadata?.tablePageBreakAfter ?? 4) || 4),
            tablePageBreakNextPages: Math.max(1, Number(body.metadata?.tablePageBreakNextPages ?? body.metadata?.tablePageBreakAfter ?? 6) || 6),
            photoScalePercent: body.metadata?.photoScalePercent ?? 600,
            showPhotoColumn: body.metadata?.showPhotoColumn ?? true,
            defaultMarkupPercent: Number(body.metadata?.defaultMarkupPercent ?? 0) || 0,
            defaultDiscountPercent: Number(body.metadata?.defaultDiscountPercent ?? 0) || 0,
        };
        const company = await resolveCompanyInitiator(companyId);
        if (!company) {
            throw new Error('Компания-инициатор не найдена или не является нашей компанией');
        }
        const templates = Array.isArray(company.brandingTemplates) ? company.brandingTemplates : [];
        const selectedTemplate = resolveTemplateForType(templates, kpType, templateKey);
        if (!selectedTemplate) {
            throw new Error(templateKey
                ? 'Выбранный шаблон не найден для указанного типа КП'
                : `Для типа КП "${kpType}" не найдено ни одного шаблона. Настройте шаблоны в карточке компании.`);
        }
        const kpPage1 = String(selectedTemplate?.assets?.kpPage1 ?? '').trim();
        if (!kpPage1) {
            throw new Error('Выбранный шаблон не содержит обязательный фон первой страницы (assets.kpPage1)');
        }
        const templateAssets = normalizeTemplateAssetsByType(kpType, selectedTemplate?.assets);
        body.companyId = String(company._id);
        body.kpType = kpType;
        body.companySnapshot = {
            companyId: company._id,
            companyName: String(company.shortName || company.name || '').trim(),
            templateKey: String(selectedTemplate.key),
            templateName: String(selectedTemplate.name),
            kpType,
            assets: templateAssets,
            texts: { headerNote: '', introText: '', footerText: '', closingText: '' },
            requisitesSnapshot: {
                inn: String(company.inn ?? '').trim() || undefined,
                kpp: String(company.kpp ?? '').trim() || undefined,
                ogrn: String(company.ogrn ?? '').trim() || undefined,
                phone: String(company.phone ?? '').trim() || undefined,
                email: String(company.email ?? '').trim() || undefined,
            }
        };
        if (!body.companySnapshot.companyName) {
            throw new Error('У выбранной компании не заполнено название для брендирования КП');
        }
        const hasRequestConditions = Array.isArray(body.conditions) && body.conditions.length > 0;
        if (!hasRequestConditions) {
            body.conditions = normalizeTemplateConditions(selectedTemplate?.conditions);
        }
        body.metadata.defaultMarkupPercent = Number(company.defaultMarkupPercent ?? body.metadata.defaultMarkupPercent ?? 0) || 0;
        body.metadata.defaultDiscountPercent = Number(company.defaultDiscountPercent ?? body.metadata.defaultDiscountPercent ?? 0) || 0;
        return kp_model_1.Kp.create(body);
    }
    async duplicate(id) {
        const original = await kp_model_1.Kp.findById(id);
        if (!original)
            return null;
        const sourceType = (original.kpType ?? original.companySnapshot?.kpType ?? 'standard');
        const generatedNumber = await this.generateDocNumber(sourceType);
        return kp_model_1.Kp.create({
            title: `Копия — ${original.title}`,
            status: 'draft',
            companyId: original.companyId,
            kpType: sourceType,
            companySnapshot: original.companySnapshot,
            recipient: original.recipient,
            metadata: { ...original.metadata, number: generatedNumber },
            items: original.items,
            conditions: original.conditions,
            vatPercent: original.vatPercent,
        });
    }
    async createRevision(id) {
        const original = await kp_model_1.Kp.findById(id);
        if (!original)
            return null;
        const currentNumber = String(original.metadata?.number ?? '').trim();
        let nextNumber = currentNumber;
        if (currentNumber) {
            // Ищем суффикс _N в конце номера
            const match = currentNumber.match(/_(\d+)$/);
            if (match) {
                const version = parseInt(match[1], 10);
                nextNumber = currentNumber.replace(/_(\d+)$/, `_${version + 1}`);
            }
            else {
                nextNumber = `${currentNumber}_1`;
            }
        }
        const sourceType = (original.kpType ?? original.companySnapshot?.kpType ?? 'standard');
        return kp_model_1.Kp.create({
            title: original.title, // Для ревизии оставляем то же название
            status: 'draft',
            companyId: original.companyId,
            kpType: sourceType,
            companySnapshot: original.companySnapshot,
            recipient: original.recipient,
            metadata: { ...original.metadata, number: nextNumber },
            items: original.items,
            conditions: original.conditions,
            vatPercent: original.vatPercent,
        });
    }
    async switchType(id, payload) {
        const kp = await kp_model_1.Kp.findById(id);
        if (!kp)
            return null;
        const nextType = String(payload?.kpType ?? '').trim();
        if (!KP_TYPE_VALUES.includes(nextType)) {
            throw new Error('Некорректный kpType');
        }
        const templateKey = String(payload?.templateKey ?? '').trim() || undefined;
        const resolvedCompanyId = String(payload?.companyId ?? '').trim()
            || String(kp.companyId ?? '').trim()
            || String(kp.companySnapshot?.companyId ?? '').trim();
        if (!resolvedCompanyId) {
            throw new Error('В КП не указан companyId (ни в корне, ни в companySnapshot)');
        }
        const company = await resolveCompanyInitiator(resolvedCompanyId);
        if (!company || !isCompanyInitiator(company)) {
            throw new Error('Компания-инициатор не найдена или не является нашей компанией');
        }
        const templates = Array.isArray(company.brandingTemplates) ? company.brandingTemplates : [];
        const selectedTemplate = resolveTemplateForType(templates, nextType, templateKey);
        if (!selectedTemplate) {
            throw new Error(templateKey
                ? 'Выбранный шаблон не найден для указанного типа КП'
                : `Для типа КП "${nextType}" не найдено ни одного шаблона. Настройте шаблоны в карточке компании.`);
        }
        const kpPage1 = String(selectedTemplate?.assets?.kpPage1 ?? '').trim();
        if (!kpPage1) {
            throw new Error(`Шаблон "${selectedTemplate?.name || selectedTemplate?.key}" не содержит assets.kpPage1`);
        }
        const prevType = (kp.kpType ?? kp.companySnapshot?.kpType ?? 'standard');
        const currentNumber = String(kp.metadata?.number ?? '').trim();
        const nextNumber = isAutoNumberForType(currentNumber, prevType)
            ? await this.generateDocNumber(nextType)
            : currentNumber;
        const previousTemplate = resolveTemplateForType(templates, prevType, String(kp.companySnapshot?.templateKey ?? '').trim() || undefined);
        const currentConditions = normalizeTemplateConditions(kp.conditions);
        const previousTemplateConditions = normalizeTemplateConditions(previousTemplate?.conditions);
        const nextTemplateConditions = normalizeTemplateConditions(selectedTemplate?.conditions);
        const shouldReplaceConditions = payload?.overwriteConditions === true
            || (currentConditions.length === previousTemplateConditions.length
                && currentConditions.every((value, index) => value === previousTemplateConditions[index]));
        const nextConditions = shouldReplaceConditions ? nextTemplateConditions : kp.conditions;
        const nextMetadata = {
            ...kp.metadata,
            number: nextNumber,
            tablePageBreakFirstPage: Math.max(1, Number(kp.metadata?.tablePageBreakFirstPage ?? kp.metadata?.tablePageBreakAfter ?? 4) || 4),
            tablePageBreakNextPages: Math.max(1, Number(kp.metadata?.tablePageBreakNextPages ?? kp.metadata?.tablePageBreakAfter ?? 6) || 6),
            defaultMarkupPercent: Number(company.defaultMarkupPercent ?? kp.metadata?.defaultMarkupPercent ?? 0) || 0,
            defaultDiscountPercent: Number(company.defaultDiscountPercent ?? kp.metadata?.defaultDiscountPercent ?? 0) || 0,
        };
        kp.companyId = String(company._id);
        kp.kpType = nextType;
        kp.metadata = nextMetadata;
        kp.conditions = nextConditions;
        kp.companySnapshot = {
            ...kp.companySnapshot,
            companyId: company._id,
            companyName: String(company.shortName || company.name || kp.companySnapshot.companyName || ''),
            templateKey: String(selectedTemplate.key),
            templateName: String(selectedTemplate.name),
            kpType: nextType,
            assets: normalizeTemplateAssetsByType(nextType, selectedTemplate.assets),
            texts: normalizeSnapshotTexts(kp.companySnapshot?.texts),
            requisitesSnapshot: {
                inn: String(company.inn ?? '').trim() || undefined,
                kpp: String(company.kpp ?? '').trim() || undefined,
                ogrn: String(company.ogrn ?? '').trim() || undefined,
                phone: String(company.phone ?? '').trim() || undefined,
                email: String(company.email ?? '').trim() || undefined,
            }
        };
        await kp.save();
        return {
            kp,
            meta: {
                conditionsReplaced: shouldReplaceConditions,
                previousKpType: prevType,
                nextKpType: nextType
            }
        };
    }
    async listVersions(id) {
        const kp = await kp_model_1.Kp.findById(id).select('versions').lean();
        if (!kp)
            return null;
        const versions = Array.isArray(kp.versions) ? kp.versions : [];
        return versions.map((v) => ({
            version: Number(v?.version) || 0,
            createdAt: (v?.createdAt instanceof Date ? v.createdAt : new Date(v?.createdAt)).toISOString(),
            status: v?.status,
            number: String(v?.number ?? v?.metadata?.number ?? ''),
            title: String(v?.title ?? '')
        })).filter((v) => v.version > 0 && v.number && v.title);
    }
    async getVersionSnapshot(id, version) {
        const kp = await kp_model_1.Kp.findById(id).lean();
        if (!kp)
            return null;
        const entry = Array.isArray(kp.versions)
            ? kp.versions.find((v) => Number(v?.version) === version)
            : null;
        if (!entry)
            return null;
        const createdAt = entry.createdAt instanceof Date ? entry.createdAt : new Date(entry.createdAt);
        return {
            _id: String(kp._id),
            title: String(entry.title),
            status: entry.status,
            kpType: entry.kpType,
            counterpartyId: entry.counterpartyId,
            companyId: entry.companyId,
            recipient: entry.recipient,
            metadata: {
                ...entry.metadata,
                number: entry.number ?? entry.metadata?.number,
                createdAt: createdAt.toISOString(),
            },
            items: (entry.items ?? []).map((item) => ({
                ...item,
                markupEnabled: !!item.markupEnabled,
                markupPercent: item.markupPercent ?? 0,
                discountEnabled: !!item.discountEnabled,
                discountPercent: item.discountPercent ?? 0,
            })),
            companySnapshot: entry.companySnapshot
                ? { ...entry.companySnapshot, companyId: String(entry.companySnapshot.companyId) }
                : entry.companySnapshot,
            conditions: entry.conditions ?? [],
            vatPercent: entry.vatPercent,
            createdAt: createdAt.toISOString(),
            updatedAt: createdAt.toISOString(),
            versions: Array.isArray(kp.versions)
                ? kp.versions.map((v) => ({
                    version: Number(v?.version) || 0,
                    createdAt: (v?.createdAt instanceof Date ? v.createdAt : new Date(v?.createdAt)).toISOString(),
                    status: v?.status,
                    number: String(v?.number ?? v?.metadata?.number ?? ''),
                    title: String(v?.title ?? '')
                })).filter((v) => v.version > 0 && v.number && v.title)
                : [],
        };
    }
    async createVersion(id) {
        const kp = await kp_model_1.Kp.findById(id);
        if (!kp)
            return null;
        const nextVersion = Array.isArray(kp.versions) ? kp.versions.length + 1 : 1;
        kp.versions = Array.isArray(kp.versions) ? kp.versions : [];
        kp.versions.push({
            version: nextVersion,
            status: kp.status,
            number: String(kp.metadata?.number ?? ''),
            title: kp.title,
            kpType: kp.kpType,
            counterpartyId: kp.counterpartyId,
            companyId: kp.companyId,
            recipient: kp.recipient,
            metadata: kp.metadata,
            items: kp.items,
            companySnapshot: kp.companySnapshot,
            conditions: kp.conditions,
            vatPercent: kp.vatPercent,
        });
        await kp.save();
        return kp;
    }
    async updateKp(id, data) {
        const kp = await kp_model_1.Kp.findById(id);
        if (!kp)
            return null;
        const nextStatus = typeof data?.status === 'string' ? data.status : undefined;
        const currentStatus = kp.status;
        const isDraft = currentStatus === 'draft';
        const isStatusChange = Boolean(nextStatus && nextStatus !== currentStatus);
        if (nextStatus && nextStatus !== currentStatus) {
            const allowed = Kp_1.KP_STATUS_TRANSITIONS[currentStatus] ?? [];
            if (!allowed.includes(nextStatus)) {
                throw new Error(`Недопустимый переход статуса: ${currentStatus} → ${nextStatus}`);
            }
        }
        if (!isDraft && !isStatusChange) {
            throw new Error(`КП в статусе «${currentStatus}» доступно только для смены статуса`);
        }
        if (!isDraft && isStatusChange) {
            kp.status = nextStatus;
        }
        else {
            const allowedKeys = [
                'title',
                'status',
                'kpType',
                'counterpartyId',
                'companyId',
                'recipient',
                'metadata',
                'items',
                'conditions',
                'vatPercent',
                'companySnapshot'
            ];
            allowedKeys.forEach((key) => {
                if (Object.prototype.hasOwnProperty.call(data ?? {}, key)) {
                    kp[key] = data[key];
                }
            });
        }
        await kp.validate();
        await kp.save();
        if (nextStatus && nextStatus !== currentStatus && nextStatus !== 'draft') {
            await this.createVersion(id);
            return kp_model_1.Kp.findById(id);
        }
        return kp;
    }
    async remove(id) {
        return kp_model_1.Kp.findByIdAndDelete(id);
    }
}
exports.KpService = KpService;
exports.kpService = new KpService();
