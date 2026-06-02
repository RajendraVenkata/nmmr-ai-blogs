import { describe, it, expect } from 'vitest';
import { sanitizeSiteUrl } from '@/lib/site';

describe('sanitizeSiteUrl', () => {
  it('keeps a clean URL as its origin', () => {
    expect(sanitizeSiteUrl('https://www.rajendravenkata.com')).toBe(
      'https://www.rajendravenkata.com',
    );
  });

  it('strips a trailing comma (the Amplify env misconfig that broke og:image)', () => {
    expect(sanitizeSiteUrl('https://rajendravenkata.com,')).toBe(
      'https://rajendravenkata.com',
    );
  });

  it('trims surrounding whitespace and trailing slash', () => {
    expect(sanitizeSiteUrl('  https://www.rajendravenkata.com/  ')).toBe(
      'https://www.rajendravenkata.com',
    );
  });

  it('falls back to the www default for an unparseable value', () => {
    expect(sanitizeSiteUrl('not a url')).toBe('https://www.rajendravenkata.com');
  });
});
