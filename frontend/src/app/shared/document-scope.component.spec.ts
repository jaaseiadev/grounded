import { TestBed } from '@angular/core/testing';
import { Document } from '../core/models/models';
import { DocumentScopeComponent } from './document-scope.component';

const source: Document = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'employee-handbook.md',
  file_type: 'text/markdown',
  file_size: 100,
  storage_path: 'documents/employee-handbook.md',
  status: 'ready',
  chunk_count: 2,
  error_message: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('DocumentScopeComponent', () => {
  it('labels a selected document and emits scope changes', async () => {
    await TestBed.configureTestingModule({ imports: [DocumentScopeComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DocumentScopeComponent);
    fixture.componentRef.setInput('documents', [source]);
    fixture.componentRef.setInput('selectedIds', [source.id]);
    fixture.detectChanges();

    expect(fixture.componentInstance.label()).toBe(source.name);
    let emitted: string[] | undefined;
    fixture.componentInstance.selectedIdsChange.subscribe((ids) => (emitted = ids));
    fixture.componentInstance.toggle(source.id);
    expect(emitted).toEqual([]);
  });
});
