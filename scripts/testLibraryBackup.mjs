/**
 * 歌词本 + Study Cards JSON 备份解析回归
 * 运行：npx tsx scripts/testLibraryBackup.mjs
 */

import {
  LIBRARY_BACKUP_FORMAT,
  LIBRARY_BACKUP_VERSION,
  parseLibraryBackupJson,
} from '../src/services/libraryBackup.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sample = {
  format: LIBRARY_BACKUP_FORMAT,
  version: LIBRARY_BACKUP_VERSION,
  exportedAt: 1700000000000,
  lyricsProjects: [
    {
      id: 'proj-1',
      title: '恋',
      artist: '星野源',
      rawLyrics: 'raw',
      bodyHtml: '<p>body</p>',
      pageHtmls: ['<p>p1</p>'],
      layoutProfile: 'mobilePoster',
      savedAt: 1700000000000,
      lang: 'jp',
    },
  ],
  studyCards: [
    {
      id: 'card-1',
      bundleId: 'proj-1',
      songTitle: '恋',
      artist: '星野源',
      lang: 'jp',
      kind: 'vocab',
      front: '営み',
      back: '日常',
      tags: 'vocab',
      sourceRaw: '営み',
      dedupeKey: 'jp|vocab|営み',
      createdAt: 1700000000000,
    },
  ],
};

const parsed = parseLibraryBackupJson(JSON.stringify(sample));
assert(parsed.lyricsProjects.length === 1, 'parses one lyrics project');
assert(parsed.studyCards.length === 1, 'parses one study card');
assert(parsed.lyricsProjects[0].title === '恋', 'keeps title');
assert(parsed.studyCards[0].kind === 'vocab', 'keeps kind');

let threw = false;
try {
  parseLibraryBackupJson('{"format":"nope"}');
} catch {
  threw = true;
}
assert(threw, 'rejects unknown format');

threw = false;
try {
  parseLibraryBackupJson(
    JSON.stringify({
      format: LIBRARY_BACKUP_FORMAT,
      version: LIBRARY_BACKUP_VERSION,
      lyricsProjects: [],
      studyCards: [],
    }),
  );
} catch {
  threw = true;
}
assert(threw, 'rejects empty backup');

console.log('testLibraryBackup: all passed.');
