import type { ReactNode, HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { Button } from './Button';

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'ghost';
  };
  centered?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  centered = true,
  className,
  children,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={clsx('empty-state', centered && 'flex', className)}
      {...props}
    >
      <div className={clsx('w-full', centered ? 'max-w-sm' : '')}>
        {icon && (
          <div className={clsx('empty-state-icon', centered ? 'mx-auto' : '')} aria-hidden="true">
            {icon}
          </div>
        )}
        <h3 className="empty-state-title">{title}</h3>
        {description && <p className="empty-state-text">{description}</p>}
        {action && (
          <Button variant={action.variant || 'primary'} onClick={action.onClick}>
            {action.label}
          </Button>
        )}
        {children}
      </div>
    </div>
  );
}