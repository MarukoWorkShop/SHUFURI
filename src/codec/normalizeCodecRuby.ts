const CODEC_RUBY_RE = /\{([^:\\{}]+):([^\\{}]+)\}/g;

/** Codec 输出 {基字:读音} → 内部 {基字|读音} */
export function normalizeCodecRuby(text: string): string {
  return text.replace(CODEC_RUBY_RE, '{$1|$2}');
}

export function normalizeCodecRubyFields(fields: string[]): string[] {
  return fields.map(normalizeCodecRuby);
}
