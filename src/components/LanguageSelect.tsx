import { useState } from 'react';
import type { LyricsLanguage } from '../services/appSettings';

const FALLBACK_LANGS: LyricsLanguage[] = ['jp', 'ko', 'en', 'zh'];

function langLabel(code: LyricsLanguage): string {
  const base: Record<LyricsLanguage, string> = {
    jp: '日本語',
    ko: '한국어',
    en: 'ENG',
    zh: '中文',
  };
  return base[code] ?? code;
}

type Props = {
  label: string;
  hint: string;
  value: LyricsLanguage;
  languages?: LyricsLanguage[];
  onChange: (lang: LyricsLanguage) => void;
};

/**
 * 语言单选点击框：用一组并排的选中框替代横向滚轮。
 * 标题居左加粗，旁附「?」展开说明。
 */
export default function LanguageSelect({ label, hint, value, languages, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const list = languages && languages.length > 0 ? languages : FALLBACK_LANGS;

  return (
    <div className="lang-select">
      <div className="lang-select__header">
        <span className="lang-select__title">{label}</span>
        <button
          type="button"
          className="lang-select__help"
          aria-label="说明"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          ?
        </button>
      </div>
      {open && <p className="lang-select__hint">{hint}</p>}
      <div className="lang-select__pills" role="radiogroup" aria-label={label}>
        {list.map((code) => {
          const active = code === value;
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={active}
              className={`lang-select__pill${active ? ' is-active' : ''}`}
              onClick={() => onChange(code)}
            >
              <span className="lang-select__pill-main">{langLabel(code)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
