import { create } from './tinyStore';
import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

type Toast = {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
};

type ToastState = { toasts: Toast[] };

const { useStore, setState } = create<ToastState>({ toasts: [] });

let nextId = 1;

export function toast(message: string, type: Toast['type'] = 'success') {
  const id = nextId++;
  setState((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
  setTimeout(() => {
    setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  }, 3500);
}

export function ToastContainer() {
  const { toasts } = useStore();
  const icons = {
    success: <CheckCircle2 size={18} className="text-emerald-500" />,
    error: <XCircle size={18} className="text-red-500" />,
    warning: <AlertTriangle size={18} className="text-amber-500" />,
    info: <Info size={18} className="text-sky-500" />,
  };
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-pop ring-1 ring-ink-200 animate-slide-in dark:bg-ink-900 dark:ring-ink-800"
        >
          {icons[t.type]}
          <span className="flex-1 text-sm font-medium text-ink-800 dark:text-ink-100">
            {t.message}
          </span>
          <button
            onClick={() =>
              setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) }))
            }
            className="text-ink-400 hover:text-ink-700"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);
  return { theme, setTheme };
}
