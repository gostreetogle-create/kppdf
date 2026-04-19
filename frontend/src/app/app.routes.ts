import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/kp',
    pathMatch: 'full'
  },
  {
    path: 'kp',
    loadComponent: () => import('./features/kp/components/kp-document/kp-document.component').then(m => m.KpDocumentComponent)
  },
  {
    path: 'catalog',
    loadComponent: () => import('./features/products/catalog/product-catalog.component').then(m => m.ProductCatalogComponent)
  }
];
