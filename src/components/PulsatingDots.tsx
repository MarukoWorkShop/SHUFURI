import './PulsatingDots.css';

export type PulsatingDotsProps = {
  /** 圆点数量，默认 3 */
  count?: number;
  /** 圆点颜色，默认跟随当前文字色 */
  color?: string;
  /** 圆点尺寸（px），默认 10 */
  size?: number;
  /** 无障碍标签，默认 "加载中" */
  label?: string;
};

/** 轻量 Loading 动效：一排依次脉动的圆点（效果等价于 shadcn loading-ui 的 pulsating-dots）。 */
export function PulsatingDots({
  count = 3,
  color,
  size = 10,
  label = '加载中',
}: PulsatingDotsProps) {
  const dots = Array.from({ length: count }, (_, i) => i);
  return (
    <span
      className="pulsating-dots"
      role="status"
      aria-label={label}
      style={color ? ({ ['--pulsating-dot-color' as string]: color } as React.CSSProperties) : undefined}
    >
      {dots.map((i) => (
        <span
          key={i}
          className="pulsating-dots__dot"
          style={{ width: size, height: size, animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}
