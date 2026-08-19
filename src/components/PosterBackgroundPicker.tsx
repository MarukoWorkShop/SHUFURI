import { useMemo, useState } from 'react';
import {
  POSTER_BACKGROUNDS,
  getPosterBackgroundById,
} from '../config/posterBackgrounds';
import { L } from '../utils/i18n';
import './PosterBackgroundPicker.css';

type Props = {
  value: string;
  onChange: (id: string) => void;
};

export default function PosterBackgroundPicker({ value, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const selected = useMemo(
    () => getPosterBackgroundById(value) ?? POSTER_BACKGROUNDS[0]!,
    [value],
  );

  return (
    <div className="poster-bg-picker" role="group" aria-label={L('选择背景', 'Choose background')}>
      <button
        type="button"
        className="poster-bg-picker__toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={L('背景选项', 'Background options')}
      >
        <span className={`poster-bg-picker__caret${expanded ? ' is-open' : ''}`} aria-hidden />
      </button>

      {expanded && (
        <div className="poster-bg-picker__panel">
          {POSTER_BACKGROUNDS.map((bg) => {
            const isSelected = bg.id === selected.id;
            return (
              <button
                key={bg.id}
                type="button"
                className={`poster-bg-picker__item${isSelected ? ' is-selected' : ''}`}
                onClick={() => onChange(bg.id)}
                aria-pressed={isSelected}
                title={L(bg.name, bg.nameEn)}
              >
                <span className="poster-bg-picker__thumb">
                  {bg.file ? (
                    <img src={bg.file} alt="" loading="lazy" />
                  ) : (
                    <span className="poster-bg-picker__plain" />
                  )}
                </span>
                <span className="poster-bg-picker__name">{L(bg.name, bg.nameEn)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
