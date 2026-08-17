import { PulsatingDots } from './PulsatingDots';
import { L } from '../utils/i18n';

type Props = {
  messageZh: string;
  messageEn: string;
};

/** lazy/Suspense 占位，避免 fallback={null} 整页空白 */
export default function GlobalChunkLoading({ messageZh, messageEn }: Props) {
  return (
    <div className="global-layout-loading" role="status" aria-live="polite">
      <div className="global-layout-loading__inner">
        <PulsatingDots size={12} />
        <p className="global-layout-loading__text">{L(messageZh, messageEn)}</p>
      </div>
    </div>
  );
}
