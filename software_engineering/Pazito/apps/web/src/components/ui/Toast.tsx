import React, { type ReactNode, useState, useEffect, useCallback, createContext, useContext } from 'react';
import { clsx } from 'clsx';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 9);
    const newToast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return createPortal(
    <div
      className="fixed bottom-4 right-4 z-[500] flex flex-col gap-2 pointer-events-none"
      role="region"
      aria-label="Notificaciones"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>,
    document.body
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const duration = toast.duration ?? 5000;
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(toast.id), 200);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast, onRemove]);

  if (!visible) return null;

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-status-success" />,
    error: <AlertCircle className="w-5 h-5 text-status-error" />,
    warning: <AlertTriangle className="w-5 h-5 text-status-warning" />,
    info: <Info className="w-5 h-5 text-accent-primary" />,
  };

  const toastClasses = {
    success: 'toast-success',
    error: 'toast-error',
    warning: 'toast-warning',
    info: 'toast-info',
  };

  return (
    <div
      className={clsx('toast flex items-start gap-3 pointer-events-auto animate-in slide-in-from-bottom', toastClasses[toast.type])}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex-shrink-0 mt-0.5" aria-hidden="true">
        {icons[toast.type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{toast.title}</p>
        {toast.message && (
          <p className="mt-0.5 text-sm text-text-secondary">{toast.message}</p>
        )}
        {toast.action && (
          <button
            className="mt-2 text-sm font-medium text-accent-primary hover:underline"
            onClick={() => {
              const action = toast.action;
              if (!action) return;
              action.onClick();
              onRemove(toast.id);
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        className="flex-shrink-0 text-text-tertiary hover:text-text-primary"
        onClick={() => onRemove(toast.id)}
        aria-label="Cerrar notificación"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}