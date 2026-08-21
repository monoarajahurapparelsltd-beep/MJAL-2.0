import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ModalPortalProps {
  isOpen: boolean;
  onClose?: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  subtitle?: React.ReactNode;
  headerBadge?: React.ReactNode;
  headerIcon?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';
  footer?: React.ReactNode;
  closeOnBackdropClick?: boolean;
  closeOnEsc?: boolean;
  headerGradient?: boolean;
  bodyClassName?: string;
  containerClassName?: string;
}

const MAX_WIDTH_MAP: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-[96vw]',
};

/**
 * ModalPortal: Production-Grade Stacking-Context Escaping Modal Component
 * 
 * Renders directly under document.body via React Portal to completely eliminate:
 * 1. Parent overflow:hidden clipping
 * 2. CSS transform/filter containing block traps
 * 3. Layout reflow and flex-1 height collapse
 * 4. Stacking context z-index competition
 */
export const ModalPortal: React.FC<ModalPortalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  headerBadge,
  headerIcon,
  children,
  maxWidth = '4xl',
  footer,
  closeOnBackdropClick = true,
  closeOnEsc = true,
  headerGradient = false,
  bodyClassName = 'p-5 sm:p-6 space-y-5',
  containerClassName = '',
}) => {
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Ensure client-side DOM mount for portal safety
  useEffect(() => {
    setMounted(true);
  }, []);

  // Viewport scroll-lock & Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    // Add scroll lock class to body with count tracking to support stacked modals
    const currentCount = parseInt(document.body.getAttribute('data-modal-count') || '0', 10);
    document.body.setAttribute('data-modal-count', (currentCount + 1).toString());
    document.body.classList.add('modal-portal-locked');

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEsc && typeof onClose === 'function') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const remainingCount = Math.max(0, parseInt(document.body.getAttribute('data-modal-count') || '1', 10) - 1);
      if (remainingCount === 0) {
        document.body.removeAttribute('data-modal-count');
        document.body.classList.remove('modal-portal-locked');
      } else {
        document.body.setAttribute('data-modal-count', remainingCount.toString());
      }
    };
  }, [isOpen, closeOnEsc, onClose]);

  if (!isOpen || !mounted) return null;

  const widthClass = MAX_WIDTH_MAP[maxWidth] || maxWidth;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdropClick && e.target === overlayRef.current && typeof onClose === 'function') {
      onClose();
    }
  };

  const modalElement = (
    <div
      ref={overlayRef}
      id="modal-portal-backdrop"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-[2px] overflow-y-auto animate-fade-in overscroll-contain"
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={contentRef}
        id="modal-portal-container"
        onClick={e => e.stopPropagation()}
        className={`w-full ${widthClass} max-h-[min(94vh,calc(100dvh-2rem))] flex flex-col min-h-0 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative z-[100000] ${containerClassName}`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 flex items-center justify-between shrink-0 border-b ${
            headerGradient
              ? 'bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white border-transparent'
              : 'bg-slate-50 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0 pr-2">
            {headerIcon && (
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  headerGradient ? 'bg-white/15 text-amber-300' : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                }`}
              >
                {headerIcon}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className={`text-sm sm:text-base font-extrabold tracking-tight truncate ${headerGradient ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
                  {title}
                </h2>
                {headerBadge}
              </div>
              {subtitle && (
                <p className={`text-xs mt-0.5 truncate ${headerGradient ? 'text-blue-100/80' : 'text-slate-500 dark:text-slate-400'}`}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg shrink-0 transition-colors cursor-pointer ${
                headerGradient
                  ? 'text-white/80 hover:text-white hover:bg-white/15'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
              title="Close modal (Esc)"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Scrollable Content Body with min-h-0 to prevent layout collapse */}
        <div className={`flex-1 min-h-0 overflow-y-auto ${bodyClassName} overscroll-contain`}>
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalElement, document.body);
};
