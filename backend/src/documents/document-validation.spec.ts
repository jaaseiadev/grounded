import { BadRequestException } from '@nestjs/common';
import { sanitizeFilename, validateDocumentFile } from './document-validation';

function file(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'policy.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 128,
    buffer: Buffer.from('test'),
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
    ...overrides,
  };
}

describe('document validation', () => {
  it('accepts supported files', () => {
    expect(() => validateDocumentFile(file())).not.toThrow();
  });

  it('rejects unsupported extensions even when the MIME type looks safe', () => {
    expect(() =>
      validateDocumentFile(
        file({ originalname: 'script.exe', mimetype: 'text/plain' }),
      ),
    ).toThrow(BadRequestException);
  });

  it('sanitizes path and control characters', () => {
    expect(sanitizeFilename('../../Q3 policy <final>.pdf')).toBe(
      'Q3-policy-final-.pdf',
    );
  });
});
