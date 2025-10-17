import { createContext, useContext, useMemo, useState, ReactNode } from "react";

type Toast = {
  id: number;
  title?: string;
  desc?: string;
  type?: "success" | "error" | "info";
  ttl?: number; // ms
};

type ToastContextValue = {
  push: (t: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const api = useMemo<ToastContextValue>(() => ({
    push: (t) => {
      const id = Date.now() + Math.random();
      const ttl = t.ttl ?? 3000;
      const toast: Toast = { id, ...t, ttl };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter(x => x.id !== id));
      }, ttl);
    },
  }), []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* container */}
      <div className="fixed top-3 right-3 z-50 space-y-2">
        {toasts.map(t => {
          const tone =
            t.type === "success" ? "bg-green-600" :
            t.type === "error" ? "bg-red-600" :
            "bg-neutral-800";
          return (
            <div key={t.id} className={`${tone} text-white rounded-lg shadow px-4 py-3 max-w-xs`}>
              {t.title && <div className="font-semibold">{t.title}</div>}
              {t.desc && <div className="text-sm opacity-90">{t.desc}</div>}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
