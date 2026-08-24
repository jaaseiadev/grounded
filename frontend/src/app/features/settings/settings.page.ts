import { Component, inject } from '@angular/core';
import {
  LucideBot,
  LucideDatabase,
  LucideInfo,
  LucideLock,
  LucideSearch,
  LucideSlidersHorizontal,
} from '@lucide/angular';
import { SettingsService } from '../../core/services/settings.service';

@Component({
  selector: 'app-settings-page',
  imports: [
    LucideBot,
    LucideDatabase,
    LucideInfo,
    LucideLock,
    LucideSearch,
    LucideSlidersHorizontal,
  ],
  templateUrl: './settings.page.html',
})
export class SettingsPage {
  readonly settings = inject(SettingsService);

  constructor() {
    this.settings.load();
  }
}
