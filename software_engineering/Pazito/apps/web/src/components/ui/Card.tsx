import type { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'hover';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({
  variant = 'default',
  padding = 'md',
  className,
  children,
  ...props
}: CardProps) {
  const variantClasses = variant === 'hover' ? 'card-hover' : '';
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={clsx('card', variantClasses, paddingClasses[padding], className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div className={clsx('mb-4', className)} {...props}>
      {children}
    </div>
  );
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export function CardTitle({ as: Component = 'h3', className, children, ...props }: CardTitleProps) {
  return (
    <Component className={clsx('text-lg font-semibold text-text-primary', className)} {...props}>
      {children}
    </Component>
  );
}

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

export function CardDescription({ className, children, ...props }: CardDescriptionProps) {
  return (
    <p className={clsx('mt-1 text-sm text-text-secondary', className)} {...props}>
      {children}
    </p>
  );
}

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export function CardContent({ className, children, ...props }: CardContentProps) {
  return <div className={clsx(className)} {...props}>{children}</div>;
}

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div className={clsx('mt-4 pt-4 border-t border-border-primary flex items-center gap-2', className)} {...props}>
      {children}
    </div>
  );
}