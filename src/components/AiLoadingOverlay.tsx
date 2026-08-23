import { useEffect, useMemo, useState } from 'react';
import './AiLoadingOverlay.css';

/** 加载文案池：中文界面显示中文，英文界面显示英文（单一语言，不混排） */
const LOADING_MESSAGES_ZH: string[] = [
  '去喝杯咖啡，2 分钟后就好…',
  '休息休息眼睛，再稍等一下 ☺',
  'AI 正在认真思考每个词的用法…',
  '好词解值得等待，马上就好 ✨',
  '泡杯茶也行，不着急～',
];

const LOADING_MESSAGES_EN: string[] = [
  'Grab a coffee, it will be ready in ~2 min…',
  'Rest your eyes, just a moment longer ☺',
  'AI is carefully considering every word usage…',
  'Good explanations are worth the wait, almost there ✨',
  'Or brew some tea, no rush~',
];

/** 文案切换间隔（毫秒）：柔和渐隐渐显，10 秒一轮 */
const MESSAGE_ROTATE_MS = 10000;

export type AiLoadingOverlayProps = {
  visible: boolean;
  /** 界面语言：'en' 只显示英文，其余（含未传）显示中文 */
  lang?: string;
};

/**
 * AI 生成时的统一等待遮罩：手绘咖啡杯动画 + 流动进度条 + ,random 轮换文案。
 * 进度条为装饰性不确定动画（非真实进度），用于缓解"无反应"的焦虑感。
 */
export function AiLoadingOverlay({ visible, lang }: AiLoadingOverlayProps) {
  const pool = lang === 'en' ? LOADING_MESSAGES_EN : LOADING_MESSAGES_ZH;

  // 首次挂载随机挑一句作为起点，避免每次都从同一句开始
  const [messageIndex, setMessageIndex] = useState(() =>
    Math.floor(Math.random() * pool.length),
  );

  // 进场时再随机一次，保证视觉新鲜
  const initialIndex = useMemo(
    () => Math.floor(Math.random() * pool.length),
    [pool.length],
  );

  useEffect(() => {
    if (!visible) return;
    setMessageIndex(initialIndex);
    const timer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % pool.length);
    }, MESSAGE_ROTATE_MS);
    return () => clearInterval(timer);
  }, [visible, initialIndex, pool.length]);

  if (!visible) return null;

  const msg = pool[messageIndex]!;

  return (
    <div className="ai-loading-overlay" role="status" aria-live="polite">
      <div className="ai-loading-overlay__card">
        <div className="ai-loading-overlay__cup" aria-hidden="true">
          <svg viewBox="0 0 120 120" width="96" height="96" className="ai-loading-cup">
            {/* 蒸汽 */}
            <g className="ai-loading-cup__steam">
              <path className="ai-loading-steam ai-loading-steam--1" d="M48 30 q-6 -10 0 -20 q6 -10 0 -20" />
              <path className="ai-loading-steam ai-loading-steam--2" d="M62 30 q-6 -10 0 -20 q6 -10 0 -20" />
              <path className="ai-loading-steam ai-loading-steam--3" d="M76 30 q-6 -10 0 -20 q6 -10 0 -20" />
            </g>
            {/* 杯身 */}
            <g className="ai-loading-cup__body">
              <path
                className="ai-loading-cup__mug"
                d="M34 44 h52 l-5 46 a8 8 0 0 1 -8 7 H47 a8 8 0 0 1 -8 -7 Z"
              />
              {/* 咖啡液面 */}
              <ellipse className="ai-loading-cup__liquid" cx="60" cy="46" rx="26" ry="5" />
              {/* 把手 */}
              <path
                className="ai-loading-cup__handle"
                d="M86 52 q18 2 18 18 q0 16 -18 18"
              />
              {/* 杯身手绘高光 */}
              <path className="ai-loading-cup__shine" d="M44 54 q-3 20 2 34" />
            </g>
            {/* 碟子 */}
            <path className="ai-loading-cup__saucer" d="M28 100 q32 12 64 0 q-32 8 -64 0 Z" />
          </svg>
        </div>

        <div className="ai-loading-overlay__bar" aria-hidden="true">
          <div className="ai-loading-overlay__bar-fill" />
        </div>

        <p key={messageIndex} className="ai-loading-overlay__msg">
          {msg}
        </p>
      </div>
    </div>
  );
}

export default AiLoadingOverlay;
