export interface ProductSpecParam {
  name: string;
  value: string;
}

export interface ProductSpecGroup {
  title: string;
  params: ProductSpecParam[];
}

export interface ProductSpec {
  _id?: string;
  productId: string;
  drawings: {
    viewFront?: string;
    viewSide?: string;
    viewTop?: string;
    view3D?: string;
  };
  groups: ProductSpecGroup[];
  createdAt?: Date;
  updatedAt?: Date;
}
