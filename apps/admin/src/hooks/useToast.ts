import { useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface UseToastReturn {
  toasts: Toast[];
  showToast: (type: ToastType, message: string, duration?: number) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

let toastId = 0;

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, duration = 5000) => {
      const id = `toast-${++toastId}`;
      const toast: Toast = { id, type, message, duration };

      setToasts((prev) => [...prev, toast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const showSuccess = useCallback(
    (message: string) => showToast('success', message),
    [showToast]
  );

  const showError = useCallback(
    (message: string) => showToast('error', message, 8000),
    [showToast]
  );

  const showWarning = useCallback(
    (message: string) => showToast('warning', message),
    [showToast]
  );

  const showInfo = useCallback(
    (message: string) => showToast('info', message),
    [showToast]
  );

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeToast,
    clearAll,
  };
}

// グローバルトースト用のシングルトン
let globalShowToast: UseToastReturn['showToast'] | null = null;
let globalShowError: UseToastReturn['showError'] | null = null;
let globalShowSuccess: UseToastReturn['showSuccess'] | null = null;

export function setGlobalToast(toast: UseToastReturn) {
  globalShowToast = toast.showToast;
  globalShowError = toast.showError;
  globalShowSuccess = toast.showSuccess;
}

export function toast(type: ToastType, message: string, duration?: number) {
  if (globalShowToast) {
    globalShowToast(type, message, duration);
  } else {
    console.warn('[Toast] Global toast not initialized');
  }
}

export function toastError(message: string) {
  if (globalShowError) {
    globalShowError(message);
  } else {
    console.error('[Toast]', message);
  }
}

export function toastSuccess(message: string) {
  if (globalShowSuccess) {
    globalShowSuccess(message);
  } else {
    console.log('[Toast]', message);
  }
}
