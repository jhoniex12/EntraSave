import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Overlay rendered through a portal to document.body (CODING_STANDARDS.md §10):
 * never a fixed child of a transformed/overflow-hidden card. Closes on backdrop
 * click and Escape; labelled as a dialog.
 */
export function Modal({ title, subtitle, size = 'md', onClose, children }: { title: string; subtitle?: string; size?: 'md' | 'lg'; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/40 p-0 backdrop-blur-[1px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[calc(100dvh-0.5rem)] w-full overflow-y-auto overscroll-contain rounded-t-2xl border border-neutral-200 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:p-6 ${size === 'lg' ? 'max-w-lg' : 'max-w-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between border-b border-neutral-100 pb-5">
          <div><h2 className="text-lg font-semibold text-neutral-900">{title}</h2>{subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}</div>
          <button type="button" onClick={onClose} className="grid min-h-11 min-w-11 touch-manipulation place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 sm:min-h-8 sm:min-w-8" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
