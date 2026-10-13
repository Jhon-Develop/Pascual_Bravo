import type { HTMLAttributes, ReactNode } from 'react';
import { useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';
import { Button } from './Button';

export interface DialogProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  children: ReactNode;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  children,
  className,
  ...props
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!closeOnEscape) return;
      if (event.key === 'Escape') {
        onClose();
      }
      // Trap focus within dialog
      if (event.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    },
    [closeOnEscape, onClose]
  );

  useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
      // Focus first focusable element or close button
      setTimeout(() => {
        const focusable = dialogRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.focus();
      }, 0);
    } else {
      document.body.style.overflow = '';
      previousActiveElement.current?.focus();
    }

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  const sizeClasses = {
    sm: 'modal-sm',
    md: '',
    lg: 'modal-lg',
  };

  return (
    <>
      <div
        className="modal-backdrop"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        className={clsx('modal', sizeClasses[size], className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'dialog-title' : undefined}
        aria-describedby={description ? 'dialog-description' : undefined}
        {...props}
      >
        {(title || description) && (
          <div className="p-6 border-b border-border-primary">
            {title && (
              <h2 id="dialog-title" className="text-lg font-semibold text-text-primary">
                {title}
              </h2>
            )}
            {description && (
              <p id="dialog-description" className="mt-1 text-sm text-text-secondary">
                {description}
              </p>
            )}
          </div>
        )}
        <div className="p-6">{children}</div>
        <div className="p-4 border-t border-border-primary flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" aria-hidden="true" />
            <span className="sr-only">Cerrar</span>
          </Button>
        </div>
      </div>
    </>
  );
}

export interface AlertDialogProps extends Omit<DialogProps, 'children' | 'content'> {
  content: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  variant?: 'danger' | 'primary';
  loading?: boolean;
}

export function AlertDialog({
  open,
  onClose,
  title,
  description,
  content,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  variant = 'primary',
  loading = false,
  ...props
}: AlertDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      {...props}
    >
      <div className="space-y-4">
        <div>{content}</div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}