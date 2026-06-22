import type { RefObject } from 'react';
import LinkChainIcon from '../icons/LinkChainIcon';
import SettingsMenuIcon from '../icons/SettingsMenuIcon';

type Props = {
  showHomeChrome: boolean;
  compact: boolean;
  hasMusicLink: boolean;
  chainBtnRef: RefObject<HTMLButtonElement | null>;
  onChainClick: () => void;
  onSettingsClick: () => void;
};

export default function AppHeader({
  showHomeChrome,
  compact,
  hasMusicLink,
  chainBtnRef,
  onChainClick,
  onSettingsClick,
}: Props) {
  return (
    <header
      className={`app-header app-brand-bar app-screen__header${compact ? ' app-header--compact' : ''}`}
    >
      <div className="app-brand-bar__inner">
        <div className="app-brand-bar__top">
          {showHomeChrome && (
            <div className="app-chain-btn-wrapper">
              <button
                ref={chainBtnRef}
                type="button"
                className={`app-chain-btn${hasMusicLink ? ' has-link' : ''}`}
                aria-label={hasMusicLink ? '已检测到音乐链接' : '暂无音乐链接'}
                onClick={onChainClick}
              >
                <LinkChainIcon />
              </button>
            </div>
          )}
          <div className="app-brand-stack">
            <p className="app-brand">SHUFURI</p>
            <p className="app-brand-tagline">优雅简洁的日语释音与排版助手</p>
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
