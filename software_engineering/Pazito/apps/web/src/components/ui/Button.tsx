import type { ButtonHTMLAttributes, ForwardRefExoticComponent, RefAttributes } from 'react';
import { forwardRef } from 'react';
import { clsx } from 'clsx';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses = 'btn';
    const variantClasses = `btn-${variant}`;
    const sizeClasses = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';
    const widthClasses = fullWidth ? 'btn-full' : '';

    return (
      <button
        ref={ref}
        className={clsx(baseClasses, variantClasses, sizeClasses, widthClasses, className)}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <svg
            className="spinner spinner-sm"
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="31.4 31.4"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';