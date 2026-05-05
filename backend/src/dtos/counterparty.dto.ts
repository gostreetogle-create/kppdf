import { ICounterparty as ISharedCounterparty } from '../../../shared/types/Counterparty';
import { ICounterparty as IMongoCounterparty } from '../models/counterparty.model';

/**
 * Преобразует Mongoose документ контрагента в DTO, соответствующий shared/types
 */
export function mapCounterpartyToDto(doc: IMongoCounterparty): ISharedCounterparty {
  const result: ISharedCounterparty = {
    _id: String(doc._id),
    legalForm: doc.legalForm,
    role: doc.role,
    name: doc.name,
    shortName: doc.shortName,
    inn: doc.inn,
    kpp: doc.kpp,
    ogrn: doc.ogrn,
    legalAddress: doc.legalAddress,
    actualAddress: doc.actualAddress,
    sameAddress: doc.sameAddress,
    phone: doc.phone,
    email: doc.email,
    website: doc.website,
    contacts: doc.contacts || [],
    bankName: doc.bankName,
    bik: doc.bik,
    checkingAccount: doc.checkingAccount,
    correspondentAccount: doc.correspondentAccount,
    founderName: doc.founderName,
    founderNameShort: doc.founderNameShort,
    status: doc.status,
    notes: doc.notes,
    tags: doc.tags || [],
    isOurCompany: doc.isOurCompany,
    isDefaultInitiator: doc.isDefaultInitiator,
    images: doc.images || [],
    footerText: doc.footerText,
    defaultMarkupPercent: doc.defaultMarkupPercent,
    defaultDiscountPercent: doc.defaultDiscountPercent,
    brandingTemplates: (doc.brandingTemplates || []).map(t => ({
      key: t.key,
      name: t.name,
      kpType: t.kpType,
      isDefault: t.isDefault,
      assets: t.assets,
      conditions: t.conditions
    })),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
  return result;
}
