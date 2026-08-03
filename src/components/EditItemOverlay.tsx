import type { ReactNode } from 'react';
import { L } from '../utils/i18n';

export interface EditItemOverlayProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export default function EditItemOverlay({
  open,
  title,
  children,
  onClose,
}: EditItemOverlayProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="shufuri-explain-note-editor-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-edit-overlay, 200)',
        background: 'rgba(15, 23, 42, 0.35)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 84,
        overflowY: 'auto',
      }}
    >
      <div
        className="shufuri-explain-note-editor-panel"
        style={{
          width: 'min(560px, calc(100vw - 32px))',
          background: 'var(--color-bg-elevated, #ffffff)',
          borderRadius: 14,
          boxShadow: '0 16px 48px rgba(15, 23, 42, 0.18)',
          border: '1px solid rgba(148, 163, 184, 0.35)',
          padding: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 15, letterSpacing: '0.02em' }}>
            {title}
          </h3>
          <button
            type="button"
            aria-label={L('关闭', 'Close')}
            className="btn-tonal"
            onClick={onClose}
            style={{ minHeight: 30, padding: '0 10px' }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            marginTop: 12,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
