import type { SelectHTMLAttributes, ForwardRefExoticComponent, RefAttributes, OptionHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { clsx } from 'clsx';

export interface SelectOption extends OptionHTMLAttributes<HTMLOptionElement> {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
  fullWidth?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, placeholder, fullWidth = true, className, id, ...props }, ref) => {
    const selectId = id || `select-${Math.random().toString(36).slice(2, 9)}`;
    const errorId = error ? `${selectId}-error` : undefined;
    const helperId = helperText ? `${selectId}-helper` : undefined;
    const describedBy = clsx(errorId, helperId);

    return (
      <div className={clsx(fullWidth ? 'w-full' : '', className)}>
        {label && (
          <label htmlFor={selectId} className="label">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={clsx('input select', error && 'input-error')}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy || undefined}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map(({ value, label: optionLabel, ...optionProps }) => (
            <option key={value} value={value} {...optionProps}>
              {optionLabel}
            </option>
          ))}
        </select>
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

Select.displayName = 'Select';