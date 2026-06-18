import type { StudyCard } from './types';

function escapeAnkiTsvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildAnkiImportTsv(cards: StudyCard[]): string {
  if (!cards.length) {
    return '';
  }

  const header = ['#separator:tab', '#html:true', '#tags column:3', 'Front\tBack\tTags'].join('\n');
  const rows = cards.map((card) =>
    [escapeAnkiTsvField(card.front), escapeAnkiTsvField(card.back), escapeAnkiTsvField(card.tags)].join('\t'),
  );
  return `${header}\n${rows.join('\n')}\n`;
}
