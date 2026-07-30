/**
 * AI 限额 React Context
 *
 * 在 App 根节点包裹，统一管理：
 *   1. AI 调用次数检查 + 消费（区分 explain / lyrics）
 *   2. 限额到后自动弹出反馈墙
 *   3. 首次 AI 调用 / 限额触发 / 反馈墙展示 埋点
 *
 * 用法：
 *   const { tryUse, state } = useAiLimit();
 *   if (!tryUse('explain')) return; // 划词限额到，弹反馈墙
 *   if (!tryUse('lyrics')) return;  // 词解限额到，弹反馈墙
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  getAiUsageState,
  tryConsumeAiUsage,
  type AiUsageState,
  type AiActionType,
} from '../services/aiUsageLimit';
import {
  trackFirstAiUse,
  trackAiLimitHit,
  trackFeedbackShown,
} from '../services/analytics';
import AiLimitFeedback from './AiLimitFeedback';

interface AiLimitContextType {
  /** 尝试消费一次 AI 调用；返回 true=允许，false=已弹反馈墙 */
  tryUse: (action: AiActionType) => boolean;
  /** 当前使用状态 */
  state: AiUsageState;
}

const AiLimitContext = createContext<AiLimitContextType>({
  tryUse: () => true,
  state: getAiUsageState(),
});

export function useAiLimit(): AiLimitContextType {
  return useContext(AiLimitContext);
}

export default function AiLimitProvider({ children }: { children: ReactNode }) {
  const [showFeedback, setShowFeedback] = useState(false);
  /** 记录哪个 action 触发了反馈墙，用于展示文案 */
  const [blockedAction, setBlockedAction] = useState<AiActionType>('explain');
  const [usageState, setUsageState] = useState<AiUsageState>(getAiUsageState);

  const tryUse = useCallback((action: AiActionType): boolean => {
    const result = tryConsumeAiUsage(action);
    setUsageState(result.state);

    // 首次成功调用 AI：埋点（用于 Activation Rate 统计）
    if (result.allowed) {
      trackFirstAiUse();
    } else {
      // 限额到达：埋点（用于 Hook Rate / 反馈墙转化漏斗）
      trackAiLimitHit({
        count: result.state[action === 'explain' ? 'explainCount' : 'lyricsCount'],
        limit: result.state[action === 'explain' ? 'explainLimit' : 'lyricsLimit'],
      });
      trackFeedbackShown({
        count: result.state[action === 'explain' ? 'explainCount' : 'lyricsCount'],
        limit: result.state[action === 'explain' ? 'explainLimit' : 'lyricsLimit'],
      });
      setBlockedAction(action);
      setShowFeedback(true);
    }
    return result.allowed;
  }, []);

  const handleClose = useCallback(() => {
    setShowFeedback(false);
  }, []);

  return (
    <AiLimitContext.Provider value={{ tryUse, state: usageState }}>
      {children}

      {showFeedback &&
        createPortal(
          <AiLimitFeedback
            usage={usageState}
            blockedAction={blockedAction}
            onClose={handleClose}
          />,
          document.body,
        )}
    </AiLimitContext.Provider>
  );
}
