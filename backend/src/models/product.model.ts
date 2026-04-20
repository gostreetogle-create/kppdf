import { Schema, model, Document } from 'mongoose';

export type ProductKind = 'ITEM' | 'SERVICE' | 'WORK';

export interface IProductImage {
  url:       string;
  isMain:    boolean;
  sortOrder: number;
}

export interface IProduct extends Document {
  code:         string;
  name:         string;
  description:  string;
  category:     string;
  subcategory?: string;
  unit:         string;
  price:        number;
  costRub?:     number;
  images:       IProductImage[];
  isActive:     boolean;
  kind:         ProductKind;
  notes?:       string;
}

const ProductImageSchema = new Schema<IProductImage>({
  url:       { type: String, required: true },
  isMain:    { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
}, { _id: false });

const ProductSchema = new Schema<IProduct>({
  code:        { type: String, required: true, unique: true, trim: true },
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  category:    { type: String, default: '', trim: true },
  subcategory: { type: String, trim: true },
  unit:        { type: String, required: true, trim: true },
  price:       { type: Number, required: true, min: 0 },
  costRub:     { type: Number, min: 0 },
  images:      { type: [ProductImageSchema], default: [] },
  isActive:    { type: Boolean, default: true },
  kind:        { type: String, enum: ['ITEM', 'SERVICE', 'WORK'], default: 'ITEM' },
  notes:       { type: String },
}, { timestamps: true });

ProductSchema.index({ name: 'text', code: 'text', description: 'text' });
ProductSchema.index({ category: 1, isActive: 1 });

export const Product = model<IProduct>('Product', ProductSchema);
