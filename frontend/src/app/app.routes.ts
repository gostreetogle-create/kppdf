import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { canDeactivateBuilder } from './features/kp/kp-builder/can-deactivate.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  // Публичный маршрут
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'guest-preview/:token',
    loadComponent: () => import('./features/auth/guest-preview.component').then(m => m.GuestPreviewComponent)
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
        loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent),
        canActivate: [permissionGuard],
        data: { permission: 'settings.write' }
      },
      {
        path: 'dictionaries',
        loadComponent: () => import('./features/dictionaries/dictionaries.component').then(m => m.DictionariesComponent),
        canActivate: [permissionGuard],
        data: { permission: 'settings.write' }
      },
      {
        path: 'users',
        loadComponent: () => import('./features/users/users.component').then(m => m.UsersComponent),
        canActivate: [permissionGuard],
        data: { permission: 'users.manage' }
      },
      {
        path: 'roles-permissions',
        loadComponent: () => import('./features/roles-permissions/roles-permissions.component').then(m => m.RolesPermissionsComponent),
        canActivate: [permissionGuard],
        data: { permission: 'users.manage' }
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
