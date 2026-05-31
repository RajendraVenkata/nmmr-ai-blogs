export function displayNameFrom(opts: {
  name?: string | null;
  givenName?: string | null;
  email?: string | null;
}): string {
  const { name, givenName, email } = opts;
  if (name && name.trim()) return name.trim();
  if (givenName && givenName.trim()) return givenName.trim();
  if (email && email.includes('@')) {
    const words = email
      .split('@')[0]
      .split(/[._-]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
    if (words.length) return words.join(' ');
  }
  return 'Account';
}
