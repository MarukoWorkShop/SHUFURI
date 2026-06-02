/** 等待预览分页 DOM 就绪后再导出 */
export async function collectPosterPageRoots(
  pageRefs: { current: (HTMLDivElement | null)[] },
  expectedCount: number,
): Promise<HTMLDivElement[]> {
  if (expectedCount <= 0) {
    throw new Error('没有可导出的页面');
  }

  for (let attempt = 0; attempt < 80; attempt++) {
    const roots: HTMLDivElement[] = [];
    for (let i = 0; i < expectedCount; i++) {
      const el = pageRefs.current[i];
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
        roots.push(el);
      }
    }
    if (roots.length === expectedCount) {
      return roots;
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }

  const ready = pageRefs.current.filter(
    (el): el is HTMLDivElement => el !== null && el.offsetWidth > 0 && el.offsetHeight > 0,
  ).length;
  throw new Error(`预览未就绪（${ready}/${expectedCount} 页），请稍后再试`);
}

export function resetPosterPageRefs(
  pageRefs: { current: (HTMLDivElement | null)[] },
  count: number,
): void {
  pageRefs.current = Array.from({ length: count }, () => null);
}
