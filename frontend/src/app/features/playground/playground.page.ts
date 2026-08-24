import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideBeaker,
  LucideCheckCircle,
  LucideChevronDown,
  LucideClock,
  LucideFileText,
  LucideFlaskConical,
  LucideGauge,
  LucideLoaderCircle,
  LucidePlay,
  LucideSearch,
  LucideSparkles,
} from '@lucide/angular';
import { finalize } from 'rxjs';
import {
  Citation,
  PlaygroundResult,
  PromptConfiguration,
  PromptPreset,
} from '../../core/models/models';
import { AiService } from '../../core/services/ai.service';
import { DocumentService } from '../../core/services/document.service';
import { SettingsService } from '../../core/services/settings.service';
import { CitationPanelComponent } from '../../shared/citation-panel.component';
import { DocumentScopeComponent } from '../../shared/document-scope.component';

@Component({
  selector: 'app-playground-page',
  imports: [
    DecimalPipe,
    PercentPipe,
    ReactiveFormsModule,
    CitationPanelComponent,
    DocumentScopeComponent,
    LucideBeaker,
    LucideCheckCircle,
    LucideChevronDown,
    LucideClock,
    LucideFileText,
    LucideFlaskConical,
    LucideGauge,
    LucideLoaderCircle,
    LucidePlay,
    LucideSearch,
    LucideSparkles,
  ],
  templateUrl: './playground.page.html',
})
export class PlaygroundPage {
  private readonly ai = inject(AiService);
  readonly documents = inject(DocumentService);
  readonly settings = inject(SettingsService);
  readonly presets = signal<PromptPreset[]>([]);
  readonly selectedPresetId = signal('strict-document-qa');
  readonly selectedDocumentIds = signal<string[]>([]);
  readonly running = signal(false);
  readonly result = signal<PlaygroundResult | null>(null);
  readonly error = signal<string | null>(null);
  readonly activeCitation = signal<Citation | null>(null);

  readonly form = new FormGroup({
    systemPrompt: new FormControl('', { nonNullable: true, validators: Validators.required }),
    userPrompt: new FormControl('', { nonNullable: true, validators: Validators.required }),
    retrievalCount: new FormControl(5, {
      nonNullable: true,
      validators: [Validators.min(1), Validators.max(12)],
    }),
    temperature: new FormControl(0.1, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(1)],
    }),
    model: new FormControl('', { nonNullable: true, validators: Validators.required }),
    expectedAnswer: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.documents.load();
    this.settings.load();
    this.ai.presets().subscribe({
      next: (presets) => {
        this.presets.set(presets);
        if (presets[0]) this.applyPreset(presets[0].id);
      },
      error: (error: Error) => this.error.set(error.message),
    });
    effect(() => {
      const settings = this.settings.settings();
      if (settings && !this.form.controls.model.value) {
        this.form.controls.model.setValue(settings.chat);
      }
    });
  }

  applyPreset(id: string): void {
    const preset = this.presets().find((item) => item.id === id);
    if (!preset) return;
    this.selectedPresetId.set(id);
    this.form.patchValue({
      systemPrompt: preset.systemPrompt,
      retrievalCount: preset.retrievalCount,
      temperature: preset.temperature,
    });
  }

  run(): void {
    if (this.form.invalid || this.running()) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.documents.readyDocuments().length === 0) {
      this.error.set('Upload and process at least one document before running the playground.');
      return;
    }
    const value = this.form.getRawValue();
    const configuration: PromptConfiguration = {
      ...value,
      documentIds: this.selectedDocumentIds(),
      expectedAnswer: value.expectedAnswer.trim() || undefined,
    };
    this.error.set(null);
    this.result.set(null);
    this.running.set(true);
    this.ai
      .runPlayground(configuration)
      .pipe(finalize(() => this.running.set(false)))
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: Error) => this.error.set(error.message),
      });
  }
}
