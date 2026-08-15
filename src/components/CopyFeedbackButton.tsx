import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, Check } from 'lucide-react';

const KINARI = '#EAE370';
const KINARI_TEXT = '#2B2B1A';

type CopyFeedbackButtonProps = {
  onClick?: () => void | Promise<void>;
  /** 复制成功、按钮进入成功态后触发（用于通知父组件切换流程） */
  onActivated?: () => void;
  /** 文案（中文 / 英文 由调用方传入） */
  idleLabel: string;
  doneLabel: string;
  /** 成功态自动恢复的毫秒数 */
  resetAfterMs?: number;
  disabled?: boolean;
  className?: string;
};

export function CopyFeedbackButton({
  onClick,
  onActivated,
  idleLabel,
  doneLabel,
  resetAfterMs = 2000,
  disabled = false,
  className = '',
}: CopyFeedbackButtonProps) {
  const [done, setDone] = useState(false);
  const timerRef = useRef<number | null>(null);

  // 成功态维持 resetAfterMs 后自动恢复
  useEffect(() => {
    if (!done) return;
    timerRef.current = window.setTimeout(() => setDone(false), resetAfterMs);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [done, resetAfterMs]);

  const handleClick = async () => {
    if (disabled) return;
    await onClick?.();
    setDone(true);
    onActivated?.();
  };

  return (
    <motion.button
      type="button"
      layout
      onClick={handleClick}
      disabled={disabled}
      transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.9 }}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-full',
        'px-5 h-12 select-none cursor-pointer',
        'font-medium text-sm tracking-wide',
        disabled ? 'cursor-not-allowed opacity-50' : '',
        className,
      ].join(' ')}
      style={{
        backgroundColor: done ? KINARI : '#F3F4F6',
        color: KINARI_TEXT,
      }}
      animate={{
        backgroundColor: done ? KINARI : '#F3F4F6',
      }}
    >
      {/* 图标：Wand2 → Check 无缝切换 */}
      <motion.span
        layout
        className="relative flex items-center justify-center"
        style={{ width: 18, height: 18 }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {done ? (
            <motion.span
              key="check"
              layout
              initial={{ opacity: 0, scale: 0.4, rotate: -30 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.4, rotate: 30 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Check size={18} strokeWidth={2.4} color={KINARI_TEXT} />
            </motion.span>
          ) : (
            <motion.span
              key="wand"
              layout
              initial={{ opacity: 0, scale: 0.4, rotate: 30 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.4, rotate: -30 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Wand2 size={18} strokeWidth={2} color={KINARI_TEXT} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>

      {/* 文字：宽度自适应弹簧过渡 */}
      <motion.span layout className="whitespace-nowrap">
        {done ? doneLabel : idleLabel}
      </motion.span>
    </motion.button>
  );
}

export default CopyFeedbackButton;
