import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getAppSettings,
  saveAppSettings,
  resolveSystemInterfaceLanguage,
  type AppSettings,
  type InterfaceLanguage,
  type LearningTargetLanguage,
  type PedagogicalLevel,
} from '../services/appSettings';
import {
  PEDAGOGICAL_LEVEL_ORDER,
  pedagogicalLevelFrameworkDetail,
  pedagogicalLevelLabel,
  pedagogicalLevelSettingsIntro,
} from '../services/pedagogicalLevel';
import {
  exportLibraryBackupJson,
  importLibraryBackupJson,
  readLibraryBackupFile,
} from '../services/libraryBackup';
import { useAppToast } from '../context/AppToastContext';
import { L } from '../utils/i18n';
import { PressedButton } from './a11y/AriaToggleButtons';
import { useDarkMode } from '../hooks/useDarkMode';

type Props = {
  open: boolean;
  onClose: () => void;
  onChange?: (settings: AppSettings) => void;
  /** 全量导入后刷新首页歌词本 / Study Cards */
  onLibraryImported?: () => void;
};

const APP_VERSION = '1.0.0';

const LEARNING_TARGET_OPTIONS: { id: LearningTargetLanguage; label: string }[] = [
  { id: 'jp', label: '日本語' },
  { id: 'ko', label: '한국어' },
  { id: 'en', label: 'ENG' },
  { id: 'zh', label: '中文' },
];

const LEARNING_TARGET_EN_LABELS: Record<LearningTargetLanguage, string> = {
  jp: 'Japanese',
  ko: 'Korean',
  en: 'ENG',
  zh: 'Chinese',
};

