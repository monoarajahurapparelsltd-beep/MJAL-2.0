import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  createdAt: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id' | 'createdAt'>) => string;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
  success: (message: string, title?: string, duration?: number) => string;
  error: (message: string, title?: string, duration?: number) => string;
  warning: (message: string, title?: string, duration?: number) => string;
  info: (message: string, title?: string, duration?: number) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Global event bus to allow triggering toasts from non-react services/modules
type ToastListener = (toast: Omit<ToastItem, 'id' | 'createdAt'>) => void;
const listeners: Set<ToastListener> = new Set();

export const showGlobalToast = (toast: Omit<ToastItem, 'id' | 'createdAt'>) => {
  listeners.forEach(l => l(toast));
};

export const globalToast = {
  success: (message: string, title: string = 'Success', duration: number = 4000) =>
    showGlobalToast({ type: 'success', title, message, duration }),
  error: (message: string, title: string = 'Error', duration: number = 5000) =>
    showGlobalToast({ type: 'error', title, message, duration }),
  warning: (message: string, title: string = 'Warning', duration: number = 4500) =>
    showGlobalToast({ type: 'warning', title, message, duration }),
  info: (message: string, title: string = 'Information', duration: number = 4000) =>
    showGlobalToast({ type: 'info', title, message, duration }),
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const showToast = useCallback(
    ({ type, title, message, duration = 4000 }: Omit<ToastItem, 'id' | 'createdAt'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastItem = {
        id,
        type,
        title,
        message,
        duration,
        createdAt: Date.now(),
      };

      setToasts(prev => [newToast, ...prev].slice(0, 6)); // Keep max 6 active toasts

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }

      return id;
    },
    [dismissToast]
  );

  const success = useCallback(
    (message: string, title?: string, duration?: number) =>
      showToast({ type: 'success', title: title || 'Success', message, duration }),
    [showToast]
  );

  const error = useCallback(
    (message: string, title?: string, duration?: number) =>
      showToast({ type: 'error', title: title || 'Error', message, duration: duration || 5000 }),
    [showToast]
  );

  const warning = useCallback(
    (message: string, title?: string, duration?: number) =>
      showToast({ type: 'warning', title: title || 'Warning', message, duration }),
    [showToast]
  );

  const info = useCallback(
    (message: string, title?: string, duration?: number) =>
      showToast({ type: 'info', title: title || 'Notification', message, duration }),
    [showToast]
  );

  // Subscribe to global toast triggers
  useEffect(() => {
    const handleGlobal = (t: Omit<ToastItem, 'id' | 'createdAt'>) => {
      showToast(t);
    };
    listeners.add(handleGlobal);
    return () => {
      listeners.delete(handleGlobal);
    };
  }, [showToast]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        dismissToast,
        clearAllToasts,
        success,
        error,
        warning,
        info,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Internal Toast Container Component
interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0"
    >
      {toasts.map(toast => {
        let icon = <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />;
        let borderClass = 'border-emerald-500/30 bg-white/95 text-slate-900 shadow-lg shadow-emerald-950/10';
        let badgeBg = 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20';

        if (toast.type === 'error') {
          icon = <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />;
          borderClass = 'border-rose-500/30 bg-white/95 text-slate-900 shadow-lg shadow-rose-950/10';
          badgeBg = 'bg-rose-50 text-rose-700 ring-1 ring-rose-500/20';
        } else if (toast.type === 'warning') {
          icon = <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />;
          borderClass = 'border-amber-500/30 bg-white/95 text-slate-900 shadow-lg shadow-amber-950/10';
          badgeBg = 'bg-amber-50 text-amber-700 ring-1 ring-amber-500/20';
        } else if (toast.type === 'info') {
          icon = <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />;
          borderClass = 'border-blue-500/30 bg-white/95 text-slate-900 shadow-lg shadow-blue-950/10';
          badgeBg = 'bg-blue-50 text-blue-700 ring-1 ring-blue-500/20';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3 rounded-xl border backdrop-blur-md transition-all duration-300 transform translate-y-0 animate-fade-in ${borderClass}`}
            role="alert"
          >
            {icon}
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.2 rounded-md ${badgeBg}`}>
                  {toast.title || toast.type}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-800 mt-1 leading-snug break-words">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
              title="Close notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
