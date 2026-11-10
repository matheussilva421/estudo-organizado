import { useEffect, useRef } from 'react';

type Props = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function SafeActionDialog({ title, description, confirmLabel, onConfirm, onCancel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    window.requestAnimationFrame(() => confirmRef.current?.focus());
    return () => {
      if (dialog.open) dialog.close();
      previousFocus.current?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="safe-dialog"
      aria-labelledby="safe-dialog-title"
      aria-describedby="safe-dialog-description"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <form method="dialog">
        <h2 id="safe-dialog-title">{title}</h2>
        <p id="safe-dialog-description">{description}</p>
        <div className="safe-dialog-actions">
          <button type="button" className="button-ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button ref={confirmRef} type="button" className="button-primary" onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
