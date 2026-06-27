export function humanize(s: string): string {
  if (!s) return '';
  const t = s.replace(/[-_]/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function summarize(body: string, words = 25): string {
  const text = body
    .replace(/<!--more-->[\s\S]*/, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`\[\]()!]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.split(' ').slice(0, words).join(' ');
}
