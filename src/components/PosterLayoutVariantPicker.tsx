import { useState } from 'react';
import { L } from '../utils/i18n';
import type { PosterLayoutVariant } from '../utils/shufuriPoster/types';
import './PosterLayoutVariantPicker.css';

type VariantMeta = {
  id: PosterLayoutVariant;
  name: string;
  nameEn: string;
};

const VARIANT_META: VariantMeta[] = [
  { id: 'standard', name: '经典', nameEn: 'Classic' },
  { id: 'notebook', name: '笔记本', nameEn: 'Notebook' },
  { id: 'split', name: '分栏', nameEn: 'Split' },
];

type Props = {
  value: PosterLayoutVariant;
  onChange: (variant: PosterLayoutVariant) => void;
};

export default function PosterLayoutVariantPicker({ value, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const selected = VARIANT_META.find((v) => v.id === value) ?? VARIANT_META[0]!;

  return (
    <div
      className="poster-layout-picker"
      role="group"
      aria-label={L('选择版式', 'Choose layout')}
    >
      <button
        type="button"
        className="poster-layout-picker__toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={L('版式选项', 'Layout options')}
      >
        <span className={`poster-layout-picker__caret${expanded ? ' is-open' : ''}`} aria-hidden />
      </button>

      {expanded && (
        <div className="poster-layout-picker__panel">
          {VARIANT_META.map((v) => {
            const isSelected = v.id === selected.id;
            return (
              <button
                key={v.id}
                type="button"
                className={`poster-layout-picker__item${isSelected ? ' is-selected' : ''}`}
                onClick={() => onChange(v.id)}
                aria-pressed={isSelected}
                title={L(v.name, v.nameEn)}
              >
                <span className="poster-layout-picker__thumb">
                  <span
                    className={`poster-layout-picker__thumb-inner poster-layout-picker__thumb--${v.id}`}
                  />
                </span>
                <span className="poster-layout-picker__name">{L(v.name, v.nameEn)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
