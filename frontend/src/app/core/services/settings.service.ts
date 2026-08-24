import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Settings } from '../models/models';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  readonly settings = signal<Settings | null>(null);
  readonly loading = signal(false);

  load(): void {
    if (this.settings()) return;
    this.loading.set(true);
    this.http.get<Settings>('/api/settings/models').subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
