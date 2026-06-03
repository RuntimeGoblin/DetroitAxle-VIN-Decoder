import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const Ctx = createContext(null);
let _nextId = 0;

const CONFIG = {
  success: { Icon: CheckCircle2, bar: 'bg-success',  text: 'text-success'  },
  error:   { Icon: AlertCircle,  bar: 'bg-danger',   text: 'text-danger'   },
  info:    { Icon: Info,         bar: 'bg-accent',   text: 'text-accent'   },
};

function ToastItem({ t, onRemove }) {
  const [leaving, setLeaving] = useState(false);
  const { Icon, bar, text } = CONFIG[t.type] ?? CONFIG.info;

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onRemove(t.id), 200);
  }, [t.id, onRemove]);

  useEffect(() => {
    const timer = setTimeout(dismiss, t.duration ?? 3000);
    return () => clearTimeout(timer);
  }, [dismiss, t.duration]);

  return (
    <div
      className={`
        pointer-events-auto flex items-center gap-3 pr-3 pl-0
        min-w-[220px] max-w-[340px]
        bg-bg-card border border-border rounded-xl shadow-modal
        overflow-hidden
        ${leaving ? 'animate-toast-out' : 'animate-slide-in-right'}
      `}
    >
      {/* Left colour bar */}
      <div className={`w-1 self-stretch shrink-0 ${bar}`} />

      <div className="flex items-center gap-2.5 py-3 flex-1 min-w-0">
        <Icon className={`w-4 h-4 shrink-0 ${text}`} />
        <span className="text-sm text-txt-primary leading-snug">{t.message}</span>
      </div>

      <button
        onClick={dismiss}
        className="text-txt-muted hover:text-txt-primary transition-colors shrink-0 p-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /* toast(message, type?, duration?) */
  const add = useCallback((message, type = 'success', duration = 3000) => {
    const id = ++_nextId;
    setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }]);
  }, []);

  return (
    <Ctx.Provider value={add}>
      {children}
      {/* Toast stack — bottom-right, slides in from right */}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col items-end gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} onRemove={remove} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

/** Returns `(message, type?, duration?) => void` */
export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
