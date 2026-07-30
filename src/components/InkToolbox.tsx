import SquarePenIcon from './icons/SquarePenIcon';
import Undo2Icon from './icons/Undo2Icon';
import PosterRubyToggleButton from './PosterRubyToggleButton';
import { L } from '../utils/i18n';
import './InkToolbox.css';

type Props = {
  open: boolean;
  canUndo: boolean;
  inkEditActive?: boolean;
  showRuby: boolean;
  rubySupported: boolean;
  explainActive?: boolean;
  onToggle: () => void;
  onUndo: () => void;
  onShowRubyChange: (show: boolean) => void;
  onToggleInkEdit?: () => void;
  onToggleExplain?: () => void;
};

export default function InkToolbox({
  open,
  canUndo,
  inkEditActive = false,
  showRuby,
  rubySupported,
  explainActive = false,
  onToggle,
  onUndo,
  onShowRubyChange,
  onToggleInkEdit,
  onToggleExplain,
}: Props) {
  return (
    <div className={`ink-toolbox${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="ink-toolbox__trigger"
        aria-label={open ? L('收起文具盒', 'Close Toolbox') : L('打开文具盒', 'Open Toolbox')}
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="ink-toolbox__chevron" aria-hidden="true" />
      </button>
      <div className="ink-toolbox__panel" role="toolbar" aria-label={L('编辑工具', 'Edit Tools')}>
        <button
          type="button"
          className={`ink-toolbox__tool${inkEditActive ? ' is-active' : ''}`}
          aria-label={inkEditActive ? L('退出铅笔编辑', 'Exit Quick Edit') : L('铅笔编辑', 'Quick Edit')}
          aria-pressed={inkEditActive}
          onClick={() => onToggleInkEdit?.()}
        >
          <SquarePenIcon className="ink-toolbox__icon" />
        </button>
        <PosterRubyToggleButton
          className="ink-toolbox__tool"
          showRuby={showRuby}
          disabled={!rubySupported}
          onClick={() => onShowRubyChange(!showRuby)}
        />
        {onToggleExplain && (
          <button
            type="button"
            className={`ink-toolbox__tool ink-toolbox__tool--explain${explainActive ? ' is-active' : ''}`}
            aria-label={explainActive ? L('退出划词解释', 'Exit Explanation') : L('划词解释', 'Explain Selection')}
            aria-pressed={explainActive}
            onClick={onToggleExplain}
          >
            <span className="ink-toolbox__explain-mark" aria-hidden>
              ?
            </span>
          </button>
        )}
        <button
          type="button"
          className="ink-toolbox__tool ink-toolbox__tool--undo"
          aria-label={L('回退上一步修改', 'Undo')}
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2Icon className="ink-toolbox__icon" />
        </button>
      </div>
    </div>
  );
}
