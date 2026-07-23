/**
 * 桌面左栏：从正文抽出仅歌词原文（去掉词汇/语法/划词笔记等学习区块）。
 * 不改持久化 bodyHtml，仅用于预览展示。
 */
export function extractLyricsOnlyBodyHtml(bodyHtml: string): string {
  if (!bodyHtml.trim()) return bodyHtml;
  if (typeof document === 'undefined') return bodyHtml;

  const root = document.createElement('div');
  root.innerHTML = bodyHtml;

  const clip = Array.from(root.children).find(
    (n): n is HTMLElement =>
      n instanceof HTMLElement &&
      (n.classList.contains('clip-body') || n.classList.contains('lyrics-notes-body')),
  );
  if (clip) {
    for (const kid of Array.from(root.children)) {
      if (kid !== clip) clip.appendChild(kid);
    }
  }

  const host = clip ?? root;
  const removeSel = [
    '.lyrics-vocabulary',
    '.lyrics-grammar',
    '.lyrics-grammar-spacer',
    '.lyrics-vocab-item',
    '.lyrics-grammar-item',
    'h2.lyrics-section-title',
    '.shufuri-explain-note',
    '.shufuri-study-item',
  ].join(', ');

  host.querySelectorAll(removeSel).forEach((el) => el.remove());

  // 去掉因拆分残留的空分页壳
  host.querySelectorAll('.lyrics-pagination-unit').forEach((unit) => {
    if (!(unit instanceof HTMLElement)) return;
    if (!unit.textContent?.trim() && unit.children.length === 0) {
      unit.remove();
      return;
    }
    // 若单元内已无歌词组且只剩空白，也去掉
    if (!unit.querySelector('.lyrics-group, .jp-line, .ko-line, .zh-line, .cn-line, .en-line')) {
      const text = unit.textContent?.replace(/\s+/g, '') ?? '';
      if (!text) unit.remove();
    }
  });

  return root.innerHTML;
}
