import type { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'error' | 'pending' | 'info';
  size?: 'sm' | 'md';
}

export function Badge({ variant = 'info', size = 'md', className, children, ...props }: BadgeProps) {
  const variantClasses = {
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    pending: 'badge-pending',
    info: 'badge-info',
  };

  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : '';

  return (
    <span
      className={clsx('badge', variantClasses[variant], sizeClasses, className)}
      {...props}
    >
      {children}
    </span>
  );
}