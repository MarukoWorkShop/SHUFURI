/** 为歌词组与 ruby 注入稳定索引，供原位微调定位 */
export function annotateInkEditTargets(bodyHtml: string): string {
  const doc = new DOMParser().parseFromString(
    `<div id="ink-annotate-root">${bodyHtml}</div>`,
    'text/html',
  );
  const root = doc.getElementById('ink-annotate-root');
  if (!root) return bodyHtml;

  root.querySelectorAll('.lyrics-group').forEach((group, groupIndex) => {
    group.setAttribute('data-ink-g', String(groupIndex));
    group.querySelectorAll('.jp-line ruby').forEach((ruby, rubyIndex) => {
      ruby.setAttribute('data-ink-r', String(rubyIndex));
    });
  });

  return root.innerHTML;
}
