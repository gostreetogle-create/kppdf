import { Schema, model, Document, Types } from 'mongoose';

export interface IProductSpecParam {
  name: string;
  value: string;
}

export interface IProductSpecGroup {
  title: string;
  params: IProductSpecParam[];
}

export interface IProductSpecDrawings {
  viewFront?: string;
  viewSide?: string;
  viewTop?: string;
  view3D?: string;
}

export interface IProductSpec extends Document {
  productId: Types.ObjectId;
  drawings: IProductSpecDrawings;
  groups: IProductSpecGroup[];
  createdAt?: Date;
  updatedAt?: Date;
}

const ProductSpecParamSchema = new Schema<IProductSpecParam>({
  name: { type: String, required: true, trim: true },
  value: { type: String, required: true, trim: true }
}, { _id: false });

const ProductSpecGroupSchema = new Schema<IProductSpecGroup>({
  title: { type: String, required: true, trim: true },
  params: { type: [ProductSpecParamSchema], default: [] }
}, { _id: false });

const ProductSpecDrawingsSchema = new Schema<IProductSpecDrawings>({
  viewFront: { type: String, trim: true },
  viewSide: { type: String, trim: true },
  viewTop: { type: String, trim: true },
  view3D: { type: String, trim: true }
}, { _id: false });

const ProductSpecSchema = new Schema<IProductSpec>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, unique: true, index: true },
  drawings: { type: ProductSpecDrawingsSchema, default: {} },
  groups: { type: [ProductSpecGroupSchema], default: [] }
}, { timestamps: true });

export const ProductSpec = model<IProductSpec>('ProductSpec', ProductSpecSchema);
