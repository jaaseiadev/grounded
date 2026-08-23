import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideFileText,
  LucideLeaf,
  LucideMenu,
  LucideMessageSquare,
  LucidePlus,
  LucideSettings,
  LucideSlidersHorizontal,
  LucideX,
} from '@lucide/angular';
import { ConversationService } from '../core/services/conversation.service';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideFileText,
    LucideLeaf,
    LucideMenu,
    LucideMessageSquare,
    LucidePlus,
    LucideSettings,
    LucideSlidersHorizontal,
    LucideX,
  ],
  templateUrl: './app-shell.component.html',
})
export class AppShellComponent {
  private readonly router = inject(Router);
  readonly conversations = inject(ConversationService);
  readonly mobileOpen = signal(false);

  constructor() {
    this.conversations.loadList();
  }

  newChat(): void {
    this.mobileOpen.set(false);
    void this.router.navigate(['/chat']);
  }

  closeMobile(): void {
    this.mobileOpen.set(false);
  }
}
