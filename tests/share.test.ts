import { describe, it, expect } from 'vitest';
import { linkedInShareUrl, xShareUrl, facebookShareUrl } from '@/lib/share';

const payload = { url: 'https://blog.test/posts/hello', title: 'Hello & Bye' };

describe('share URLs', () => {
  it('builds a LinkedIn URL with an encoded post URL', () => {
    expect(linkedInShareUrl(payload)).toBe(
      'https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fblog.test%2Fposts%2Fhello',
    );
  });
  it('builds an X URL with encoded url and text', () => {
    expect(xShareUrl(payload)).toBe(
      'https://twitter.com/intent/tweet?url=https%3A%2F%2Fblog.test%2Fposts%2Fhello&text=Hello%20%26%20Bye',
    );
  });
  it('builds a Facebook URL with an encoded post URL', () => {
    expect(facebookShareUrl(payload)).toBe(
      'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fblog.test%2Fposts%2Fhello',
    );
  });
});
