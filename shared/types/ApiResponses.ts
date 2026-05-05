export interface ApiError {
  message: string;
  errors?: string[];
}

export interface PaginatedResponse<T> {
  data:  T[];
  total: number;
  page:  number;
  limit: number;
}

export type DictionaryType = 'category' | 'subcategory' | 'unit' | 'kind';

export interface IDictionary {
  _id:       string;
  type:      DictionaryType;
  value:     string;
  sortOrder: number;
  isActive:  boolean;
}

export interface ISetting {
  _id:   string;
  key:   string;
  value: any;
  label: string;
}
