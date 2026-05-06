"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapKpToDto = mapKpToDto;
/**
 * Преобразует Mongoose документ КП в DTO, соответствующий shared/types
 */
function mapKpToDto(doc) {
    // Преобразуем Mongoose документ в простой объект JS, чтобы избежать проблем с spread оператором
    // и внутренними свойствами Mongoose (такими как _doc, __parentArray и т.д.)
    const raw = doc.toObject ? doc.toObject() : doc;
    // Явно извлекаем только нужные поля из metadata, чтобы избежать лишних свойств
    const { number, validityDays, prepaymentPercent, productionDays, tablePageBreakAfter, tablePageBreakFirstPage, tablePageBreakNextPages, photoScalePercent, photoCropPercent, showPhotoColumn, defaultMarkupPercent, defaultDiscountPercent } = raw.metadata || {};
    return {
        _id: String(raw._id),
        title: raw.title,
        status: raw.status,
        kpType: raw.kpType,
        counterpartyId: raw.counterpartyId,
        companyId: raw.companyId,
        recipient: raw.recipient,
        metadata: {
            number,
            validityDays,
            prepaymentPercent,
            productionDays,
            tablePageBreakAfter,
            tablePageBreakFirstPage,
            tablePageBreakNextPages,
            photoScalePercent,
            photoCropPercent,
            showPhotoColumn,
            defaultMarkupPercent,
            defaultDiscountPercent,
            createdAt: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : raw.createdAt,
        },
        items: (raw.items || []).map((item) => ({
            productId: String(item.productId),
            code: item.code,
            name: item.name,
            description: item.description,
            unit: item.unit,
            price: item.price,
            qty: item.qty,
            imageUrl: item.imageUrl,
            markupEnabled: !!item.markupEnabled,
            markupPercent: item.markupPercent ?? 0,
            discountEnabled: !!item.discountEnabled,
            discountPercent: item.discountPercent ?? 0,
        })),
        companySnapshot: {
            ...raw.companySnapshot,
            companyId: String(raw.companySnapshot?.companyId || ''),
        },
        conditions: raw.conditions || [],
        vatPercent: raw.vatPercent,
        versions: Array.isArray(raw.versions)
            ? raw.versions.map((v) => ({
                version: Number(v?.version) || 0,
                createdAt: (v?.createdAt instanceof Date ? v.createdAt : new Date(v?.createdAt)).toISOString(),
                status: v?.status,
                number: String(v?.number ?? v?.metadata?.number ?? ''),
                title: String(v?.title ?? '')
            })).filter((v) => v.version > 0 && v.number && v.title)
            : [],
        createdAt: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : raw.createdAt,
        updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt.toISOString() : raw.updatedAt,
    };
}
