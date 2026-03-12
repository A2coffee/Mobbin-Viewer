export function isMobbinUrl(url?: string | null): boolean {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.hostname === 'mobbin.com' || parsed.hostname.endsWith('.mobbin.com');
  } catch {
    return false;
  }
}
