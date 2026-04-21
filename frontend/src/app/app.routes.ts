import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { canDeactivateBuilder } from './features/kp/kp-builder/can-deactivate.guard';

export const routes: Routes = [
  // Публичный маршрут
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
  },

  // Защищённые маршруты — через AppShell (шапка + навигация)
  {
    path: '',
    loadComponent: () => import('./core/components/app-shell/app-shell.component').then(m => m.AppShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent)
      },
      {
        path: 'products',
        loadComponent: () => import('./features/products/products.component').then(m => m.ProductsComponent)
      },
      {
        path: 'counterparties',
        loadComponent: () => import('./features/counterparties/counterparties.component').then(m => m.CounterpartiesComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent)
      },
      {
        path: 'kp/:id',
        loadComponent: () => import('./features/kp/kp-builder/kp-builder.component').then(m => m.KpBuilderComponent),
        canDeactivate: [canDeactivateBuilder]
      }
    ]
  },

  { path: '**', redirectTo: '' }
];
