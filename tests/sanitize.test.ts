import { describe, it, expect } from 'vitest';
import { markdownSanitizeSchema } from '@/lib/sanitize';

describe('markdownSanitizeSchema', () => {
  it('allows media tags for embeds', () => {
    expect(markdownSanitizeSchema.tagNames).toContain('img');
    expect(markdownSanitizeSchema.tagNames).toContain('video');
    expect(markdownSanitizeSchema.tagNames).toContain('iframe');
  });
  it('does not allow script', () => {
    expect(markdownSanitizeSchema.tagNames).not.toContain('script');
  });
  it('permits src/controls on video', () => {
    expect(markdownSanitizeSchema.attributes!.video).toContain('controls');
  });
});
