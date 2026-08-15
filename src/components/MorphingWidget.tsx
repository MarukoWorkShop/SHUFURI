import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wand2,
  Check,
  ClipboardPaste,
  X,
  Music,
  BookOpen,
  Sparkles,
  GraduationCap,
  ArrowUpRight,
} from 'lucide-react';
import { L } from '../utils/i18n';

const KINARI_TEXT = '#2B2B1A';

/** 状态 A（"去生成AI口令"）未复制时轮换的图标池：学习 / 音乐 / 魔法 主题 */
const CAROUSEL_ICONS = [Wand2, Music, BookOpen, Sparkles, GraduationCap];

type MorphingWidgetProps = {
  /** 状态 A 点击回调：复制口令 */
  onCopyPrompt?: () => void | Promise<void>;
  /** 状态 B 点击回调：粘贴 AI 结果并生成学习材料 */
  onPasteResult?: () => void;
  /** 是否禁用状态 A 的复制按钮 */
  disabled?: boolean;
};

/** 微件内部模式：A = 复制口令 / B = 粘贴结果 */
type WidgetMode = 'A' | 'B';

export function MorphingWidget({
  onCopyPrompt,
  onPasteResult,
  disabled = false,
}: MorphingWidgetProps) {
  const [mode, setMode] = useState<WidgetMode>('A');
  const [copied, setCopied] = useState(false);

  // 图标轮换（状态 A 未复制态）：每 3 秒随机切换，且避免与上一个相同
  const [iconIdx, setIconIdx] = useState(0);
  useEffect(() => {
    if (copied) return; // 复制态固定显示 Check，不轮换
    const timer = setInterval(() => {
      setIconIdx((prev) => {
        let next = prev;
        while (next === prev && CAROUSEL_ICONS.length > 1) {
          next = Math.floor(Math.random() * CAROUSEL_ICONS.length);
        }
        return next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [copied]);

  // 模式 A：点击复制
  const handleCopy = async () => {
    if (disabled) return;
    await onCopyPrompt?.();
    setCopied(true);
  };

  // X 按钮：复制后点击进入粘贴态（B）；否则重置回模式 A
  const handleReset = () => {
    if (copied) {
      setCopied(false);
      setMode('B');
    } else {
      setCopied(false);
      setMode('A');
    }
  };

  return (
    <motion.div
      layout
      className="morphing-widget"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
      transition={{ type: 'spring', stiffness: 420, damping: 30, mass: 0.85 }}
    >
      {/* ===== 主操作按钮（pill）===== */}
      <AnimatePresence mode="popLayout" initial={false}>
        {mode === 'A' ? (
          <motion.button
            key="btn-copy"
            type="button"
            layout
            onClick={handleCopy}
            disabled={disabled}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
            className={[
              'morphing-widget__pill',
              'morphing-widget__pill--gen',
              disabled ? 'is-disabled' : '',
              copied ? 'is-copied' : '',
            ].join(' ')}
          >
            {/* 光波扫过层（绝对定位，overflow-hidden 容器裁剪） */}
            <span className="morphing-widget__shimmer" aria-hidden="true" />

            <motion.span
              layout
              className="morphing-widget__icon-wrap"
              style={{ width: 18, height: 18 }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                  <motion.span
                    key="check"
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.4 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="morphing-widget__icon-abs"
                  >
                    <Check size={18} strokeWidth={2.4} color={KINARI_TEXT} />
                  </motion.span>
                ) : (
                  <motion.span
                    key={`icon-${iconIdx}`}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="morphing-widget__icon-abs"
                  >
                    {(() => {
                      const Icon = CAROUSEL_ICONS[iconIdx];
                      return <Icon size={18} strokeWidth={2} color={KINARI_TEXT} />;
                    })()}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.span>

            <motion.span layout className="whitespace-nowrap">
              {copied
                ? L('已复制', 'Copied')
                : L('去生成AI口令', 'Generate AI Prompt')}
            </motion.span>

            {/* 右上角箭头：hover 时向右上微移 */}
            {!copied && (
              <motion.span layout className="morphing-widget__arrow" aria-hidden="true">
                <ArrowUpRight size={16} strokeWidth={2} color={KINARI_TEXT} />
              </motion.span>
            )}
          </motion.button>
        ) : (
          <motion.button
            key="btn-paste"
            type="button"
            layout
            onClick={onPasteResult}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
            className="morphing-widget__pill morphing-widget__pill--paste"
          >
            <ClipboardPaste size={18} strokeWidth={1.6} color="#ffffff" />
            <motion.span layout className="whitespace-nowrap">
              {L('粘贴 AI 返回的结果', 'Paste AI Result')}
            </motion.span>
            <motion.span layout className="morphing-widget__arrow morphing-widget__arrow--light" aria-hidden="true">
              <ArrowUpRight size={16} strokeWidth={2} color="#ffffff" />
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ===== 圆形 X 按钮：仅"已复制"态浮现，引导用户进入下一步 ===== */}
      <AnimatePresence mode="popLayout" initial={false}>
        {copied && (
          <motion.button
            key="btn-x"
            type="button"
            layout
            initial={{ opacity: 0, scale: 0.5, width: 0, marginLeft: 0 }}
            animate={{ opacity: 1, scale: 1, width: 36, marginLeft: 8 }}
            exit={{ opacity: 0, scale: 0.5, width: 0, marginLeft: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            onClick={handleReset}
            aria-label={L('重置', 'Reset')}
            className="morphing-widget__x-btn is-guide"
            whileTap={{ scale: 0.9 }}
          >
            <X size={16} strokeWidth={2} color="#ffffff" />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** 兼容旧名 */
export default MorphingWidget;
