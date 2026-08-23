import { Routes } from '@angular/router';
import { AppShellComponent } from './layout/app-shell.component';

export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'chat' },
      {
        path: 'chat',
        loadComponent: () => import('./features/chat/chat.page').then((module) => module.ChatPage),
      },
      {
        path: 'chat/:conversationId',
        loadComponent: () => import('./features/chat/chat.page').then((module) => module.ChatPage),
      },
      {
        path: 'documents',
        loadComponent: () =>
          import('./features/documents/documents.page').then((module) => module.DocumentsPage),
      },
      {
        path: 'playground',
        loadComponent: () =>
          import('./features/playground/playground.page').then((module) => module.PlaygroundPage),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.page').then((module) => module.SettingsPage),
      },
    ],
  },
  { path: '**', redirectTo: 'chat' },
];
