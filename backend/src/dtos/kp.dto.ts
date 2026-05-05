import { IKp as ISharedKp, KpItem, KpRecipient, KpMetadata } from '../../../shared/types/Kp';
import { IKp as IMongoKp } from '../models/kp.model';

/**
 * Преобразует Mongoose документ КП в DTO, соответствующий shared/types
 */
export function mapKpToDto(doc: IMongoKp): ISharedKp {
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
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
