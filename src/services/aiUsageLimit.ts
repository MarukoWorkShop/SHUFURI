/**
 * AI 调用次数限额（MVP 内测阶段）
 *
 * 双层限额：
 *   - 划词讲解 (explain)：20 次/天
 *   - 词解与语法生成 (lyrics)：5 次/天
 *   - 反馈奖励：仅划词 +50 次/天，词解不变
 *
 * 前端防君子（LocalStorage）：
 *   - 每日重置：跨过 0 点（用户本地时区）自动重置
 *   - 限额到后仅展示反馈墙，不再发送请求
 *
 * 后端防小人（已在云函数中实现）：
 *   - 每 IP 每 3 秒最多 3 次
 *   - prompt 长度上限 500/8000 字符
 *
 * 存储 key: shufuri_ai_usage
 */
const STORAGE_KEY = 'shufuri_ai_usage';

/** 划词讲解每日免费额度 */
export const EXPLAIN_FREE_LIMIT = 20;

/** 词解与语法生成每日免费额度 */
export const LYRICS_FREE_LIMIT = 5;

/** 提交反馈后，划词额外赠送额度（词解不受影响） */
export const FEEDBACK_EXPLAIN_BONUS = 50;

/** 反馈是否已赠送（每日重置） */
const FEEDBACK_REWARDED_KEY = 'shufuri_ai_feedback_rewarded';

export type AiActionType = 'explain' | 'lyrics';

export interface AiUsageState {
  /** 划词已用次数 */
  explainCount: number;
  /** 划词总限额（含反馈奖励） */
  explainLimit: number;
  /** 词解已用次数 */
  lyricsCount: number;
  /** 词解总限额 */
  lyricsLimit: number;
  /** 划词是否已耗尽 */
  explainReached: boolean;
  /** 词解是否已耗尽 */
  lyricsReached: boolean;
  /** 划词剩余次数 */
  explainRemaining: number;
  /** 词解剩余次数 */
  lyricsRemaining: number;
}

/** 取当前本地日期 YYYY-MM-DD */
function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface RawState {
  explainCount: number;
  lyricsCount: number;
  date: string;
  bonusApplied: boolean;
}

function readRaw(): RawState {
  const today = todayKey();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { explainCount: 0, lyricsCount: 0, date: today, bonusApplied: false };
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      // 跨天则重置
      if (parsed.date !== today) {
        return { explainCount: 0, lyricsCount: 0, date: today, bonusApplied: false };
      }
      return {
        explainCount: Math.max(0, Number(parsed.explainCount) || 0),
        lyricsCount: Math.max(0, Number(parsed.lyricsCount) || 0),
        date: today,
        bonusApplied: Boolean(parsed.bonusApplied),
      };
    }
  } catch {
    // localStorage 不可用或数据损坏，重置
  }
  return { explainCount: 0, lyricsCount: 0, date: today, bonusApplied: false };
}

function writeRaw(state: RawState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 静默失败（隐私模式等）
  }
}

function buildState(raw: RawState): AiUsageState {
  const explainLimit = EXPLAIN_FREE_LIMIT + (raw.bonusApplied ? FEEDBACK_EXPLAIN_BONUS : 0);
  const lyricsLimit = LYRICS_FREE_LIMIT;
  return {
    explainCount: raw.explainCount,
    explainLimit,
    lyricsCount: raw.lyricsCount,
    lyricsLimit,
    explainReached: raw.explainCount >= explainLimit,
    lyricsReached: raw.lyricsCount >= lyricsLimit,
    explainRemaining: Math.max(0, explainLimit - raw.explainCount),
    lyricsRemaining: Math.max(0, lyricsLimit - raw.lyricsCount),
  };
}

/** 读取当前使用状态（不修改次数） */
export function getAiUsageState(): AiUsageState {
  return buildState(readRaw());
}

/**
 * 尝试消费一次 AI 调用额度。
 *
 * @param action - 'explain' 划词 / 'lyrics' 词解与语法
 * @returns {{ allowed: boolean }} — allowed=true 时已自动 +1
 */
export function tryConsumeAiUsage(
  action: AiActionType,
): { allowed: boolean; state: AiUsageState } {
  const raw = readRaw();

  if (action === 'explain') {
    const limit = EXPLAIN_FREE_LIMIT + (raw.bonusApplied ? FEEDBACK_EXPLAIN_BONUS : 0);
    if (raw.explainCount >= limit) {
      return { allowed: false, state: buildState(raw) };
    }
    const next: RawState = { ...raw, explainCount: raw.explainCount + 1 };
    writeRaw(next);
    return { allowed: true, state: buildState(next) };
  }

  // lyrics
  if (raw.lyricsCount >= LYRICS_FREE_LIMIT) {
    return { allowed: false, state: buildState(raw) };
  }
  const next: RawState = { ...raw, lyricsCount: raw.lyricsCount + 1 };
  writeRaw(next);
  return { allowed: true, state: buildState(next) };
}

/**
 * 提交反馈后调用：划词当日额外 +50，词解不变。
 * 若当天已经奖励过则不再叠加。
 */
export function grantFeedbackBonus(): AiUsageState {
  const raw = readRaw();
  if (raw.bonusApplied) return buildState(raw);
  const next: RawState = {
    ...raw,
    bonusApplied: true,
  };
  writeRaw(next);
  try {
    localStorage.setItem(FEEDBACK_REWARDED_KEY, raw.date);
  } catch {
    // 静默
  }
  return buildState(next);
}

/** 仅在测试 / 管理员场景使用：重置计数器 */
export function resetAiUsage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(FEEDBACK_REWARDED_KEY);
  } catch {
    // 静默
  }
}
