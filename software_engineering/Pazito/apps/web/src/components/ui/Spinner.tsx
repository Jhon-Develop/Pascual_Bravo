import type { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  inline?: boolean;
}

export function Spinner({ size = 'md', inline = false, className, ...props }: SpinnerProps) {
  const sizeClasses = {
    sm: 'spinner-sm',
    md: '',
    lg: 'spinner-lg',
  };

  return (
    <div
      className={clsx('spinner', sizeClasses[size], inline ? 'inline-block' : 'block', className)}
      role="status"
      aria-label="Cargando"
      {...props}
    >
      <span className="sr-only">Cargando...</span>
    </div>
  );
}

export interface InlineSpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md';
}

export function InlineSpinner({ size = 'sm', className, ...props }: InlineSpinnerProps) {
  const sizeClasses = size === 'sm' ? 'spinner-sm' : '';

  return (
    <span
      className={clsx('spinner inline-block', sizeClasses, className)}
      role="status"
      aria-label="Cargando"
      {...props}
    >
      <span className="sr-only">Cargando...</span>
    </span>
  );
}