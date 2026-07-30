/**
 * CloudBase 云函数：costReport
 *
 * 每日费用统计日报。查询昨日 AI 调用费用，汇总后存入 ai_daily_cost。
 *
 * 调用方式：
 *   - 前端手动触发（SDK callFunction）
 *   - 由 CloudBase 定时触发器自动执行（推荐每天 06:00 UTC+8）
 *
 * 参数：
 *   - action: 'daily' | 'query'（默认 'daily'）
 *   - date: 指定日期 YYYY-MM-DD（默认昨天）
 *   - dates: 查询连续日期 ['YYYY-MM-DD', ...]（仅 query 模式）
 */

'use strict';

const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

const COLLECTION_RECORDS = 'ai_call_records';
const COLLECTION_REPORTS = 'ai_daily_cost';

const DAILY_COST_CAP = 50; // 每日费用硬上限

/** 火山引擎定价（元/1K tokens） */
const PRICING_EXPLAIN = { inputPerK: 0.0004, outputPerK: 0.001, searchCost: 0 };
const PRICING_LYRICS = { inputPerK: 0.0008, outputPerK: 0.002, searchCost: 0.03 };

function pad(n) {
  return String(n).padStart(2, '0');
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 生成单日费用报表
 */
async function generateDailyReport(date) {
  console.log(`[costReport] generating report for ${date}`);

  try {
    const res = await db.collection(COLLECTION_RECORDS)
      .where({ date })
      .get();

    const records = res.data || [];

    if (records.length === 0) {
      const emptyReport = {
        _id: date,
        date,
        explainCalls: 0,
        lyricsCalls: 0,
        totalCalls: 0,
        uniqueUids: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalSearchCount: 0,
        estimatedCost: 0,
        costRatio: 0,
        warning: null,
        generatedAt: new Date(),
      };

      await db.collection(COLLECTION_REPORTS)
        .doc(date)
        .set(emptyReport)
        .catch(() => db.collection(COLLECTION_REPORTS).add(emptyReport));

      console.log(`[costReport] ${date}: 0 calls, ¥0.00`);
      return emptyReport;
    }

    let explainCalls = 0;
    let lyricsCalls = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalSearchCount = 0;
    let estimatedCost = 0;
    const uids = new Set();

    for (const r of records) {
      uids.add(r.uid || 'unknown');

      if (r.action === 'explain.selection') {
        explainCalls++;
        totalInputTokens += r.inputTokens || 0;
        totalOutputTokens += r.outputTokens || 0;
        // 重新精确计算费用（避免浮点累积误差）
        estimatedCost += (r.inputTokens || 0) / 1000 * PRICING_EXPLAIN.inputPerK;
        estimatedCost += (r.outputTokens || 0) / 1000 * PRICING_EXPLAIN.outputPerK;
      } else {
        lyricsCalls++;
        totalInputTokens += r.inputTokens || 0;
        totalOutputTokens += r.outputTokens || 0;
        totalSearchCount += r.searchCount || 0;
        estimatedCost += (r.inputTokens || 0) / 1000 * PRICING_LYRICS.inputPerK;
        estimatedCost += (r.outputTokens || 0) / 1000 * PRICING_LYRICS.outputPerK;
        estimatedCost += (r.searchCount || 1) * PRICING_LYRICS.searchCost;
      }
    }

    estimatedCost = Math.round(estimatedCost * 1e4) / 1e4;
    const costRatio = Math.round(estimatedCost / DAILY_COST_CAP * 100);

    // 费用告警级别
    let warning = null;
    if (estimatedCost >= DAILY_COST_CAP) {
      warning = `🔴 达上限：当日费用 ¥${estimatedCost} 已触及 ¥${DAILY_COST_CAP} 硬上限（${costRatio}%）`;
    } else if (costRatio >= 80) {
      warning = `🟠 高预警：当日费用 ¥${estimatedCost} 已达上限的 ${costRatio}%（¥${DAILY_COST_CAP}）`;
    } else if (costRatio >= 50) {
      warning = `🟡 注意：当日费用 ¥${estimatedCost} 已达上限的 ${costRatio}%（¥${DAILY_COST_CAP}）`;
    }

    const report = {
      _id: date,
      date,
      explainCalls,
      lyricsCalls,
      totalCalls: explainCalls + lyricsCalls,
      uniqueUids: uids.size,
      totalInputTokens,
      totalOutputTokens,
      totalSearchCount,
      estimatedCost,
      costRatio,
      warning,
      generatedAt: new Date(),
    };

    // Upsert
    try {
      await db.collection(COLLECTION_REPORTS).doc(date).set(report);
    } catch {
      await db.collection(COLLECTION_REPORTS).add(report);
    }

    // 告警日志
    if (warning) {
      console.warn(JSON.stringify({ type: 'daily_cost_alert', ...report }));
    } else {
      console.log(JSON.stringify({
        type: 'daily_cost_report',
        date,
        totalCalls: report.totalCalls,
        estimatedCost,
        uniqueUids: report.uniqueUids,
      }));
    }

    return report;
  } catch (err) {
    console.error(`[costReport] error generating ${date}:`, err?.message || err);
    return {
      date,
      error: err?.message || String(err),
    };
  }
}

/**
 * 查询日报（单日或连续多日）
 */
async function queryReports(dates) {
  try {
    const res = await db.collection(COLLECTION_REPORTS)
      .where({
        date: dates.length === 1 ? dates[0] : db.command.in(dates),
      })
      .orderBy('date', 'desc')
      .get();

    return {
      ok: true,
      reports: (res.data || []).map((r) => ({
        date: r.date,
        totalCalls: r.totalCalls || 0,
        explainCalls: r.explainCalls || 0,
        lyricsCalls: r.lyricsCalls || 0,
        uniqueUids: r.uniqueUids || 0,
        estimatedCost: r.estimatedCost || 0,
        costRatio: r.costRatio || 0,
        warning: r.warning || null,
      })),
    };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || String(err),
    };
  }
}

function dateRange(daysBack) {
  const dates = [];
  for (let i = 0; i < daysBack; i++) {
    const d = new Date();
    d.setDate(d.getDate() - 1 - i);
    dates.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  }
  return dates;
}

// ===== 入口 =====

exports.main = async function (event) {
  const action = event?.action || 'daily';
  const date = event?.date || yesterdayStr();

  if (action === 'query') {
    const dates = event?.dates || dateRange(event?.daysBack || 7);
    return queryReports(dates);
  }

  // action === 'daily': 生成昨日日报
  const report = await generateDailyReport(date);

  // 同时生成前 7 天的趋势摘要
  let last7Days = null;
  if (report.warning) {
    const recent = dateRange(7);
    const res = await queryReports(recent);
    const reports = res?.reports || [];
    last7Days = {
      totalCost: Math.round(reports.reduce((s, r) => s + (r.estimatedCost || 0), 0) * 1e4) / 1e4,
      avgDailyCost: reports.length > 0
        ? Math.round(reports.reduce((s, r) => s + (r.estimatedCost || 0), 0) / reports.length * 1e4) / 1e4
        : 0,
      dates: reports.map((r) => r.date),
    };
  }

  return {
    ok: true,
    report,
    last7DaysSummary: last7Days,
  };
};
