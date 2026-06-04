import type { PosterLayoutProfile } from '../utils/furiganaLayout/types';

type PosterLayoutToggleProps = {
  value: PosterLayoutProfile;
  onChange: (profile: PosterLayoutProfile) => void;
};

function PrintPaperIcon() {
  return (
    <span className="layout-icon-paper" aria-hidden="true">
      <span className="layout-icon-paper__lines">
        <span className="layout-icon-paper__line" />
        <span className="layout-icon-paper__line" />
        <span className="layout-icon-paper__line" />
      </span>
    </span>
  );
}

function PhoneScreenIcon() {
  return (
    <span className="layout-icon-phone" aria-hidden="true">
      <span className="layout-icon-phone__lines">
        <span className="layout-icon-phone__line" />
        <span className="layout-icon-phone__line" />
        <span className="layout-icon-phone__line" />
      </span>
    </span>
  );
}

export default function PosterLayoutToggle({ value, onChange }: PosterLayoutToggleProps) {
  const isPrint = value === 'clipPosterPrint';
  const isMobile = value === 'mobilePoster';

  return (
    <div className="layout-toggle layout-toggle--preview layout-toggle--icons">
      <button
        type="button"
        className={`layout-mode-btn${isPrint ? ' active' : ''}`}
        aria-pressed={isPrint}
        aria-label="B5 打印 (A5、A6、B5、B6)"
        onClick={() => onChange('clipPosterPrint')}
      >
        <PrintPaperIcon />
        {isPrint && (
          <span className="layout-mode-btn__active-mark">
            <span className="layout-mode-btn__line" />
            <span className="layout-mode-btn__caption">(A5、A6、B5、B6)</span>
          </span>
        )}
      </button>

      <button
        type="button"
        className={`layout-mode-btn${isMobile ? ' active' : ''}`}
        aria-pressed={isMobile}
        aria-label="手机预览 / A6P"
        onClick={() => onChange('mobilePoster')}
      >
        <PhoneScreenIcon />
        {isMobile && (
          <span className="layout-mode-btn__active-mark">
            <span className="layout-mode-btn__line" />
            <span className="layout-mode-btn__caption">手机预览/A6P</span>
          </span>
        )}
      </button>
    </div>
  );
}
