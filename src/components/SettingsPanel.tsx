import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getAppSettings,
  saveAppSettings,
  type AppSettings,
  type ColorTheme,
  type InterfaceLanguage,
  type LearningTargetLanguage,
} from '../services/appSettings';

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

const LEARNING_TARGET_OPTIONS: { id: LearningTargetLanguage; label: string }[] = [
  { id: 'jp', label: 'JAP' },
  { id: 'ko', label: 'KOR' },
  { id: 'en', label: 'ENG' },
  { id: 'zh', label: '中文' },
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

  const toggleLearningTarget = (id: LearningTargetLanguage) => {
    const current = settings.learningTargetLanguages;
    const has = current.includes(id);
    if (has && current.length <= 1) return;
    const next = has ? current.filter((t) => t !== id) : [...current, id];
    patch({ learningTargetLanguages: next });
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
            <p className="app-settings__label">语言矩阵</p>
            <p className="app-settings__sublabel">使用语言</p>
            <div className="app-settings__segmented">
              <button
                type="button"
                className={`app-settings__segment${settings.interfaceLanguage === 'zh' ? ' is-active' : ''}`}
                onClick={() => patch({ interfaceLanguage: 'zh' as InterfaceLanguage })}
              >
                中文
              </button>
              <button
                type="button"
                className={`app-settings__segment${settings.interfaceLanguage === 'en' ? ' is-active' : ''}`}
                onClick={() => patch({ interfaceLanguage: 'en' as InterfaceLanguage })}
              >
                English
              </button>
            </div>
            <p className="app-settings__hint">决定词解、翻译、语法解析在 Prompt 中的输出语言（中文 / English）</p>

            <p className="app-settings__sublabel app-settings__sublabel--targets">学习目标语言</p>
            <div className="app-settings__lang-chips">
              {LEARNING_TARGET_OPTIONS.map(({ id, label }) => {
                const active = settings.learningTargetLanguages.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    className={`app-settings__lang-chip${active ? ' is-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => toggleLearningTarget(id)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="app-settings__hint">首页拨轮显示 AUTO + 已选语言；至少保留一项</p>
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
            <label className="app-settings__row">
              <span className="app-settings__row-text">交互音效</span>
              <input
                type="checkbox"
                className="app-settings__checkbox"
                checked={settings.interactionSoundsEnabled}
                onChange={(e) => patch({ interactionSoundsEnabled: e.target.checked })}
              />
            </label>
            <p className="app-settings__hint">开启时，按键与拨轮定住附带轻震与 Logitech 点按声</p>
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
