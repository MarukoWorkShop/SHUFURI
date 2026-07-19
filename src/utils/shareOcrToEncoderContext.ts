import type { EncoderPromptOptions } from '../codec/prompt/encoderCommon';
import type { ShareOcrData } from '../context/HomeSessionContext';

/** 将分享/OCR 预填数据转为 Step1 口令的 ocrContext */
export function shareOcrToEncoderContext(
  data: ShareOcrData | null | undefined,
): EncoderPromptOptions['ocrContext'] | undefined {
  if (!data) return undefined;

  const ctx: EncoderPromptOptions['ocrContext'] = {};
  if (data.title.trim()) ctx.songTitle = data.title.trim();
  if (data.artist.trim()) ctx.artist = data.artist.trim();
  if (data.album?.trim()) ctx.album = data.album.trim();
  if (data.production?.trim()) ctx.production = data.production.trim();
  if (data.firstLyricLine?.trim()) ctx.firstLyricLine = data.firstLyricLine.trim();
  if (data.detectedLanguage) ctx.detectedLanguage = data.detectedLanguage;
  if (data.rawTexts?.length) ctx.rawTexts = data.rawTexts;

  return Object.keys(ctx).length > 0 ? ctx : undefined;
}
