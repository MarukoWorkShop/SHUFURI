import { normalizeStreamInput } from './repairStreamEnvelope';
import { splitStreamColumns } from './splitStreamColumns';

/** 与 splitStreamColumns 互逆：重新转义字段内的字面量 |。 */
function joinStreamColumns(fields: string[]): string {
  return fields.map((f) => f.replace(/\|/g, '\\|')).join('|');
}

export type MergeStreamResult = {
  /** 合并后的完整记录流（@0/H/L/@1 V/@2 G/@9）。 */
  merged: string;
  /** 采用的 L 行数（来自已确认歌词）。 */
  lyricCount: number;
  /** 采用的 V 行数。 */
  vocabCount: number;
  /** 采用的 G 行数。 */
  grammarCount: number;
  /** 被丢弃的 V/G 行数（col5 越界或 col5 无法归位）。 */
  droppedRefs: number;
};

function collectLines(raw: string): {
  header: string | null;
  lyrics: string[];
  maxLyricIndex: number;
} {
  const text = normalizeStreamInput(raw.trim());
  const header: { value: string | null } = { value: null };
  const lyrics: string[] = [];
  let maxLyricIndex = 0;

  for (const rawLine of text.split(/\r\n|\n|\r/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line === 'H' || line.startsWith('H|')) {
      if (!header.value) header.value = line;
      continue;
    }
    if (line.startsWith('L|')) {
      lyrics.push(line);
      const idx = Number.parseInt(splitStreamColumns(line)[1]?.trim() ?? '', 10);
      if (Number.isFinite(idx) && idx > maxLyricIndex) maxLyricIndex = idx;
    }
  }
  return { header: header.value, lyrics, maxLyricIndex };
}

/**
 * 将第二步粘贴的学习材料 (V/G) 合并进第一步已确认的歌词 (H+L)。
 *
 * 设计要点：
 * - H/L 一律以「已确认歌词」为权威并逐字回显，彻底屏蔽 AI 在第二步改动/截断歌词的风险。
 * - 仅从 study 粘贴中提取 V/G 行；col2 序号重排为连续 1..N。
 * - V/G col5 (lyric_line_no) 越出 1..N 时清空，避免生成断链的学习卡引用。
 */
export function mergeConfirmedLyricsWithStudy(
  confirmedRaw: string,
  studyRaw: string,
): MergeStreamResult {
  const confirmed = collectLines(confirmedRaw);
  if (!confirmed.header) {
    throw new Error('已确认歌词缺少 H 行');
  }
  if (confirmed.lyrics.length === 0) {
    throw new Error('已确认歌词缺少 L 行');
  }
  const maxIdx = confirmed.maxLyricIndex;

  const studyText = normalizeStreamInput(studyRaw.trim());
  const vocab: string[] = [];
  const grammar: string[] = [];
  let droppedRefs = 0;

  const normalizeRef = (fields: string[]): string[] => {
    // V/G 至少 7 字段时 col5(index 4) 为 lyric_line_no
    if (fields.length >= 7) {
      const ref = Number.parseInt(fields[4]?.trim() ?? '', 10);
      if (!Number.isFinite(ref) || ref < 1 || ref > maxIdx) {
        if ((fields[4]?.trim() ?? '') !== '') droppedRefs += 1;
        fields[4] = '';
      }
    }
    return fields;
  };

  for (const rawLine of studyText.split(/\r\n|\n|\r/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('V|')) {
      const fields = normalizeRef(splitStreamColumns(line));
      fields[1] = String(vocab.length + 1);
      vocab.push(joinStreamColumns(fields));
    } else if (line.startsWith('G|')) {
      const fields = normalizeRef(splitStreamColumns(line));
      fields[1] = String(grammar.length + 1);
      grammar.push(joinStreamColumns(fields));
    }
  }

  const parts: string[] = ['@0', confirmed.header, ...confirmed.lyrics];
  if (vocab.length > 0) {
    parts.push('@1', ...vocab);
  }
  if (grammar.length > 0) {
    parts.push('@2', ...grammar);
  }
  parts.push('@9');

  return {
    merged: parts.join('\n'),
    lyricCount: confirmed.lyrics.length,
    vocabCount: vocab.length,
    grammarCount: grammar.length,
    droppedRefs,
  };
}