export default function SettingsPanel({
  open,
  onClose,
  onChange,
  onLibraryImported,
}: Props) {
  const showToast = useAppToast();
  const { isDark, toggleDark } = useDarkMode();
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => getAppSettings());
  const [backupBusy, setBackupBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    // 关闭延迟必须匹配 CSS transition（--transition-normal = --duration-normal + --ease-out）
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

  const handleExportBackup = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      const result = await exportLibraryBackupJson();
      showToast(
        `${L('已导出', 'Exported.')} ${result.lyricsCount} ${L('首歌词、', 'lyrics,')}${result.studyCardsCount} ${L('张学习卡', 'study cards')}`,
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : L('导出失败', 'Failed to export.'));
    } finally {
      setBackupBusy(false);
    }
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file || backupBusy) return;
    setBackupBusy(true);
    try {
      const text = await readLibraryBackupFile(file);
      const result = await importLibraryBackupJson(text);
      onLibraryImported?.();
      showToast(
        `${L('已导入', 'Imported.')} ${result.lyricsUpserted} ${L('首歌词、', 'lyrics,')}${result.studyCardsWritten} ${L('张学习卡', 'study cards')}` +
          (result.studyCardsSkipped ? `${L('（跳过', '(skipped')}${result.studyCardsSkipped})` : ''),
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : L('导入失败', 'Failed to import.'));
    } finally {
      setBackupBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!visible) return null;

  return createPortal(
    <div
      className={`app-settings${active ? ' is-open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={L('设置', 'Settings')}
      onClick={onClose}
    >
      <div
        className="app-settings__panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="app-settings__header">
          <h2 className="app-settings__title">{L('设置', 'Settings')}</h2>
          <button type="button" className="app-settings__close" onClick={onClose}>
            {L('关闭', 'Close')}
          </button>
        </header>

        <div className="app-settings__body">
          <section className="app-settings__section">
            <p className="app-settings__label">{L('语言矩阵', 'Language Matrix')}</p>
            <p className="app-settings__sublabel">{L('使用语言', 'Interface Language')}</p>
            <div
              className={`app-settings__lang-toggle${settings.interfaceLanguage === 'en' ? ' is-en' : ''}${settings.followSystemLanguage ? ' is-locked' : ''}`}
              role="group"
              aria-label={L('使用语言', 'Interface Language')}
            >
              <span className="app-settings__lang-toggle__thumb" aria-hidden="true" />
              <PressedButton
                className={`app-settings__lang-toggle__option${settings.interfaceLanguage === 'zh' ? ' is-active' : ''}`}
                pressed={settings.interfaceLanguage === 'zh'}
                disabled={settings.followSystemLanguage}
                onClick={() => patch({ interfaceLanguage: 'zh' as InterfaceLanguage })}
              >
                中文
              </PressedButton>
              <PressedButton
                className={`app-settings__lang-toggle__option${settings.interfaceLanguage === 'en' ? ' is-active' : ''}`}
                pressed={settings.interfaceLanguage === 'en'}
                disabled={settings.followSystemLanguage}
                onClick={() => patch({ interfaceLanguage: 'en' as InterfaceLanguage })}
              >
                English
              </PressedButton>
            </div>
            <label
              className="app-settings__row app-settings__row--nested"
              onClick={() => patch({ followSystemLanguage: !settings.followSystemLanguage })}
            >
              <div>
                <span className="app-settings__row-text">
                  {L('跟随系统语言', 'Match System Language')}
                </span>
                {settings.followSystemLanguage && (
                  <p className="app-settings__hint">
                    {L(
                      `检测到：${resolveSystemInterfaceLanguage() === 'zh' ? '中文' : 'English'}`,
                      `Detected: ${resolveSystemInterfaceLanguage() === 'zh' ? '中文' : 'English'}`,
                    )}
                  </p>
                )}
              </div>
              <input
                type="checkbox"
                className="app-settings__checkbox"
                checked={settings.followSystemLanguage}
                readOnly
              />
            </label>
            <p className="app-settings__lang-toggle-status" aria-live="polite">
              {L('当前释义语言：', 'Definition Language:')}
              <strong>
                {settings.interfaceLanguage === 'zh' ? '中文' : 'English'}
              </strong>
            </p>
            <p className="app-settings__hint">{L('词解、翻译、语法解析在 Prompt 中的输出语言', 'Output language for vocab, translation, and grammar in AI prompts.')}</p>

            <p className="app-settings__sublabel app-settings__sublabel--targets">{L('学习目标语言', 'Target Language')}</p>
            <div className="app-settings__lang-chips">
              {LEARNING_TARGET_OPTIONS.map(({ id, label }) => {
                const chipActive = settings.learningTargetLanguages.includes(id);
                return (
                  <PressedButton
                    key={id}
                    className={`app-settings__lang-chip${chipActive ? ' is-active' : ''}`}
                    pressed={chipActive}
                    onClick={() => toggleLearningTarget(id)}
                  >
                    {settings.interfaceLanguage === 'en' ? LEARNING_TARGET_EN_LABELS[id] : label}
                  </PressedButton>
                );
              })}
            </div>
            <p className="app-settings__hint">{L('首页拨轮显示已选语言；至少保留一项', 'Homepage wheel shows the selected languages; keep at least one.')}</p>
          </section>

          <section className="app-settings__section">
            <label
              className="app-settings__row"
              onClick={(e) => { e.preventDefault(); toggleDark(); }}
              style={{ justifyContent: 'space-between', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>
                  {isDark ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  )}
                </span>
                <div>
                  <span className="app-settings__row-text" style={{ fontSize: 'var(--ui-text-base, 15px)' }}>
                    {L('明暗模式', 'Theme')}
                  </span>
                  <p className="app-settings__hint" style={{ margin: 0 }}>
                    {isDark ? L('暗色', 'Dark') : L('浅色', 'Light')}
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                className="app-settings__checkbox"
                checked={isDark}
                readOnly
                style={{ pointerEvents: 'none' }}
              />
            </label>
          </section>

          <section className="app-settings__section">
            <p className="app-settings__row-text">{L('附词解与语法品读', 'Include Vocab & Grammar')}</p>
            <label className="app-settings__row app-settings__row--toggle">
              <span className="app-settings__row-text app-settings__row-text--strong">
                {L('默认勾选词解', 'Opt-in by default')}
              </span>
              <input
                type="checkbox"
                className="app-settings__checkbox"
                checked={settings.defaultIncludeVocabAndGrammar}
                onChange={(e) => patch({ defaultIncludeVocabAndGrammar: e.target.checked })}
              />
            </label>
            <p className="app-settings__hint">
              {L(
                '歌词确认页默认是否勾选「词解与语法」。关闭后弹窗默认不勾选，需手动开启才会生成；保持关闭可加快首次排版体验。',
                'Whether the lyric confirm sheet pre-checks the vocab & grammar box. When off, the sheet defaults to unchecked for a faster first-run layout experience.',
              )}
            </p>
            <p className="app-settings__sublabel app-settings__sublabel--targets">
              {L('词解难度', 'Difficulty Level')}
            </p>
            <div
              className={`app-settings__segmented app-settings__segmented--triple${settings.defaultIncludeVocabAndGrammar ? '' : ' is-locked'}`}
              role="group"
              aria-label={L('词解难度', 'Difficulty Level')}
              aria-disabled={!settings.defaultIncludeVocabAndGrammar}
            >
              {PEDAGOGICAL_LEVEL_ORDER.map((level) => (
                <PressedButton
                  key={level}
                  className={`app-settings__segment${settings.defaultPedagogicalLevel === level ? ' is-active' : ''}`}
                  pressed={settings.defaultPedagogicalLevel === level}
                  disabled={!settings.defaultIncludeVocabAndGrammar}
                  onClick={() => patch({ defaultPedagogicalLevel: level as PedagogicalLevel })}
                >
                  {pedagogicalLevelLabel(level, settings.interfaceLanguage)}
                </PressedButton>
              ))}
            </div>
            <p className="app-settings__hint">{pedagogicalLevelSettingsIntro(settings.interfaceLanguage)}</p>
            <p className="app-settings__hint" aria-live="polite">
              {pedagogicalLevelFrameworkDetail(
                settings.defaultPedagogicalLevel,
                settings.interfaceLanguage,
              )}
            </p>
          </section>

          <section className="app-settings__section">
            <p className="app-settings__label">{L('数据备份', 'Data Backup')}</p>
            <div className="app-settings__backup-actions">
              <button
                type="button"
                className="app-settings__backup-btn"
                disabled={backupBusy}
                onClick={() => void handleExportBackup()}
              >
                {backupBusy ? '…' : L('导出歌词与单词（JSON）', 'Export Lyrics & Vocab (JSON)')}
              </button>
              <button
                type="button"
                className="app-settings__backup-btn"
                disabled={backupBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                {backupBusy ? '…' : L('全量导入', 'Import All')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => void handleImportFile(e.target.files?.[0])}
              />
            </div>
            <p className="app-settings__hint">
              {L('导出包含歌词本与 Study Cards；导入按 id 更新已有条目，不会清空本地库', 'Export includes lyric book & study cards; import updates by id, won\'t clear local library')}
            </p>
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
