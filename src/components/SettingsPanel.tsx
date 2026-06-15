import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getAppSettings,
  saveAppSettings,
  type AppSettings,
  type ColorTheme,
} from '../services/appSettings';
import type { PosterLayoutProfile } from '../utils/furiganaLayout/types';

type Props = {
  open: boolean;
  onClose: () => void;
  onChange?: (settings: AppSettings) => void;
};

const APP_VERSION = '1.0.0';

const COLOR_THEMES: { id: ColorTheme; label: string }[] = [
  { id: 'mono', label: '墨' },
  { id: 'blue', label: '绀' },
  { id: 'red', label: '赤' },
];

export default function SettingsPanel({ open, onClose, onChange }: Props) {
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => getAppSettings());

  useEffect(() => {
    if (!open) return;
    setSettings(getAppSettings());
    setVisible(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setActive(true));
    });
  }, [open]);

  useEffect(() => {
    if (open) return;
    setActive(false);
    const timer = window.setTimeout(() => setVisible(false), 280);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const patch = useCallback(
    (partial: Partial<AppSettings>) => {
      const next = saveAppSettings(partial);
      setSettings(next);
      onChange?.(next);
    },
    [onChange],
  );

  const handleLayoutChange = (layout: PosterLayoutProfile) => {
    patch({ defaultExportLayout: layout });
  };

  if (!visible) return null;

  return createPortal(
    <div
      className={`app-settings${active ? ' is-open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="设置"
      onClick={onClose}
    >
      <div
        className="app-settings__panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="app-settings__header">
          <h2 className="app-settings__title">设置</h2>
          <button type="button" className="app-settings__close" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="app-settings__body">
          <section className="app-settings__section">
            <p className="app-settings__label">界面配色</p>
            <div className="app-settings__theme-row">
              {COLOR_THEMES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={`app-settings__theme-btn${settings.colorTheme === id ? ' is-active' : ''}`}
                  data-theme-preview={id}
                  aria-pressed={settings.colorTheme === id}
                  onClick={() => patch({ colorTheme: id })}
                >
                  <span className="app-settings__theme-swatch" aria-hidden />
                  <span className="app-settings__theme-label">{label}</span>
                </button>
              ))}
            </div>
            <p className="app-settings__hint">切换全局按钮、输入框与面板色调</p>
          </section>

          <section className="app-settings__section">
            <p className="app-settings__label">默认导出规格</p>
            <div className="app-settings__segmented">
              <button
                type="button"
                className={`app-settings__segment${settings.defaultExportLayout === 'clipPosterPrint' ? ' is-active' : ''}`}
                onClick={() => handleLayoutChange('clipPosterPrint')}
              >
                B5 打印
              </button>
              <button
                type="button"
                className={`app-settings__segment${settings.defaultExportLayout === 'mobilePoster' ? ' is-active' : ''}`}
                onClick={() => handleLayoutChange('mobilePoster')}
              >
                手机竖屏
              </button>
            </div>
            <p className="app-settings__hint">新建排版进入导出时使用的默认画布尺寸</p>
          </section>

          <section className="app-settings__section">
            <label className="app-settings__row">
              <span className="app-settings__row-text">附词解与语法品读</span>
              <input
                type="checkbox"
                className="app-settings__checkbox"
                checked={settings.defaultIncludeVocabAndGrammar}
                onChange={(e) => patch({ defaultIncludeVocabAndGrammar: e.target.checked })}
              />
            </label>
            <p className="app-settings__hint">开启时，「一键生成指令」会要求 AI 附带词解与语法板块</p>
          </section>

          <section className="app-settings__section">
            <p className="app-settings__label">歌词语言</p>
            <div className="app-settings__segmented">
              <button
                type="button"
                className={`app-settings__segment${settings.lyricsLanguage === 'jp' ? ' is-active' : ''}`}
                onClick={() => patch({ lyricsLanguage: 'jp' })}
              >
                日语
              </button>
              <button
                type="button"
                className={`app-settings__segment${settings.lyricsLanguage === 'ko' ? ' is-active' : ''}`}
                onClick={() => patch({ lyricsLanguage: 'ko' })}
              >
                韩语
              </button>
            </div>
            <p className="app-settings__hint">选择歌词语言模式，「一键生成指令」将生成对应语言的 Prompt（韩语模式无注音规则）</p>
          </section>

          <section className="app-settings__section">
            <label className="app-settings__row">
              <span className="app-settings__row-text">交互音效</span>
              <input
                type="checkbox"
                className="app-settings__checkbox"
                checked={settings.interactionSoundsEnabled}
                onChange={(e) => patch({ interactionSoundsEnabled: e.target.checked })}
              />
            </label>
            <p className="app-settings__hint">开启时，按键附带轻震与短促「カタ」声（物理质感，非电子音）</p>
          </section>

          <footer className="app-settings__footer">
            <p className="app-settings__version">SHUFURI v{APP_VERSION}</p>
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  );
}
