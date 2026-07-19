import type { AiGateway, AiGatewayResponse } from './types';

/**
 * 显微镜划词解释：调用火山引擎（经 CloudBase arkProxy）。
 */
export async function generateExplanation(
  gateway: AiGateway,
  requestId: string,
  prompt: string,
  targetLanguage: string,
  interfaceLanguage: 'zh' | 'en',
  signal?: AbortSignal,
): Promise<AiGatewayResponse> {
  return gateway.send(
    {
      action: 'explain.selection',
      requestId,
      prompt,
      targetLanguage: targetLanguage as 'jp' | 'ko' | 'en' | 'zh',
      interfaceLanguage,
    },
    signal,
  );
}
