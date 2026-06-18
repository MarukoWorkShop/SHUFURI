import { isNativeWebView, shareTextFile } from '../utils/nativeBridge';
import { buildAnkiImportTsv } from './exportAnkiDeck';
import type { StudyCard } from './types';

function defaultFilename(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `shufuri-study-cards-${y}${m}${day}.txt`;
}

export async function shareAnkiDeckTsv(cards: StudyCard[]): Promise<void> {
  const tsv = buildAnkiImportTsv(cards);
  if (!tsv) {
    throw new Error('没有可导出的学习卡');
  }

  const filename = defaultFilename();

  if (isNativeWebView()) {
    await shareTextFile(tsv, filename, '导出至 Anki');
    return;
  }

  const blob = new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
