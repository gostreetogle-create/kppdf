import { Product } from '../models/product.model';
import { ProductSpec } from '../models/product-spec.model';
import { Setting } from '../models/settings.model';

interface ProductSpecPayload {
  drawings?: {
    viewFront?: string;
    viewSide?: string;
    viewTop?: string;
    view3D?: string;
  };
  groups?: Array<{
    title?: string;
    params?: Array<{ name?: string; value?: string }>;
  }>;
}

interface ProductSpecTemplate {
  key: string;
  name: string;
  groups: Array<{ title: string; params: Array<{ name: string; value: string }> }>;
}

const PRODUCT_SPEC_TEMPLATES_KEY = 'product_spec_templates_v1';

const FALLBACK_TEMPLATES: ProductSpecTemplate[] = [
  {
    key: 'sport-stand',
    name: 'Спортивный стенд',
    groups: [
      {
        title: 'Габариты',
        params: [
          { name: 'Длина', value: '2000 мм' },
          { name: 'Ширина', value: '800 мм' },
          { name: 'Высота', value: '2400 мм' }
        ]
      },
      {
        title: 'Материалы',
        params: [
          { name: 'Каркас', value: 'Сталь порошковая окраска' },
          { name: 'Панели', value: 'Фанера влагостойкая' }
        ]
      }
    ]
  },
  {
    key: 'maf',
    name: 'Малая архитектурная форма',
    groups: [
      {
        title: 'Основание',
        params: [
          { name: 'Тип основания', value: 'Закладные детали' },
          { name: 'Тип монтажа', value: 'Анкерное крепление' }
        ]
      },
      {
        title: 'Эксплуатация',
        params: [
          { name: 'Температура', value: 'от -40 до +40 C' },
          { name: 'Гарантия', value: '12 месяцев' }
        ]
      }
    ]
  },
  {
    key: 'pavilion',
    name: 'Павильон',
    groups: [
      {
        title: 'Конструкция',
        params: [
          { name: 'Несущий профиль', value: 'Труба 80x80 мм' },
          { name: 'Заполнение', value: 'Монолитный поликарбонат' }
        ]
      },
      {
        title: 'Кровля и водоотвод',
        params: [
          { name: 'Тип кровли', value: 'Односкатная' },
          { name: 'Водоотвод', value: 'Скрытый' }
        ]
      }
    ]
  }
];

function normalizeTemplates(raw: unknown): ProductSpecTemplate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const key = String((item as any)?.key ?? '').trim();
      const name = String((item as any)?.name ?? '').trim();
      const groupsRaw = Array.isArray((item as any)?.groups) ? (item as any).groups : [];
      const groups = groupsRaw
        .map((group: any) => ({
          title: String(group?.title ?? '').trim(),
          params: (Array.isArray(group?.params) ? group.params : [])
            .map((param: any) => ({
              name: String(param?.name ?? '').trim(),
              value: String(param?.value ?? '').trim()
            }))
            .filter((param: any) => param.name && param.value)
        }))
        .filter((group: any) => group.title && group.params.length > 0);
      if (!key || !name || !groups.length) return null;
      return { key, name, groups };
    })
    .filter((item): item is ProductSpecTemplate => !!item);
}

function normalizePayload(payload: ProductSpecPayload) {
  const drawings = payload.drawings ?? {};
  const groupsRaw = Array.isArray(payload.groups) ? payload.groups : [];
  return {
    drawings: {
      viewFront: String(drawings.viewFront ?? '').trim() || undefined,
      viewSide: String(drawings.viewSide ?? '').trim() || undefined,
      viewTop: String(drawings.viewTop ?? '').trim() || undefined,
      view3D: String(drawings.view3D ?? '').trim() || undefined
    },
    groups: groupsRaw
      .map((group) => ({
        title: String(group?.title ?? '').trim(),
        params: (Array.isArray(group?.params) ? group.params : [])
          .map((param) => ({
            name: String(param?.name ?? '').trim(),
            value: String(param?.value ?? '').trim()
          }))
          .filter((param) => param.name && param.value)
      }))
      .filter((group) => group.title && group.params.length > 0)
  };
}

export class ProductSpecService {
  async list() {
    return ProductSpec.find().sort({ updatedAt: -1 }).lean();
  }

  async getById(id: string) {
    return ProductSpec.findById(id).lean();
  }

  async getSpecByProductId(productId: string) {
    return ProductSpec.findOne({ productId }).lean();
  }

  async getTemplates(): Promise<ProductSpecTemplate[]> {
    const setting = await Setting.findOne({ key: PRODUCT_SPEC_TEMPLATES_KEY }).lean();
    const fromSettings = normalizeTemplates(setting?.value);
    if (fromSettings.length) return fromSettings;
    return FALLBACK_TEMPLATES;
  }

  async create(payload: { productId?: string } & ProductSpecPayload) {
    const productId = String(payload.productId ?? '').trim();
    if (!productId) throw new Error('productId обязателен');
    const productExists = await Product.exists({ _id: productId });
    if (!productExists) throw new Error('Товар не найден');
    const normalized = normalizePayload(payload);
    return ProductSpec.create({
      productId,
      drawings: normalized.drawings,
      groups: normalized.groups
    });
  }

  async update(id: string, payload: ProductSpecPayload) {
    const normalized = normalizePayload(payload);
    return ProductSpec.findByIdAndUpdate(
      id,
      { $set: normalized },
      { new: true, runValidators: true }
    ).lean();
  }

  async upsertSpec(productId: string, payload: ProductSpecPayload) {
    const normalizedProductId = String(productId ?? '').trim();
    if (!normalizedProductId) throw new Error('productId обязателен');
    const productExists = await Product.exists({ _id: normalizedProductId });
    if (!productExists) throw new Error('Товар не найден');
    const normalized = normalizePayload(payload);
    return ProductSpec.findOneAndUpdate(
      { productId: normalizedProductId },
      {
        $set: {
          productId: normalizedProductId,
          drawings: normalized.drawings,
          groups: normalized.groups
        }
      },
      { new: true, upsert: true, runValidators: true }
    ).lean();
  }

  // Backward-compatible aliases for existing callers.
  async getSpecsByProductId(productId: string) {
    return this.getSpecByProductId(productId);
  }

  async upsertSpecs(productId: string, payload: ProductSpecPayload) {
    return this.upsertSpec(productId, payload);
  }

  async remove(id: string) {
    return ProductSpec.findByIdAndDelete(id).lean();
  }
}

export const productSpecService = new ProductSpecService();
