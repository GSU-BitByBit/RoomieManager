import { BadRequestException } from '@nestjs/common';

import { ParseAppIdPipe } from '../../../src/common/http/parse-app-id.pipe';

describe('ParseAppIdPipe', () => {
  const pipe = new ParseAppIdPipe();

  it('accepts UUID values', () => {
    const value = pipe.transform('550e8400-e29b-41d4-a716-446655440000');

    expect(value).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('accepts CUID values', () => {
    const value = pipe.transform('cm8z45u8v00017y8jcm9jzssw');

    expect(value).toBe('cm8z45u8v00017y8jcm9jzssw');
  });

  it('rejects invalid identifiers', () => {
    expect(() => pipe.transform('not-a-valid-id')).toThrow(BadRequestException);
  });
});
