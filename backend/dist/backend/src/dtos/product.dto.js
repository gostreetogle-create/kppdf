"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapProductToDto = mapProductToDto;
/**
 * Преобразует Mongoose документ или plain object товара в DTO, соответствующий shared/types
 */
function mapProductToDto(doc) {
    return {
        _id: String(doc._id),
        specId: doc.specId ? String(doc.specId) : undefined,
        code: doc.code,
        name: doc.name,
        description: doc.description,
        category: doc.category,
        subcategory: doc.subcategory,
        unit: doc.unit,
        price: doc.price,
        costRub: doc.costRub,
        images: doc.images || [],
        isActive: doc.isActive,
        kind: doc.kind,
        notes: doc.notes,
        createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
        updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
    };
}
