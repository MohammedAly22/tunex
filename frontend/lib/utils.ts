import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n);
}

export function formatScientific(n: number): string {
  if (n === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(n)));
  const mantissa = n / Math.pow(10, exp);
  return `${mantissa.toFixed(1)}e${exp}`;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDate(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
    case 'complete':
    case 'success':
      return 'text-success';
    case 'training':
    case 'acting':
    case 'thinking':
      return 'text-primary';
    case 'failed':
    case 'error':
      return 'text-error';
    case 'paused':
    case 'warning':
      return 'text-warning';
    default:
      return 'text-text-secondary';
  }
}

export function getStatusBgColor(status: string): string {
  switch (status) {
    case 'completed':
    case 'complete':
    case 'success':
      return 'bg-success/15 text-success';
    case 'training':
    case 'acting':
      return 'bg-primary/15 text-primary';
    case 'failed':
    case 'error':
      return 'bg-error/15 text-error';
    case 'paused':
    case 'warning':
      return 'bg-warning/15 text-warning';
    case 'thinking':
      return 'bg-secondary/15 text-secondary';
    default:
      return 'bg-surface-2 text-text-secondary';
  }
}
