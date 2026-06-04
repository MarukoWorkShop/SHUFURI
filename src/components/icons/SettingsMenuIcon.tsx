type Props = {
  size?: number;
  strokeWidth?: number;
  className?: string;
};

/** Lucide 风格：三条横杠右对齐、上长下短 */
export default function SettingsMenuIcon({
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
      className={className}
      aria-hidden
    >
      <line x1="5" y1="7" x2="21" y2="7" />
      <line x1="9" y1="12" x2="21" y2="12" />
      <line x1="13" y1="17" x2="21" y2="17" />
    </svg>
  );
}
