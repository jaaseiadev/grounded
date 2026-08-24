import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Document } from '../models/models';
import { DocumentService } from './document.service';

const document: Document = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'policy.pdf',
  file_type: 'application/pdf',
  file_size: 200,
  storage_path: 'documents/policy.pdf',
  status: 'ready',
  chunk_count: 4,
  error_message: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('DocumentService', () => {
  let service: DocumentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DocumentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads documents into signal state', () => {
    service.load();
    http.expectOne('/api/documents').flush([document]);
    expect(service.documents()).toEqual([document]);
    expect(service.readyDocuments()).toEqual([document]);
  });

  it('tracks upload progress and prepends the accepted document', () => {
    service.upload(new File(['policy'], 'policy.pdf', { type: 'application/pdf' })).subscribe();
    const request = http.expectOne('/api/documents/upload');
    request.event({ type: HttpEventType.UploadProgress, loaded: 50, total: 100 });
    expect(service.uploadProgress()).toBe(50);
    request.flush(document);
    expect(service.documents()[0]).toEqual(document);
  });
});
