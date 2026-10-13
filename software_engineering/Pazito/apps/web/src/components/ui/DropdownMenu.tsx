import type { HTMLAttributes } from 'react';
import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { createPortal } from 'react-dom';

export interface DropdownMenuProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function DropdownMenu({ children, className, ...props }: DropdownMenuProps) {
  return <div className={clsx('relative inline-block', className)} {...props}>{children}</div>;
}

export interface DropdownMenuTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function DropdownMenuTrigger({ children, className, ...props }: DropdownMenuTriggerProps) {
  return (
    <button
      className={clsx('flex items-center gap-1.5', className)}
      {...props}
    >
      {children}
    </button>
  );
}

export interface DropdownMenuContentProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose: () => void;
}

export function DropdownMenuContent({ open, onClose, children, className, ...props }: DropdownMenuContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={contentRef}
      className={clsx(
        'absolute right-0 mt-2 w-48 card shadow-lg border border-border-primary py-1 z-50 animate-in slide-in-from-bottom',
        className
      )}
      role="menu"
      {...props}
    >
      {children}
    </div>,
    document.body
  );
}

export interface DropdownMenuItemProps extends HTMLAttributes<HTMLButtonElement> {
  inset?: boolean;
}

export function DropdownMenuItem({ className, onClick, children, ...props }: DropdownMenuItemProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    // The onClose is handled by the portal's click outside
  };

  return (
    <button
      className={clsx(
        'w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-100 transition-colors',
        className
      )}
      onClick={handleClick}
      role="menuitem"
      {...props}
    >
      {children}
    </button>
  );
}