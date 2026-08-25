import { useCallback, useMemo, useState } from 'react';
import type { StudyCard } from '../studyCards/types';
import { L } from '../utils/i18n';
import './StudyCardsBookExportPanel.css';

type Props = {
  /** 全部可用卡片（当前筛选后的列表）。 */
  cards: StudyCard[];
  /** 用户确认导出后回调（传入已勾选的卡片）。 */
  onConfirm: (selected: StudyCard[]) => void;
  /** 取消/关闭弹窗。 */
  onCancel: () => void;
};

/**
 * 词典导出选择弹窗。
 *
 * 参考 BatchExportPanel 的视觉范式：
 * - 居中模态卡片 + overlay
 * - 按语言/类型自动分组为可勾选条目
 * - "全选" / "取消" / "导出" 按钮
 * - 确认后把选中的卡片传给父组件进入打印预览
 */
export default function StudyCardsBookExportPanel({ cards, onConfirm, onCancel }: Props) {
  // 按 `${lang}|${kind}` 分组，生成可勾选项。
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; count: number; items: StudyCard[] }>();
    for (const c of cards) {
      const key = `${c.lang}|${c.kind}`;
      const kindLabel = c.kind === 'vocab' ? L('词汇', 'Vocabulary') : L('语法', 'Grammar');
      const langLabel =
        c.lang === 'jp'
          ? L('日本語', 'Japanese')
          : c.lang === 'ko'
            ? L('한국어', 'Korean')
            : c.lang === 'en'
              ? L('English', 'English')
              : c.lang === 'zh'
                ? L('中文', 'Chinese')
                : String(c.lang);
      const label = `${langLabel} · ${kindLabel}`;
      const entry = map.get(key);
      if (entry) {
        entry.count++;
        entry.items.push(c);
      } else {
        map.set(key, { label, count: 1, items: [c] });
      }
    }
    return Array.from(map.entries()).map(([key, val]) => ({
      key,
      label: val.label,
      count: val.count,
      items: val.items,
    }));
  }, [cards]);

  // 每个分组的勾选状态。
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set(groups.map((g) => g.key)));

  const allChecked = checkedKeys.size === groups.length && groups.length > 0;

  const toggleKey = useCallback((key: string) => {
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setCheckedKeys(() => (allChecked ? new Set() : new Set(groups.map((g) => g.key))));
  }, [allChecked, groups]);

  const handleConfirm = useCallback(() => {
    const selected = groups.filter((g) => checkedKeys.has(g.key)).flatMap((g) => g.items);
    onConfirm(selected);
  }, [groups, checkedKeys, onConfirm]);

  return (
    <div className="book-export-overlay" onClick={onCancel}>
      <div className="book-export-panel" role="dialog" aria-modal aria-label={L('生成专属词典', 'Generate Wordbook')} onClick={(e) => e.stopPropagation()}>
        <h2 className="book-export-panel__title">{L('生成个人专属词典', 'Generate Personal Wordbook')}</h2>
        <p className="book-export-panel__desc">
          {L('勾选要包含的语言类型，确认后生成打印预览。', 'Select language types to include, then confirm to generate print preview.')}
        </p>

        <div className="book-export-select-list">
          <label className="book-export-select-item book-export-select-item--all" key="__all__">
            <input type="checkbox" checked={allChecked} onChange={toggleAll} />
            <span className="book-export-select-label">{L('全选', 'Select All')}</span>
            <span className="book-export-select-count">{cards.length}</span>
          </label>

          {groups.map((g) => (
            <label className="book-export-select-item" key={g.key}>
              <input type="checkbox" checked={checkedKeys.has(g.key)} onChange={() => toggleKey(g.key)} />
              <span className="book-export-select-label">{g.label}</span>
              <span className="book-export-select-count">{g.count}</span>
            </label>
          ))}
        </div>

        <div className="book-export-actions">
          <button type="button" className="book-export-btn book-export-btn--cancel" onClick={onCancel}>
            {L('取消', 'Cancel')}
          </button>
          <button
            type="button"
            className="book-export-btn book-export-btn--confirm"
            disabled={checkedKeys.size === 0}
            onClick={() => handleConfirm()}
          >
            {L('导出', 'Export')}
          </button>
        </div>
      </div>
    </div>
  );
}
