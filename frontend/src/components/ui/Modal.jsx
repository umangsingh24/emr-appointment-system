import clsx from 'clsx';
import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Accessible overlay used for both centred dialogs (`variant="dialog"`) and side panels
 * (`variant="drawer"`). Closes on Escape and backdrop click, locks page scroll, moves focus
 * into the panel and restores it to the trigger on close.
 */
export function Modal({ open, onClose, title, description, variant = 'dialog', size = 'md', footer, children }) {
  const titleId = useId();
  const panelRef = useRef(null);
  // Kept in a ref so an inline `onClose` arrow does not re-run the effect on every render,
  // which would steal focus from inputs inside the modal.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const isDrawer = variant === 'drawer';

  return createPortal(
    <div className={clsx('fixed inset-0 z-50 flex', isDrawer ? 'justify-end' : 'items-center justify-center p-4')}>
      <div className="absolute inset-0 bg-slate-900/40" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          'relative flex max-h-full flex-col bg-white shadow-xl outline-none',
          isDrawer
            ? 'h-full w-full max-w-lg'
            : clsx('w-full rounded-xl', size === 'lg' ? 'max-w-2xl' : size === 'sm' ? 'max-w-sm' : 'max-w-lg'),
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-m-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
