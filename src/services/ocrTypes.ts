/**
 * OCR 管线类型定义
 *
 * 统一 OCR 提取结果的结构，供 runOcrPipeline 输出和下游消费者使用。
 */

export type OcrFieldConfidence = 'high' | 'medium' | 'low';

export type OcrDetectedLanguage = 'jp' | 'ko' | 'zh' | 'mixed' | 'unknown';

/** 分类文本行：标注每行的元数据类型，供 Prompt 注入用 */
export interface ClassifiedTextLine {
  text: string;
  category: 'title' | 'artist' | 'album' | 'lyricsWriter' | 'composer' | 'arranger' | 'producer' | 'releaseYear' | 'lyrics' | 'ui_noise' | 'unknown';
}

export interface OcrResultCore {
  title: string;
  artist: string;
  titleConfidence: OcrFieldConfidence;
  artistConfidence: OcrFieldConfidence;
}

export interface OcrResultExtended {
  album?: string;
  albumConfidence?: OcrFieldConfidence;
  lyricsWriter?: string;      // 作詞
  composer?: string;           // 作曲
  arranger?: string;           // 編曲
  producer?: string;           // Producer/制作
  releaseYear?: string;        // 发行年份
  firstLyricLine?: string;     // 首句歌词
}

export interface OcrResult {
  version: string;             // 引擎版本号
  core: OcrResultCore;
  extended?: OcrResultExtended;
  detectedLanguage: OcrDetectedLanguage;
  rawTexts: string[];
  /** 标注每行的分类（供 prompt 注入用，最多 30 行） */
  classifiedTexts: ClassifiedTextLine[];
}
