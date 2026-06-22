import './PosterRubyToggleButton.css';

type Props = {
  showRuby: boolean;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
};

export default function PosterRubyToggleButton({
  showRuby,
  disabled = false,
  className,
  onClick,
}: Props) {
  return (
    <button
      type="button"
      className={`poster-ruby-toggle${showRuby ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      aria-label={showRuby ? '隐藏注音' : '显示注音'}
      aria-pressed={showRuby}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="poster-ruby-toggle__label">音</span>
    </button>
  );
}
