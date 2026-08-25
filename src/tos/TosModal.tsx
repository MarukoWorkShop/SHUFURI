import { useEffect, useState } from 'react';

interface TosModalProps {
  open: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const TOS_LINK = '/terms';

export function TosModal({ open, onConfirm, onClose }: TosModalProps) {
  const [checked, setChecked] = useState(false);
  // 控制 mounted 以实现平滑淡出（先淡出再卸载）
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setChecked(false); // 每次打开重置勾选态
    }
  }, [open]);

  // 关闭时延迟卸载，等待过渡完成
  useEffect(() => {
    if (!open && mounted) {
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [open, mounted]);

  // 支持 Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const canConfirm = checked;

  return (
    <div
      // 背景遮罩：淡入淡出 + 轻微模糊
      className={[
        'fixed inset-0 z-50 flex items-center justify-center px-4',
        'bg-black/10 backdrop-blur-sm',
        'transition-opacity duration-300 ease-out',
        open ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
    >
      <div
        // 模态容器：缩放进入 + 极简灰调
        className={[
          'w-full max-w-md rounded-2xl border border-zinc-200 bg-zinc-50',
          'p-7 shadow-[0_8px_30px_rgb(0,0,0,0.08)]',
          'transition-all duration-300 ease-out',
          open ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <h2 className="text-lg font-medium tracking-wide text-zinc-800">
          准备生成您的专属排版
        </h2>

        {/* 描述 */}
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          在将歌词与词汇转化为最终的实体排版之前，我们需要确认您的使用授权。
        </p>

        {/* 勾选行 */}
        <label className="mt-6 flex cursor-pointer items-start gap-3 select-none">
          {/* 自定义复选框 */}
          <span
            className={[
              'mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-200',
              checked
                ? 'border-zinc-700 bg-zinc-800'
                : 'border-zinc-300 bg-white',
            ].join(' ')}
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 14 14"
              className={[
                'h-3 w-3 text-zinc-50 transition-opacity duration-200',
                checked ? 'opacity-100' : 'opacity-0',
              ].join(' ')}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2.5 7.5L5.5 10.5L11.5 3.5" />
            </svg>
          </span>

          <input
            type="checkbox"
            className="sr-only"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />

          <span className="text-sm leading-relaxed text-zinc-600">
            我已阅读并同意
            <a
              href={TOS_LINK}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-zinc-400 underline-offset-2 text-zinc-700 hover:text-zinc-900"
            >
              《SHUFURI 服务协议》
            </a>
            ，并承诺我对所引用的内容拥有合法的个人使用权利。
          </span>
        </label>

        {/* 操作按钮 */}
        <button
          type="button"
          disabled={!canConfirm}
          onClick={onConfirm}
          className={[
            'mt-7 w-full rounded-lg py-2.5 text-sm font-medium transition-colors duration-200',
            canConfirm
              ? 'bg-zinc-800 text-zinc-50 hover:bg-zinc-700'
              : 'bg-zinc-200 text-zinc-400 cursor-not-allowed',
          ].join(' ')}
        >
          确认并继续
        </button>
      </div>
    </div>
  );
}
