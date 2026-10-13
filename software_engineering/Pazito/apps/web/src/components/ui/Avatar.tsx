import type { HTMLAttributes, ImgHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getColorFromName(name: string): string {
  const colors = [
    'bg-brand-500',
    'bg-brand-600',
    'bg-brand-700',
    'bg-teal-500',
    'bg-teal-600',
    'bg-emerald-500',
    'bg-emerald-600',
    'bg-cyan-500',
    'bg-cyan-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ src, alt, name, size = 'md', className, ...props }: AvatarProps) {
  const sizeClasses = {
    sm: 'avatar-sm',
    md: '',
    lg: 'avatar-lg',
  };

  const colorClass = name ? getColorFromName(name) : 'bg-brand-500';
  const initials = name ? getInitials(name) : '?';

  return (
    <div
      className={clsx('avatar', sizeClasses[size], colorClass, className)}
      {...props}
    >
      {src ? (
        <img src={src} alt={alt || name || 'Avatar'} />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </div>
  );
}