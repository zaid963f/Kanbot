import { createContext, useContext, useState, type ReactNode } from 'react';
import Icon from '../components/Icon';

interface Toast {
  id: number;
  message: string;
  isError: boolean;
  leaving: boolean;
}

interface ToastContextType {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let nextId = 1;

const SHOW_FOR = 4000; // ms on screen
const FADE_OUT = 250; // ms, same as .toast-leaving in index.css

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function addToast(message: string, isError: boolean) {
    const id = nextId++;
    setToasts((current) => [...current, { id, message, isError, leaving: false }]);
    // fade it out, then remove it
    setTimeout(() => {
      setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)));
    }, SHOW_FOR - FADE_OUT);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, SHOW_FOR);
  }

  const value = {
    showSuccess: (message: string) => addToast(message, false),
    showError: (message: string) => addToast(message, true),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={['toast', toast.isError ? 'toast-error' : '', toast.leaving ? 'toast-leaving' : ''].filter(Boolean).join(' ')}
            role={toast.isError ? 'alert' : 'status'}
          >
            <span className="toast-icon">
              <Icon name={toast.isError ? 'alert' : 'check'} size={14} />
            </span>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
