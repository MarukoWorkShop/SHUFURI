import SquarePenIcon from './icons/SquarePenIcon';
import Undo2Icon from './icons/Undo2Icon';
import './InkToolbox.css';

type Props = {
  open: boolean;
  canUndo: boolean;
  showRuby: boolean;
  rubySupported: boolean;
  onToggle: () => void;
  onUndo: () => void;
  onShowRubyChange: (show: boolean) => void;
};

export default function InkToolbox({
  open,
  canUndo,
  showRuby,
  rubySupported,
  onToggle,
  onUndo,
  onShowRubyChange,
}: Props) {
  return (
    <div className={`ink-toolbox${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="ink-toolbox__trigger"
        aria-label={open ? '收起文具盒' : '打开文具盒'}
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="ink-toolbox__chevron" aria-hidden="true" />
      </button>
      <div className="ink-toolbox__panel" role="toolbar" aria-label="编辑工具">
        <button
          type="button"
          className="ink-toolbox__tool is-active"
          aria-label="铅笔编辑"
          aria-pressed
          tabIndex={-1}
        >
          <SquarePenIcon className="ink-toolbox__icon" />
        </button>
        <button
          type="button"
          className={`ink-toolbox__tool ink-toolbox__tool--ruby${showRuby ? ' is-active' : ''}`}
          aria-label={showRuby ? '隐藏注音' : '显示注音'}
          aria-pressed={showRuby}
          disabled={!rubySupported}
          onClick={() => onShowRubyChange(!showRuby)}
        >
          <span className="ink-toolbox__ruby-label">注音</span>
        </button>
        <button
          type="button"
          className="ink-toolbox__tool ink-toolbox__tool--undo"
          aria-label="回退上一步修改"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2Icon className="ink-toolbox__icon" />
        </button>
      </div>
    </div>
  );
}
