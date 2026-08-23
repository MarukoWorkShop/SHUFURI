#!/usr/bin/env node
/**
 * stats-access.js —— arkProxy 访问量统计脚本
 *
 * 用法：
 *   node stats-access.js            # 统计最近 7 天
 *   node stats-access.js 14         # 统计最近 14 天
 *   DAYS=30 node stats-access.js    # 也可环境变量覆盖
 *
 * 数据来源：access_log 集合（由 index.js 的 logAccess 写入）
 * 输出：每天的总请求数、按 action 拆分、独立 IP 数、累计估算费用。
 *
 * 说明：CloudBase NoSQL 单页最多返回 100 条，按 date 过滤后分页拉全量再本地聚合。
 */
const cloudbase = require('@cloudbase/node-sdk');

const cloud = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const COLLECTION = 'access_log';

function pad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function dateStr(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

async function fetchAll() {
  // 分页拉取全量（单页 100 上限）；CloudBase 对无索引字段 where 匹配不稳，改为全量后本地过滤
  let skip = 0;
  const LIMIT = 100;
  let all = [];
  for (;;) {
    const res = await db
      .collection(COLLECTION)
      .limit(LIMIT)
      .skip(skip)
      .get();
    const list = res.data || [];
    all = all.concat(list);
    if (list.length < LIMIT) break;
    skip += LIMIT;
    if (skip > 20000) break; // 安全阀
  }
  return all;
}

function bucketByDate(all, dates) {
  const buckets = {};
  for (const date of dates) buckets[date] = [];
  for (const rec of all) {
    const rd = rec && rec.data ? rec.data : rec;
    if (rd.date && buckets[rd.date] !== undefined) buckets[rd.date].push(rd);
  }
  return buckets;
}

function aggregate(records) {
  const byAction = {};
  const ips = new Set();
  let cost = 0;
  for (const r of records) {
    const a = r.action || 'unknown';
    byAction[a] = (byAction[a] || 0) + 1;
    if (r.ip && r.ip !== 'unknown') ips.add(r.ip);
    if (typeof r.costYuan === 'number') cost += r.costYuan;
  }
  return {
    total: records.length,
    byAction,
    uniqueIps: ips.size,
    costYuan: Number(cost.toFixed(4)),
  };
}

async function main() {
  const days = Number(process.argv[2]) || Number(process.env.DAYS) || 7;
  const today = new Date();
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 3600 * 1000);
    dates.push(dateStr(d));
  }

  console.log(`\n=== arkProxy 访问统计（最近 ${days} 天）===`);
  console.log('（注：本地运行需配置云函数凭证；推荐用 `tcb fn invoke arkStats` 在云端查看）');
  console.log('-------------------------------------------');

  let all = [];
  try {
    all = await fetchAll();
  } catch (e) {
    console.error('拉取失败（本地或需凭证）:', e.message);
    console.error('建议：npx tcb fn invoke arkStats -e ai-native-d5gtc59uc47601f23 --params \'{"days":7}\'');
    process.exit(1);
  }
  const buckets = bucketByDate(all, dates);

  let grandTotal = 0;
  let grandCost = 0;
  const actionTotals = {};

  for (const date of dates) {
    const records = buckets[date] || [];
    const agg = aggregate(records);
    grandTotal += agg.total;
    grandCost += agg.costYuan;
    for (const [a, c] of Object.entries(agg.byAction)) {
      actionTotals[a] = (actionTotals[a] || 0) + c;
    }
    const actionStr = Object.entries(agg.byAction)
      .map(([a, c]) => `${a}:${c}`)
      .join('  ');
    console.log(
      `${date}  总:${String(agg.total).padStart(4)}  独立IP:${String(agg.uniqueIps).padStart(3)}  ¥${agg.costYuan.toFixed(2)}`,
    );
    if (actionStr) console.log(`          ${actionStr}`);
  }

  console.log('-------------------------------------------');
  const actionTotalStr = Object.entries(actionTotals)
    .map(([a, c]) => `${a}:${c}`)
    .join('  ');
  console.log(`合计    总请求:${grandTotal}  累计费用:¥${grandCost.toFixed(2)}`);
  console.log(`按类型  ${actionTotalStr}`);
  console.log('===========================================\n');
}

main().catch((e) => {
  console.error('统计失败:', e);
  process.exit(1);
});
