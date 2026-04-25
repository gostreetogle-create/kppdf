import { Kp } from '../models/kp.model';
import { Setting, DEFAULT_SETTINGS } from '../models/settings.model';
import { Counterparty } from '../models/counterparty.model';

const KP_TYPE_VALUES = ['standard', 'response', 'special', 'tender', 'service'] as const;
type KpType = (typeof KP_TYPE_VALUES)[number];

const KP_TYPE_NUMBER_PREFIX: Record<KpType, string> = {
  standard: 'КП',
  response: 'ПИСЬМО',
  special: 'КП',
  tender: 'КП',
  service: 'КП'
};

function numberPrefixForType(kpType: KpType): string {
  return KP_TYPE_NUMBER_PREFIX[kpType] ?? 'КП';
}

function isAutoNumberForType(value: string, kpType: KpType): boolean {
  const prefix = numberPrefixForType(kpType);
  return new RegExp(`^${prefix}-\\d+$`).test(value);
}

function normalizeTemplateConditions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((value) => String(value ?? '').trim()).filter(Boolean);
}

function normalizeTemplateAssetsByType(kpType: KpType, assets: any) {
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

function normalizeSnapshotTexts(texts: any) {
  return {
    headerNote: String(texts?.headerNote ?? '').trim(),
    introText: String(texts?.introText ?? '').trim(),
    footerText: String(texts?.footerText ?? '').trim(),
    closingText: String(texts?.closingText ?? '').trim(),
  };
}

function isCompanyInitiator(company: any): boolean {
  return Boolean(
    company &&
      (company.isOurCompany === true ||
        (Array.isArray(company.role) && company.role.includes('company')))
  );
}

async function resolveCompanyInitiator(preferredCompanyId?: string) {
  if (preferredCompanyId) {
    const company = await Counterparty.findById(preferredCompanyId)
      .select('isOurCompany role name shortName status inn kpp ogrn phone email brandingTemplates defaultMarkupPercent defaultDiscountPercent isDefaultInitiator')
      .lean();
    if (isCompanyInitiator(company)) return company;
    return null;
  }
  const all = await Counterparty.find({
    status: 'active',
    $or: [{ isOurCompany: true }, { role: 'company' }]
  })
    .select('isOurCompany role name shortName status inn kpp ogrn phone email brandingTemplates defaultMarkupPercent defaultDiscountPercent isDefaultInitiator')
    .lean();
  if (!all.length) return null;
  return all.find((item: any) => item.isDefaultInitiator === true) ?? all[0];
}

function resolveTemplateForType(templates: any[], kpType: KpType, templateKey?: string): any | null {
  if (templateKey) {
    return templates.find((template: any) =>
      String(template?.key ?? '') === templateKey && String(template?.kpType ?? '') === kpType
    ) ?? null;
  }
  const templatesByType = templates.filter((template: any) => String(template?.kpType ?? '') === kpType);
  return templatesByType.find((template: any) => template?.isDefault === true)
    ?? templatesByType[0]
    ?? null;
}

export class KpService {
  private async generateDocNumber(kpType: KpType): Promise<string> {
    const prefix = numberPrefixForType(kpType);
    const regex = new RegExp(`^${prefix}-\\d+$`);
    const all = await Kp.find({ 'metadata.number': { $regex: regex } }, { 'metadata.number': 1 }).lean();
    const maxSerial = all.reduce((max, doc) => {
      const value = typeof doc?.metadata?.number === 'string' ? doc.metadata.number : '';
      const match = new RegExp(`^${prefix}-(\\d+)$`).exec(value);
      if (!match) return max;
      return Math.max(max, Number(match[1]));
    }, 0);
    return `${prefix}-${String(maxSerial + 1).padStart(3, '0')}`;
  }

  private async getKpSettings() {
    const settings = await Setting.find({ key: { $in: DEFAULT_SETTINGS.map((s) => s.key) } });
    const map: Record<string, unknown> = {};
    DEFAULT_SETTINGS.forEach((s) => { map[s.key] = s.value; });
    settings.forEach((s) => { map[s.key] = s.value; });
    return map;
  }

  async list() {
    return Kp.find().sort({ createdAt: -1 });
  }

  async getById(id: string) {
    return Kp.findById(id);
  }

  async create(data: any) {
    const body = { ...data };
    const companyId = String(body.companyId ?? '').trim() || undefined;
    const kpType = (String(body.kpType ?? '').trim() as KpType) || 'standard';
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

    const templates = Array.isArray((company as any).brandingTemplates) ? (company as any).brandingTemplates : [];
    const selectedTemplate = resolveTemplateForType(templates, kpType, templateKey);
    if (!selectedTemplate) {
      throw new Error(
        templateKey
          ? 'Выбранный шаблон не найден для указанного типа КП'
          : `Для типа КП "${kpType}" не найдено ни одного шаблона. Настройте шаблоны в карточке компании.`
      );
    }

    const kpPage1 = String(selectedTemplate?.assets?.kpPage1 ?? '').trim();
    if (!kpPage1) {
      throw new Error('Выбранный шаблон не содержит обязательный фон первой страницы (assets.kpPage1)');
    }

    const templateAssets = normalizeTemplateAssetsByType(kpType, selectedTemplate?.assets);
    body.companyId = String((company as any)._id);
    body.kpType = kpType;
    body.companySnapshot = {
      companyId: (company as any)._id,
      companyName: String(company.shortName || company.name || '').trim(),
      templateKey: String(selectedTemplate.key),
      templateName: String(selectedTemplate.name),
      kpType,
      assets: templateAssets,
      texts: { headerNote: '', introText: '', footerText: '', closingText: '' },
      requisitesSnapshot: {
        inn: String((company as any).inn ?? '').trim() || undefined,
        kpp: String((company as any).kpp ?? '').trim() || undefined,
        ogrn: String((company as any).ogrn ?? '').trim() || undefined,
        phone: String((company as any).phone ?? '').trim() || undefined,
        email: String((company as any).email ?? '').trim() || undefined,
      }
    };
    if (!body.companySnapshot.companyName) {
      throw new Error('У выбранной компании не заполнено название для брендирования КП');
    }
    const hasRequestConditions = Array.isArray(body.conditions) && body.conditions.length > 0;
    if (!hasRequestConditions) {
      body.conditions = normalizeTemplateConditions(selectedTemplate?.conditions);
    }
    body.metadata.defaultMarkupPercent = Number((company as any).defaultMarkupPercent ?? body.metadata.defaultMarkupPercent ?? 0) || 0;
    body.metadata.defaultDiscountPercent = Number((company as any).defaultDiscountPercent ?? body.metadata.defaultDiscountPercent ?? 0) || 0;

    return Kp.create(body);
  }

  async duplicate(id: string) {
    const original = await Kp.findById(id);
    if (!original) return null;
    const sourceType = ((original as any).kpType ?? original.companySnapshot?.kpType ?? 'standard') as KpType;
    const generatedNumber = await this.generateDocNumber(sourceType);

    return Kp.create({
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

  async switchType(id: string, payload: any) {
    const kp = await Kp.findById(id);
    if (!kp) return null;
    const nextType = String(payload?.kpType ?? '').trim() as KpType;
    if (!KP_TYPE_VALUES.includes(nextType)) {
      throw new Error('Некорректный kpType');
    }
    const templateKey = String(payload?.templateKey ?? '').trim() || undefined;

    const resolvedCompanyId =
      String(payload?.companyId ?? '').trim()
      || String((kp.companyId as any) ?? '').trim()
      || String((kp.companySnapshot as any)?.companyId ?? '').trim();
    if (!resolvedCompanyId) {
      throw new Error('В КП не указан companyId (ни в корне, ни в companySnapshot)');
    }

    const company = await resolveCompanyInitiator(resolvedCompanyId);
    if (!company || !isCompanyInitiator(company)) {
      throw new Error('Компания-инициатор не найдена или не является нашей компанией');
    }

    const templates = Array.isArray((company as any).brandingTemplates) ? (company as any).brandingTemplates : [];
    const selectedTemplate = resolveTemplateForType(templates, nextType, templateKey);
    if (!selectedTemplate) {
      throw new Error(
        templateKey
          ? 'Выбранный шаблон не найден для указанного типа КП'
          : `Для типа КП "${nextType}" не найдено ни одного шаблона. Настройте шаблоны в карточке компании.`
      );
    }
    const kpPage1 = String(selectedTemplate?.assets?.kpPage1 ?? '').trim();
    if (!kpPage1) {
      throw new Error(`Шаблон "${selectedTemplate?.name || selectedTemplate?.key}" не содержит assets.kpPage1`);
    }

    const prevType = ((kp as any).kpType ?? kp.companySnapshot?.kpType ?? 'standard') as KpType;
    const currentNumber = String(kp.metadata?.number ?? '').trim();
    const nextNumber = isAutoNumberForType(currentNumber, prevType)
      ? await this.generateDocNumber(nextType)
      : currentNumber;

    const previousTemplate = resolveTemplateForType(
      templates,
      prevType,
      String(kp.companySnapshot?.templateKey ?? '').trim() || undefined
    );
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
      tablePageBreakFirstPage: Math.max(1, Number((kp.metadata as any)?.tablePageBreakFirstPage ?? (kp.metadata as any)?.tablePageBreakAfter ?? 4) || 4),
      tablePageBreakNextPages: Math.max(1, Number((kp.metadata as any)?.tablePageBreakNextPages ?? (kp.metadata as any)?.tablePageBreakAfter ?? 6) || 6),
      defaultMarkupPercent: Number((company as any).defaultMarkupPercent ?? kp.metadata?.defaultMarkupPercent ?? 0) || 0,
      defaultDiscountPercent: Number((company as any).defaultDiscountPercent ?? kp.metadata?.defaultDiscountPercent ?? 0) || 0,
    };

    kp.companyId = String((company as any)._id);
    kp.kpType = nextType;
    kp.metadata = nextMetadata as any;
    kp.conditions = nextConditions;
    kp.companySnapshot = {
      ...kp.companySnapshot,
      companyId: company._id as any,
      companyName: String((company as any).shortName || (company as any).name || kp.companySnapshot.companyName || ''),
      templateKey: String(selectedTemplate.key),
      templateName: String(selectedTemplate.name),
      kpType: nextType,
      assets: normalizeTemplateAssetsByType(nextType, selectedTemplate.assets) as any,
      texts: normalizeSnapshotTexts((kp.companySnapshot as any)?.texts),
      requisitesSnapshot: {
        inn: String((company as any).inn ?? '').trim() || undefined,
        kpp: String((company as any).kpp ?? '').trim() || undefined,
        ogrn: String((company as any).ogrn ?? '').trim() || undefined,
        phone: String((company as any).phone ?? '').trim() || undefined,
        email: String((company as any).email ?? '').trim() || undefined,
      }
    } as any;

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

  async updateKp(id: string, data: any) {
    return Kp.findByIdAndUpdate(
      id,
      { $set: data },
      { runValidators: true, new: true, context: 'query' }
    );
  }

  async remove(id: string) {
    return Kp.findByIdAndDelete(id);
  }
}

export const kpService = new KpService();
