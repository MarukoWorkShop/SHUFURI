import { useEffect, useState } from 'react';
import { PulsatingDots } from './PulsatingDots';
import { L } from '../utils/i18n';

export type LoadingTip = { zh: string; en: string };

/** 进编辑 / 字体预热等待用的轮播提示（SHUFURI 语气） */
export const EDIT_ENTRY_LOADING_TIPS: readonly LoadingTip[] = [
  { zh: '正在加载歌词学习页面', en: 'Loading lyrics study page…' },
  { zh: '正在加载字体', en: 'Loading fonts…' },
  { zh: '正在积极加速中', en: 'Speeding things up…' },
  { zh: '马上就好，稍等一下', en: 'Almost there — hang tight…' },
  { zh: '字体就绪后导出更顺', en: 'Fonts ready — export will be snappier…' },
];

type Props = {
  /** 静态文案（导出页等短等待） */
  messageZh?: string;
  messageEn?: string;
  /** 轮播提示；进编辑 / 字体等待优先用这个 */
  tips?: readonly LoadingTip[];
  /** 轮播间隔，默认 2.2s */
  rotateMs?: number;
};

const DEFAULT_ROTATE_MS = 2200;

/** lazy/Suspense 与全屏等待共用，避免 fallback={null} 整页空白 */
export default function GlobalChunkLoading({
  messageZh,
  messageEn,
  tips,
  rotateMs = DEFAULT_ROTATE_MS,
}: Props) {
  const rotating = tips != null && tips.length > 0;
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (!rotating || tips.length < 2) return;
    const id = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % tips.length);
    }, rotateMs);
    return () => window.clearInterval(id);
  }, [rotating, tips, rotateMs]);

  const tip = rotating
    ? tips[tipIndex % tips.length]!
    : { zh: messageZh ?? '', en: messageEn ?? '' };

  return (
    <div className="global-layout-loading" role="status" aria-live="polite">
      <div className="global-layout-loading__inner">
        <PulsatingDots size={12} />
        <p className="global-layout-loading__text">{L(tip.zh, tip.en)}</p>
      </div>
    </div>
  );
}
