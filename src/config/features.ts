/**
 * 外部 Prompt + 本地排版链路。
 * 设 VITE_EXTERNAL_PIPELINE=false 可恢复 Volcengine 旧版输入区。
 */
export const EXTERNAL_PIPELINE_ENABLED =
  import.meta.env.VITE_EXTERNAL_PIPELINE !== 'false';
