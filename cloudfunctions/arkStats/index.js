const cloudbase = require('@cloudbase/node-sdk');

const cloud = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = cloud.database();

const COLLECTION = 'access_log';

function pad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}
function dateStr(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * 拉取集合全量记录（分页，单页 100）。
 * 注意：CloudBase NoSQL 对无索引的自定义字段做 where 精确匹配可能返回空，
 * 因此改为拉全量后在本地按 date 过滤（访问量规模小，全量拉取成本低）。
 */
async function fetchAll() {
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

function aggregate(records) {
  const byAction = {};
  const ips = new Set();
  let cost = 0;
  for (const r of records) {
    const a = (r.action || 'unknown').toString();
    byAction[a] = (byAction[a] || 0) + 1;
    if (r.ip && r.ip !== 'unknown') ips.add(r.ip);
    if (typeof r.costYuan === 'number') cost += r.costYuan;
  }
  return { total: records.length, byAction, uniqueIps: ips.size, costYuan: cost };
}

exports.main = async (event) => {
  // 确保 access_log 集合存在（云端有凭证，首次自动创建）
  try {
    await db.createCollection(COLLECTION);
  } catch (e) {
    // 已存在时忽略
  }

  // 调试模式：直接返回集合总条数
  if (event && event.mode === 'count') {
    try {
      const res = await db.collection(COLLECTION).count();
      return { ok: true, mode: 'count', total: res.total };
    } catch (e) {
      return { ok: false, mode: 'count', error: e.message };
    }
  }

  const days = Number(event && event.days) || 7;
  const today = new Date();
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 3600 * 1000);
    dates.push(dateStr(d));
  }

  // 拉全量后本地按 date 分桶
  let all = [];
  try {
    all = await fetchAll();
  } catch (e) {
    return { ok: false, error: `fetchAll failed: ${e.message}` };
  }

  const buckets = {};
  for (const date of dates) buckets[date] = [];
  for (const rec of all) {
    const rd = rec && rec.data ? rec.data : rec;
    const d = rd.date;
    if (d && buckets[d] !== undefined) buckets[d].push(rd);
  }

  const rows = [];
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
    rows.push({
      date,
      total: agg.total,
      uniqueIps: agg.uniqueIps,
      costYuan: Number(agg.costYuan.toFixed(2)),
      byAction: agg.byAction,
    });
  }

  return {
    ok: true,
    days,
    rows,
    summary: {
      grandTotal,
      grandCostYuan: Number(grandCost.toFixed(2)),
      actionTotals,
    },
  };
};
