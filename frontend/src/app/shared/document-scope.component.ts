import { Component, computed, input, output } from '@angular/core';
import { LucideChevronDown, LucideFiles } from '@lucide/angular';
import { Document } from '../core/models/models';

@Component({
  selector: 'app-document-scope',
  imports: [LucideChevronDown, LucideFiles],
  template: `
    <details class="group relative">
      <summary
        class="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-sm transition hover:border-stone-300"
      >
        <svg lucideFiles size="15"></svg>
        <span class="max-w-40 truncate">{{ label() }}</span>
        <svg lucideChevronDown size="14" class="transition group-open:rotate-180"></svg>
      </summary>
      <div
        class="absolute top-full right-0 z-30 mt-2 w-72 rounded-xl border border-stone-200 bg-white p-2 shadow-xl shadow-stone-950/10"
      >
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs hover:bg-stone-50"
          (click)="selectAll()"
        >
          <span
            class="flex size-4 items-center justify-center rounded border"
            [class.border-stone-900]="selectedIds().length === 0"
            [class.bg-stone-900]="selectedIds().length === 0"
          >
            @if (selectedIds().length === 0) {
              <span class="size-1.5 rounded-full bg-white"></span>
            }
          </span>
          All ready documents
        </button>
        <div class="my-1 border-t border-stone-100"></div>
        <div class="max-h-60 overflow-y-auto">
          @for (document of documents(); track document.id) {
            <label
              class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-xs hover:bg-stone-50"
            >
              <input
                type="checkbox"
                class="size-4 rounded border-stone-300 accent-stone-900"
                [checked]="selectedIds().includes(document.id)"
                (change)="toggle(document.id)"
              />
              <span class="truncate">{{ document.name }}</span>
            </label>
          } @empty {
            <p class="px-3 py-4 text-center text-xs text-stone-500">No ready documents yet.</p>
          }
        </div>
      </div>
    </details>
  `,
})
export class DocumentScopeComponent {
  readonly documents = input.required<Document[]>();
  readonly selectedIds = input.required<string[]>();
  readonly selectedIdsChange = output<string[]>();
  readonly label = computed(() => {
    const count = this.selectedIds().length;
    if (count === 0) return 'All documents';
    if (count === 1)
      return (
        this.documents().find((document) => document.id === this.selectedIds()[0])?.name ??
        '1 document'
      );
    return `${count} documents`;
  });

  selectAll(): void {
    this.selectedIdsChange.emit([]);
  }

  toggle(id: string): void {
    const current = this.selectedIds();
    this.selectedIdsChange.emit(
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }
}
