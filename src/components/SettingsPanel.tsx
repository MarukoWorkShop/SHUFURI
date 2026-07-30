import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getAppSettings,
  saveAppSettings,
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

type Props = {
  open: boolean;
  onClose: () => void;
  onChange?: (settings: AppSettings) => void;
  /** 全量导入后刷新首页歌词本 / Study Cards */
  onLibraryImported?: () => void;
};

const APP_VERSION = '1.0.0';

const LEARNING_TARGET_OPTIONS: { id: LearningTargetLanguage; label: string }[] = [
  { id: 'jp', label: 'JAP' },
  { id: 'ko', label: 'KOR' },
  { id: 'en', label: 'ENG' },
  { id: 'zh', label: '中文' },
];

const LEARNING_TARGET_EN_LABELS: Record<LearningTargetLanguage, string> = {
  jp: 'JAP',
  ko: 'KOR',
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
        `${L('已导出', 'Exported')} ${result.lyricsCount} ${L('首歌词、', ' lyrics, ')}${result.studyCardsCount} ${L('张学习卡', ' study cards')}`,
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : L('导出失败', 'Export failed'));
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
        `${L('已导入', 'Imported')} ${result.lyricsUpserted} ${L('首歌词、', ' lyrics, ')}${result.studyCardsWritten} ${L('张学习卡', ' study cards')}` +
          (result.studyCardsSkipped ? `${L('（跳过', ' (skipped ')}${result.studyCardsSkipped})` : ''),
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : L('导入失败', 'Import failed'));
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
              className={`app-settings__lang-toggle${settings.interfaceLanguage === 'en' ? ' is-en' : ''}`}
              role="group"
              aria-label={L('使用语言', 'Interface Language')}
            >
              <span className="app-settings__lang-toggle__thumb" aria-hidden="true" />
              <PressedButton
                className={`app-settings__lang-toggle__option${settings.interfaceLanguage === 'zh' ? ' is-active' : ''}`}
                pressed={settings.interfaceLanguage === 'zh'}
                onClick={() => patch({ interfaceLanguage: 'zh' as InterfaceLanguage })}
              >
                中文
              </PressedButton>
              <PressedButton
                className={`app-settings__lang-toggle__option${settings.interfaceLanguage === 'en' ? ' is-active' : ''}`}
                pressed={settings.interfaceLanguage === 'en'}
                onClick={() => patch({ interfaceLanguage: 'en' as InterfaceLanguage })}
              >
                English
              </PressedButton>
            </div>
            <p className="app-settings__lang-toggle-status" aria-live="polite">
              {L('当前释义语言：', 'Gloss language: ')}
              <strong>
                {settings.interfaceLanguage === 'zh' ? '中文' : 'English'}
              </strong>
            </p>
            <p className="app-settings__hint">{L('词解、翻译、语法解析在 Prompt 中的输出语言', 'Output language for vocab, translation, grammar in prompts')}</p>

            <p className="app-settings__sublabel app-settings__sublabel--targets">{L('学习目标语言', 'Learning target languages')}</p>
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
            <p className="app-settings__hint">{L('首页拨轮显示 AUTO + 已选语言；至少保留一项', 'Homepage wheel shows AUTO + selected; keep at least one')}</p>
          </section>

          <section className="app-settings__section">
            <p className="app-settings__row-text">{L('附词解与语法品读', 'Vocab & grammar annotation')}</p>
            <p className="app-settings__hint">
              {L('在歌词确认页勾选后，会按下方难度生成词解与语法讲解', 'When enabled on the confirm page, vocab & grammar will be generated at the level below')}
            </p>
            <p className="app-settings__sublabel app-settings__sublabel--targets">{L('词解难度', 'Pedagogical level')}</p>
            <div
              className="app-settings__segmented app-settings__segmented--triple"
              role="group"
              aria-label={L('词解难度', 'Pedagogical level')}
            >
              {PEDAGOGICAL_LEVEL_ORDER.map((level) => (
                <PressedButton
                  key={level}
                  className={`app-settings__segment${settings.defaultPedagogicalLevel === level ? ' is-active' : ''}`}
                  pressed={settings.defaultPedagogicalLevel === level}
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
                {backupBusy ? '…' : L('导出歌词与单词（JSON）', 'Export lyrics & vocab (JSON)')}
              </button>
              <button
                type="button"
                className="app-settings__backup-btn"
                disabled={backupBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                {backupBusy ? '…' : L('全量导入', 'Full import')}
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
