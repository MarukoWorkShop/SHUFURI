import { useCallback, useEffect, useRef } from 'react';
import {
  initNativeBridge,
  postToNative,
  type BridgeCommand,
  type SetContentPayload,
} from '../bridge/nativeBridge';

type Options = {
  onSetContent: (payload: SetContentPayload) => Promise<void>;
  onReset: () => void;
  onNativeExport: (exportType: string) => Promise<void>;
};

export function useNativeBridge({ onSetContent, onReset, onNativeExport }: Options) {
  const bridgeReadyRef = useRef(false);

  const handleBridgeCommand = useCallback(
    (cmd: BridgeCommand) => {
      switch (cmd.type) {
        case 'detect_native':
          postToNative({ event: 'ready' });
          break;

        case 'set_content': {
          void (async () => {
            try {
              await onSetContent(cmd.payload);
            } catch (e) {
              const message = e instanceof Error ? e.message : 'set_content 失败';
              postToNative({ event: 'error', data: { message } });
            }
          })();
          break;
        }

        case 'export_pdf':
        case 'export_png': {
          void onNativeExport(cmd.type);
          break;
        }

        case 'export_png_all':
          void onNativeExport('export_png');
          break;

        case 'reset':
          onReset();
          break;
      }
    },
    [onSetContent, onReset, onNativeExport],
  );

  useEffect(() => {
    if (!bridgeReadyRef.current) {
      bridgeReadyRef.current = true;
      initNativeBridge(handleBridgeCommand);
    }
  }, [handleBridgeCommand]);

  return { handleBridgeCommand };
}
