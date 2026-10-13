import type { InputHTMLAttributes, ForwardRefExoticComponent, RefAttributes, TextareaHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { clsx } from 'clsx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, fullWidth = true, className, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;
    const describedBy = clsx(errorId, helperId);

    return (
      <div className={clsx(fullWidth ? 'w-full' : '', className)}>
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx('input', error && 'input-error')}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy || undefined}
          {...props}
        />
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
);

Input.displayName = 'Input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, fullWidth = true, className, id, ...props }, ref) => {
    const inputId = id || `textarea-${Math.random().toString(36).slice(2, 9)}`;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;
    const describedBy = clsx(errorId, helperId);

    return (
      <div className={clsx(fullWidth ? 'w-full' : '', className)}>
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={clsx('input', error && 'input-error')}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy || undefined}
          {...props}
        />
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
);

Textarea.displayName = 'Textarea';