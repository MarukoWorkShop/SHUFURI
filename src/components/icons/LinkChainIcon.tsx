type Props = {
  size?: number;
  strokeWidth?: number;
  className?: string;
};

/**
 * 极简链条图标 — Lucide 风格
 * 两个椭圆环连接在一起，象征"链接/链入"
 * 与 SettingsMenuIcon 保持一致的视觉语言
 */
export default function LinkChainIcon({
  size = 22,
  strokeWidth = 1.5,
  className,
}: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* 左上环 */}
      <ellipse cx="8.5" cy="8.5" rx="4" ry="4" />
      {/* 右下环 */}
      <ellipse cx="15.5" cy="15.5" rx="4" ry="4" />
      {/* 连接线 */}
      <line x1="12.3" y1="11.5" x2="11.5" y2="12.5" />
    </svg>
  );
}
