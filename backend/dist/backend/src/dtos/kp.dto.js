"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapKpToDto = mapKpToDto;
/**
 * Преобразует Mongoose документ КП в DTO, соответствующий shared/types
 */
function mapKpToDto(doc) {
    // Явно извлекаем только нужные поля из metadata, чтобы избежать лишних свойств
    const { number, validityDays, prepaymentPercent, productionDays, tablePageBreakAfter, tablePageBreakFirstPage, tablePageBreakNextPages, photoScalePercent, photoCropPercent, showPhotoColumn, defaultMarkupPercent, defaultDiscountPercent } = doc.metadata;
    return {
        _id: String(doc._id),
        title: doc.title,
        status: doc.status,
        kpType: doc.kpType,
        counterpartyId: doc.counterpartyId,
        companyId: doc.companyId,
        recipient: doc.recipient,
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
            createdAt: doc.createdAt.toISOString(),
        },
        items: doc.items.map(item => ({
            ...item,
            markupEnabled: !!item.markupEnabled,
            markupPercent: item.markupPercent ?? 0,
            discountEnabled: !!item.discountEnabled,
            discountPercent: item.discountPercent ?? 0,
        })),
        companySnapshot: {
            ...doc.companySnapshot,
            companyId: String(doc.companySnapshot.companyId),
        },
        conditions: doc.conditions || [],
        vatPercent: doc.vatPercent,
        versions: Array.isArray(doc.versions)
            ? doc.versions.map((v) => ({
                version: Number(v?.version) || 0,
                createdAt: (v?.createdAt instanceof Date ? v.createdAt : new Date(v?.createdAt)).toISOString(),
                status: v?.status,
                number: String(v?.number ?? v?.metadata?.number ?? ''),
                title: String(v?.title ?? '')
            })).filter((v) => v.version > 0 && v.number && v.title)
            : [],
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
    };
}
