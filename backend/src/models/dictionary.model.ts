import { Schema, model, Document } from 'mongoose';

export type DictionaryType = 'category' | 'subcategory' | 'unit' | 'kind';

export interface IDictionary extends Document {
  type:      DictionaryType;
  value:     string;
  sortOrder: number;
  isActive:  boolean;
}

const DictionarySchema = new Schema<IDictionary>({
  type:      { type: String, enum: ['category', 'subcategory', 'unit', 'kind'], required: true },
  value:     { type: String, required: true, trim: true },
  sortOrder: { type: Number, default: 0 },
  isActive:  { type: Boolean, default: true },
}, { timestamps: true });

DictionarySchema.index({ type: 1, value: 1 }, { unique: true });

export const Dictionary = model<IDictionary>('Dictionary', DictionarySchema);
