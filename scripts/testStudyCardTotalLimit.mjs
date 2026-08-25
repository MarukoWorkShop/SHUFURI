/**
 * 单用户总库硬性上限（≤ 3000）回归测试。
 * 运行: npx tsx scripts/testStudyCardTotalLimit.mjs
 *
 * 说明：总库守卫的实际写入路径依赖浏览器 IndexedDB，无法在 node 直接跑；
 * 这里直接测试生产代码复用的纯判定函数，确保 UI/写入守卫与断言一致。
 */
import { evaluateTotalLimit, isWithinTotalLimit, MAX_TOTAL_STUDY_CARDS } from '../src/services/studyCardsStore.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(MAX_TOTAL_STUDY_CARDS === 3000, 'MAX_TOTAL_STUDY_CARDS is 3000');

// 边界：existing 3000 时，再新增 0 张允许、新增 1 张拒绝
assert(isWithinTotalLimit(3000, 0) === true, '3000 existing + 0 new allowed');
assert(isWithinTotalLimit(3000, 1) === false, '3000 existing + 1 new blocked');
assert(isWithinTotalLimit(2999, 1) === true, '2999 existing + 1 new allowed (boundary)');
assert(isWithinTotalLimit(0, 3000) === true, 'fresh library allows exactly 3000 new');
assert(isWithinTotalLimit(0, 3001) === false, 'fresh library blocks 3001 new');

// 批量新增：3000 existing，本次要新增 5 张 → 拒绝（整体突破）
assert(evaluateTotalLimit(3000, 5).blocked === true, 'batch that breaches limit blocked');
// 2998 existing，本次新增 2 张 → 恰好 3000，允许
assert(evaluateTotalLimit(2998, 2).blocked === false, 'batch hitting exactly 3000 allowed');

// 语义：合并已有卡不增加总量，守卫只允许"全新卡"触发
assert(evaluateTotalLimit(3000, 0).blocked === false, 'merging existing card never blocked');

// 触顶提示文案
const blocked = evaluateTotalLimit(3000, 1);
assert(blocked.blocked === true && typeof blocked.message === 'string', 'blocked carries a message');
assert(blocked.message.includes(String(MAX_TOTAL_STUDY_CARDS)), 'message echoes the limit');

console.log(`testStudyCardTotalLimit: OK (limit=${MAX_TOTAL_STUDY_CARDS})`);
