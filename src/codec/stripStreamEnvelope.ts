/** 去掉 markdown 围栏与 @0 之前的说明性前言 */
export function stripMarkdownFences(raw: string): string {
  let s = raw.trim();
  const fenceOpen = /^```(?:text|json|plaintext|txt)?\s*\n/i;
  if (fenceOpen.test(s)) {
    s = s.replace(fenceOpen, '');
    s = s.replace(/\n```\s*$/i, '');
  }
  return s.trim();
}

export function trimToStreamStart(raw: string): string {
  const s = stripMarkdownFences(raw);
  const lines = s.split(/\r\n|\n|\r/);
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (t === '@0' || /^H\|/.test(t)) {
      return lines.slice(i).join('\n').trim();
    }
  }
  return s;
}
