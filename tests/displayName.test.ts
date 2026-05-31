import { describe, it, expect } from 'vitest';
import { displayNameFrom } from '@/lib/displayName';

describe('displayNameFrom', () => {
  it('prefers a full name claim', () => {
    expect(displayNameFrom({ name: 'Rajendra Venkata', email: 'x@y.com' })).toBe('Rajendra Venkata');
  });
  it('falls back to the given name', () => {
    expect(displayNameFrom({ givenName: 'Raj', email: 'x@y.com' })).toBe('Raj');
  });
  it('prettifies the email local-part when no name claim', () => {
    expect(displayNameFrom({ email: 'rajendra.venkata@gmail.com' })).toBe('Rajendra Venkata');
    expect(displayNameFrom({ email: 'jane_doe@x.com' })).toBe('Jane Doe');
  });
  it('returns Account when nothing is available', () => {
    expect(displayNameFrom({})).toBe('Account');
    expect(displayNameFrom({ name: '   ' })).toBe('Account');
  });
});
