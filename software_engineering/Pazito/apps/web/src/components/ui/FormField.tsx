import type { ReactNode, HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface FormFieldProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: ReactNode;
}

export function FormField({ label, required, error, helperText, children, className, id, ...props }: FormFieldProps) {
  const fieldId = id || `field-${Math.random().toString(36).slice(2, 9)}`;
  const errorId = error ? `${fieldId}-error` : undefined;
  const helperId = helperText ? `${fieldId}-helper` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={clsx(className)} {...props}>
      <label htmlFor={fieldId} className="label">
        {label}
        {required && <span className="text-status-error ml-1" aria-hidden="true">*</span>}
      </label>
      <div
        id={fieldId}
        className="relative"
        aria-describedby={describedBy}
      >
        {children}
      </div>
      {error && (
        <p id={errorId} className="error-text" role="alert">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={helperId} className="helper-text">
          {helperText}
        </p>
      )}
    </div>
  );
}