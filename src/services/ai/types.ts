// ===== 火山引擎模型常量 =====
/**
 * 划词 AI讲解：用 Seed 2.0 Mini（低延迟），不要用 Pro。
 * Pro 常开深度思考，首字可达几十秒，划词场景不合适。
 */
export const VOLCENGINE_MODEL = 'doubao-seed-2-0-mini-260215';

/** 显微镜解释最大 token（语境释义+语法拆解+意境，语法段可稍长） */
export const VOLCENGINE_MAX_TOKENS = 360;

/** 显微镜解释温度 */
export const VOLCENGINE_TEMPERATURE_EXPLAIN = 0.2;

// ===== 代理请求/响应类型 =====

/** 后端错误码 */
export type ArkProxyErrorCode =
  | 'AUTH_FAILED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'EMPTY_OUTPUT'
  | 'INVALID_REQUEST';

/** 后端错误详情 */
export type ArkProxyError = {
  code: ArkProxyErrorCode;
  message: string;
  retryable: boolean;
};

/** Token 用量 */
export type ArkProxyUsage = {
  inputTokens?: number;
  outputTokens?: number;
};

/** 发送到云函数的请求 */
export type ArkProxyRequest = {
  action: 'explain.selection' | 'lyrics.step2';
  requestId: string;
  prompt: string;
  targetLanguage: 'jp' | 'ko' | 'en' | 'zh';
  interfaceLanguage: 'zh' | 'en';
  /** CloudBase 匿名用户 UID，用于后端硬配额校验 */
  userId?: string;

  // ===== 歌词语法词解缓存字段（仅 lyrics.step2 时有效） =====
  /** 6 维结构哈希（SHA-256），前端计算；用于匹配已有缓存 */
  contentHash?: string;
  /** 歌名（缓存记录 / 调试用） */
  title?: string;
  /** 歌手（缓存记录 / 调试用） */
  artist?: string;
  /**
   * 强制重新生成并**覆盖**已有缓存。
   * - false/不传：正常走缓存流程
   * - true：跳过缓存查询 → 调 API → 用新结果全量覆盖旧缓存
   *
   * 触发场景：用户发现缓存结果有误，点击「重新进行 AI 分析」。
   */
  forceRefresh?: boolean;
};

/** 云函数返回的响应 */
export type ArkProxyResponse = {
  ok: boolean;
  requestId: string;
  /** 实际调用的模型 ID（用于核对部署） */
  model?: string;
  content?: string;
  usage?: ArkProxyUsage;
  error?: ArkProxyError;

  // ===== 歌词语法词解缓存字段 =====
  /** 是否命中已有缓存（未调用火山引擎） */
  fromCache?: boolean;
  /** 本次缓存命中节省的费用（元） */
  costSaved?: number;
};

// ===== AI Gateway 抽象层 =====

/** 网关请求（与 ArkProxyRequest 解耦，便于未来切换后端） */
export type AiGatewayRequest = {
  action: 'explain.selection' | 'lyrics.step2';
  requestId: string;
  prompt: string;
  targetLanguage: 'jp' | 'ko' | 'en' | 'zh';
  interfaceLanguage: 'zh' | 'en';
  /** CloudBase 匿名用户 UID，用于后端硬配额校验 */
  userId?: string;
  // ===== 歌词语法词解缓存字段 =====
  contentHash?: string;
  title?: string;
  artist?: string;
  forceRefresh?: boolean;
};

/** 网关响应（与 ArkProxyResponse 结构一致） */
export type AiGatewayResponse = ArkProxyResponse;

/** AI 网关接口：任何后端实现需满足此契约 */
export interface AiGateway {
  /** 初始化认证/连接 */
  init(): Promise<void>;
  /** 发送 AI 生成请求 */
  send(req: AiGatewayRequest, signal?: AbortSignal): Promise<AiGatewayResponse>;
}
