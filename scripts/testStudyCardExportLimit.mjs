/**
 * 单次导出/打印硬性上限（≤ 999）回归测试。
 * 运行: npx tsx scripts/testStudyCardExportLimit.mjs
 */
import { evaluateBookExportCount, MAX_EXPORT_CARDS } from '../src/services/studyCardsStore.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// 边界：999 允许，1000 拒绝（始终不得大于 999）
assert(evaluateBookExportCount(0).blocked === false, 'empty export allowed');
assert(evaluateBookExportCount(1).blocked === false, 'single card allowed');
assert(evaluateBookExportCount(999).blocked === false, '999 cards allowed (upper bound)');
assert(evaluateBookExportCount(1000).blocked === true, '1000 cards blocked (exceeds limit)');
assert(evaluateBookExportCount(5000).blocked === true, '5000 cards blocked');

// 常量一致性
assert(MAX_EXPORT_CARDS === 999, 'MAX_EXPORT_CARDS is 999');

// 超限时给出用户提示文案
const blocked = evaluateBookExportCount(1500);
assert(blocked.blocked === true, '1500 blocked');
assert(typeof blocked.message === 'string' && blocked.message.length > 0, 'blocked carries a message');
assert(blocked.message.includes('1500'), 'message echoes the count');
assert(blocked.message.includes(String(MAX_EXPORT_CARDS)), 'message echoes the limit');

// 未超限时无提示
const ok = evaluateBookExportCount(500);
assert(ok.blocked === false && ok.message === undefined, 'allowed export has no message');

console.log(`testStudyCardExportLimit: OK (limit=${MAX_EXPORT_CARDS})`);
