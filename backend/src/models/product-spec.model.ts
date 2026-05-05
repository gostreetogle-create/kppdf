import { Schema, model, Document, Types } from 'mongoose';
import { 
  ProductSpec as ISharedProductSpec, 
  ProductSpecGroup, 
  ProductSpecParam,
  ProductSpecDrawings
} from '../../../shared/types/ProductSpec';

export interface IProductSpec extends Omit<ISharedProductSpec, '_id' | 'productId' | 'createdAt' | 'updatedAt' | 'groups'>, Document {
  productId: Types.ObjectId;
  groups: ProductSpecGroup[];
  createdAt: Date;
  updatedAt: Date;
}

const ProductSpecParamSchema = new Schema<ProductSpecParam>({
  name: { type: String, required: true, trim: true },
  value: { type: String, required: true, trim: true }
}, { _id: false });

const ProductSpecGroupSchema = new Schema<ProductSpecGroup>({
  title: { type: String, required: true, trim: true },
  params: { type: [ProductSpecParamSchema], default: [] }
}, { _id: false });

const ProductSpecDrawingsSchema = new Schema<ProductSpecDrawings>({
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
