import './SkeletonCard.css';

export interface SkeletonBarProps {
  width?: string;
  height?: number;
  style?: React.CSSProperties;
}

function SkeletonBar({ width = '60%', height = 14, style }: SkeletonBarProps) {
  return (
    <div
      className="skeleton-bar"
      style={{
        width,
        height,
        ...style,
      }}
    />
  );
}

export interface SkeletonCardProps {
  /** Number of skeleton cards to render (default 3) */
  count?: number;
  /** Custom bar layout per card (array of {width, height?}). Uses default if not provided */
  bars?: SkeletonBarProps[][] | null;
}

export default function SkeletonCard({
  count = 3,
  bars = null,
}: SkeletonCardProps) {
  const defaultBars: SkeletonBarProps[][] = Array.from({ length: count }, () => [
    { width: '40%', height: 16 },
    { width: '85%', height: 14 },
    { width: '65%', height: 14 },
    { width: '30%', height: 14, style: { marginTop: 4 } },
  ]);

  const cardBars = bars ?? defaultBars;

  return (
    <div className="skeleton-list" aria-busy="true" aria-label="加载中">
      {cardBars.map((card, cardIdx) => (
        <div key={cardIdx} className="skeleton-card">
          {card.map((bar, barIdx) => (
            <SkeletonBar key={barIdx} {...bar} />
          ))}
        </div>
      ))}
    </div>
  );
}

export { SkeletonBar };
