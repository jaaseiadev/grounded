import { Component, input, output } from '@angular/core';
import { LucideFileText, LucideX } from '@lucide/angular';
import { Citation } from '../core/models/models';

@Component({
  selector: 'app-citation-panel',
  imports: [LucideFileText, LucideX],
  template: `
    @if (citation(); as source) {
      <button
        type="button"
        class="fixed inset-0 z-40 bg-stone-950/20 backdrop-blur-[1px]"
        aria-label="Close source preview"
        (click)="closed.emit()"
      ></button>
      <aside
        class="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-stone-200 bg-white shadow-2xl shadow-stone-950/15"
        aria-label="Source preview"
      >
        <header class="flex items-start justify-between border-b border-stone-200 p-6">
          <div class="flex min-w-0 items-start gap-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-lime-800"
              ><svg lucideFileText size="19"></svg
            ></span>
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-stone-900">{{ source.documentName }}</p>
              <p class="mt-1 text-xs text-stone-500">
                @if (source.page) {
                  Page {{ source.page }}
                } @else {
                  Page unavailable
                }
                @if (source.section) {
                  <span class="px-1.5">·</span>{{ source.section }}
                }
              </p>
            </div>
          </div>
          <button
            type="button"
            class="flex size-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-900"
            aria-label="Close source preview"
            (click)="closed.emit()"
          >
            <svg lucideX size="18"></svg>
          </button>
        </header>
        <div class="overflow-y-auto p-6">
          <div
            class="mb-4 flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-stone-400 uppercase"
          >
            Retrieved chunk <span class="h-px flex-1 bg-stone-200"></span>
          </div>
          <p class="whitespace-pre-wrap text-sm leading-7 text-stone-700">{{ source.excerpt }}</p>
        </div>
      </aside>
    }
  `,
})
export class CitationPanelComponent {
  readonly citation = input<Citation | null>(null);
  readonly closed = output<void>();
}
