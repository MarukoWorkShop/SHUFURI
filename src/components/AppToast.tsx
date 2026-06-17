type Props = {
  message: string | null | undefined;
  placement?: 'fixed' | 'anchored';
};

/** 全局轻提示 — 样式见 styles/app/toast.css */
export default function AppToast({ message, placement = 'fixed' }: Props) {
  if (!message) return null;

  return (
    <div
      className={`app-toast app-toast--${placement}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
