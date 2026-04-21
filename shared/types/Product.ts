export type ProductKind = 'ITEM' | 'SERVICE' | 'WORK';
export type ImageContext = 'product' | 'kp-page1' | 'kp-page2' | 'passport';

export interface ProductImage {
  url:       string;
  isMain:    boolean;
  sortOrder: number;
  context?:  ImageContext;  // optional, default: 'product'
}

/** Factory — единственный правильный способ создавать ProductImage */
export function createImage(
  url: string,
  options: { isMain?: boolean; sortOrder?: number; context?: ImageContext } = {}
): ProductImage {
  return {
    url,
    isMain:    options.isMain    ?? false,
    sortOrder: options.sortOrder ?? 0,
    context:   options.context   ?? 'product',
  };
}

export interface IProduct {
  _id:          string;
  code:         string;
  name:         string;
  description:  string;
  category:     string;
  subcategory?: string;
  unit:         string;
  price:        number;
  costRub?:     number;
  images:       ProductImage[];
  isActive:     boolean;
  kind:         ProductKind;
  notes?:       string;
  createdAt?:   string;
  updatedAt?:   string;
}

/** Alias для совместимости с frontend */
export type Product = IProduct;
