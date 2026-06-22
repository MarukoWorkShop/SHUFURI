import { useLayoutEffect, useRef } from 'react';

const CHAIN_TOOLTIP_MAX_W = 260;
const CHAIN_TOOLTIP_SCREEN_PAD = 16;

type Props = {
  anchorRect: DOMRect;
};

export default function ChainLinkTooltip({ anchorRect }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const btnCenterX = anchorRect.left + anchorRect.width / 2;
    let tooltipLeft = btnCenterX - CHAIN_TOOLTIP_MAX_W / 2;
    if (tooltipLeft < CHAIN_TOOLTIP_SCREEN_PAD) {
      tooltipLeft = CHAIN_TOOLTIP_SCREEN_PAD;
    }
    const rightEdge = tooltipLeft + CHAIN_TOOLTIP_MAX_W;
    if (rightEdge > window.innerWidth - CHAIN_TOOLTIP_SCREEN_PAD) {
      tooltipLeft = window.innerWidth - CHAIN_TOOLTIP_SCREEN_PAD - CHAIN_TOOLTIP_MAX_W;
    }
    const arrowOffset = btnCenterX - tooltipLeft;

    el.style.setProperty('--tooltip-top', `${anchorRect.bottom + 10}px`);
    el.style.setProperty('--tooltip-left', `${tooltipLeft}px`);
    el.style.setProperty('--tooltip-max-width', `${CHAIN_TOOLTIP_MAX_W}px`);
    el.style.setProperty('--tooltip-arrow-left', `${arrowOffset}px`);
  }, [anchorRect]);

  return (
    <div ref={ref} className="app-chain-tooltip">
      <span className="app-chain-tooltip__text">
        暂无音乐链接，去音乐软件复制分享链接，或手动填入歌曲信息生成搜索口令
      </span>
    </div>
  );
}
