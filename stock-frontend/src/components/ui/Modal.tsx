import { ReactNode } from "react";

export default function Modal({
  open,
  title,
  children,
  onCancel,
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
}: {
  open: boolean;
  title?: string;
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative z-50 w-full max-w-md rounded-2xl bg-white shadow p-5">
        {title && <div className="text-lg font-semibold mb-2">{title}</div>}
        {children && <div className="text-sm text-neutral-700 mb-4">{children}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border px-4 py-2 text-neutral-700 hover:bg-neutral-50">
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-white ${danger ? "bg-red-600 hover:bg-red-700" : "bg-black hover:bg-neutral-900"}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
