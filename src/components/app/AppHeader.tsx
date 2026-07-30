import SettingsMenuIcon from '../icons/SettingsMenuIcon';

type Props = {
  showHomeChrome: boolean;
  compact: boolean;
  onSettingsClick: () => void;
};

export default function AppHeader({
  showHomeChrome,
  compact,
  onSettingsClick,
}: Props) {
  return (
    <header
      className={`app-header app-brand-bar app-screen__header${compact ? ' app-header--compact' : ''}`}
    >
      <div className="app-brand-bar__inner">
        <div className="app-brand-bar__top">
          <div className="app-brand-stack">
            <p className="app-brand">SHUFURI</p>
          </div>
          {showHomeChrome && (
            <div className="app-header-buttons">
              <button
                type="button"
                className="app-settings-btn"
                aria-label="设置"
                onClick={onSettingsClick}
              >
                <SettingsMenuIcon />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
