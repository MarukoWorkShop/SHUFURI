import { createContext, useContext } from 'react';

export type ShowAppToast = (message: string, durationMs?: number) => void;

export const AppToastContext = createContext<ShowAppToast>(() => {});

export function useAppToast(): ShowAppToast {
  return useContext(AppToastContext);
}
