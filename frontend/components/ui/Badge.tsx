'use client';

import { cn, getStatusBgColor } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'status';
  status?: string;
  className?: string;
}

export function Badge({ children, variant = 'default', status, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium',
        variant === 'status' && status ? getStatusBgColor(status) : 'bg-surface-2 text-text-secondary',
        className
      )}
    >
      {children}
    </span>
  );
}
