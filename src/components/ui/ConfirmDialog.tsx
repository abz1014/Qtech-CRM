import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConfirmOptions {
  title?: string;
  /** The main question / consequence. Plain, specific — say what will happen. */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive styling (red confirm). Defaults to true — most confirms are deletes. */
  destructive?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

/** Await a branded yes/no before a destructive or irreversible action. */
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(typeof o === 'string' ? { message: o } : o);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  }, []);

  useEffect(() => {
    if (!opts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(false);
      else if (e.key === 'Enter') settle(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opts, settle]);

  const destructive = opts?.destructive !== false;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog" aria-modal="true" onClick={() => settle(false)}>
          <div className="modal-card max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                destructive ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary')}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-foreground leading-tight">{opts.title ?? 'Are you sure?'}</h2>
                <p className="text-sm text-muted-foreground mt-1.5">{opts.message}</p>
              </div>
              <button onClick={() => settle(false)} className="text-muted-foreground hover:text-foreground flex-shrink-0" aria-label="Cancel">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-3 pt-5">
              <button onClick={() => settle(false)}
                className="flex-1 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
                {opts.cancelLabel ?? 'Cancel'}
              </button>
              <button onClick={() => settle(true)} autoFocus
                className={cn('flex-1 py-2 rounded-lg text-sm font-medium text-white transition-colors',
                  destructive ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90')}>
                {opts.confirmLabel ?? (destructive ? 'Delete' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
