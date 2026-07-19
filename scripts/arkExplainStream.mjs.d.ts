declare module './scripts/arkExplainStream.mjs' {
  import type { Connect } from 'vite';
  export function createExplainStreamMiddleware(
    apiKey: string,
  ): Connect.NextHandleFunction;
  export function writeExplainSse(opts: {
    apiKey: string;
    prompt: string;
    res: import('http').ServerResponse;
  }): Promise<void>;
}
