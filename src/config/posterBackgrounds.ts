export type PosterBackground = {
  id: string;
  name: string;
  nameEn: string;
  /** public 目录下的资源路径，构建后原样复制到 dist 根目录；纯白背景为空 */
  file: string;
};

/** 用户可选择的歌词海报/PDF 背景。当前仅保留纯白背景。 */
export const POSTER_BACKGROUNDS: PosterBackground[] = [
  {
    id: 'none',
    name: '纯白',
    nameEn: 'Plain White',
    file: '',
  },
];

export const DEFAULT_POSTER_BACKGROUND_ID = 'none';

export function getPosterBackgroundById(
  id: string | undefined | null,
): PosterBackground | undefined {
  return POSTER_BACKGROUNDS.find((bg) => bg.id === (id || 'none'));
}

export function getPosterBackgroundUrl(id: string | undefined | null): string | undefined {
  const bg = getPosterBackgroundById(id);
  return bg && bg.file ? bg.file : undefined;
}

/**
 * 版式底色（html2canvas backgroundColor 联动，避免非白底被刷白导致 PDF 零字节）。
 * 当前所有背景均为纯白；未来引入非白底背景时在此返回对应色值。
 */
export function getPosterBackgroundBgColor(id: string | undefined | null): string {
  void id;
  return '#ffffff';
}
