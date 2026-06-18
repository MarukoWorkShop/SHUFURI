import { trimToStreamStart } from './stripStreamEnvelope';

export function isStreamCodecText(raw: string): boolean {
  const t = trimToStreamStart(raw.trim());
  if (!t) return false;
  if (/^@0\s*$/m.test(t) || t.startsWith('@0\n') || t.startsWith('@0\r')) return true;
  if (/^H\|/m.test(t)) return true;
  return false;
}

export function isLegacyStructuredLyricsText(raw: string): boolean {
  const t = raw.trim();
  return /===BEGIN===/i.test(t) || /===LYRICS===/i.test(t);
}
