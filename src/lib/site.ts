// Canonical site origin used for metadataBase, canonical URLs, and OG image URLs.
// Tolerates misconfigured env values (stray whitespace, trailing commas/slashes)
// that would otherwise produce a malformed URL like "https://host,/path".
// Defaults to the www host because the apex (non-www) does not resolve.
const RAW = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.rajendravenkata.com';

export function sanitizeSiteUrl(value: string): string {
  const cleaned = value.trim().replace(/[,\s]+$/, '').replace(/\/+$/, '');
  try {
    return new URL(cleaned).origin;
  } catch {
    return 'https://www.rajendravenkata.com';
  }
}

export const SITE_URL = sanitizeSiteUrl(RAW);
