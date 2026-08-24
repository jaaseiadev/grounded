import { BadRequestException } from '@nestjs/common';

export const MAX_FILE_SIZE = 15 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.md']);
export const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'application/octet-stream',
]);

export function validateDocumentFile(file: Express.Multer.File): void {
  if (!file) throw new BadRequestException('Choose a document to upload.');
  if (file.size <= 0)
    throw new BadRequestException('The uploaded file is empty.');
  if (file.size > MAX_FILE_SIZE)
    throw new BadRequestException('Files are limited to 15 MB.');
  const extension = file.originalname
    .slice(file.originalname.lastIndexOf('.'))
    .toLowerCase();
  if (
    !ACCEPTED_EXTENSIONS.has(extension) ||
    !ACCEPTED_MIME_TYPES.has(file.mimetype)
  ) {
    throw new BadRequestException(
      'Unsupported file type. Upload PDF, DOCX, TXT, or Markdown.',
    );
  }
}

export function sanitizeFilename(filename: string): string {
  const safe = filename
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 140);
  return safe || 'document';
}
