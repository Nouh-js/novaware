import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    danger: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
    info: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  };
  return <span className={`chip ${tones[tone]} ${className}`}>{children}</span>;
}

export function Card({
  children,
  className = '',
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return <div className={`card ${padding ? 'p-5' : ''} ${className}`}>{children}</div>;
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="font-display text-base font-semibold text-ink-900 dark:text-ink-100">
          {title}
        </h3>
        {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const sizes: Record<string, string> = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-ink-950/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={`relative z-10 my-8 flex max-h-[calc(100vh-4rem)] w-full flex-col ${sizes[size]} animate-scale-in rounded-2xl bg-white shadow-pop dark:bg-ink-900`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-ink-100 px-5 py-4 dark:border-ink-800">
          <h3 className="font-display text-base font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-ink-100 px-5 py-4 dark:border-ink-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-400 dark:bg-ink-800">
        {icon}
      </div>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'; label: string }> = {
    draft: { tone: 'neutral', label: 'Brouillon' },
    sent: { tone: 'info', label: 'Envoyé' },
    validated: { tone: 'brand', label: 'Validé' },
    paid: { tone: 'success', label: 'Payé' },
    partial: { tone: 'warning', label: 'Partiel' },
    overdue: { tone: 'danger', label: 'En retard' },
    cancelled: { tone: 'neutral', label: 'Annulé' },
    received: { tone: 'brand', label: 'Reçu' },
  };
  const cfg = map[status] ?? { tone: 'neutral' as const, label: status };
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmer',
  danger = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Annuler
          </button>
          <button
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-ink-600 dark:text-ink-300">{message}</p>
    </Modal>
  );
}
