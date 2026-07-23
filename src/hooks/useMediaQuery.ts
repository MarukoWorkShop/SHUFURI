import { useEffect, useState } from 'react';

/** 订阅 `window.matchMedia`；SSR / 无 window 时返回 false */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** 与桌面编辑双栏断点一致（`--edit-split-min`） */
export const EDIT_DESKTOP_SPLIT_QUERY = '(min-width: 900px)';
