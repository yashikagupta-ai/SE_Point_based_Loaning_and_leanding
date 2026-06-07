import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export function formatPoints(pts: number): string {
  return pts >= 1000 ? `${(pts / 1000).toFixed(1)}K` : String(pts);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatRelativeTime(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function getRiskColor(level: string): string {
  if (level === 'LOW')    return 'text-green-600 bg-green-100';
  if (level === 'MEDIUM') return 'text-yellow-600 bg-yellow-100';
  return 'text-red-600 bg-red-100';
}

export function getCreditTierColor(score: number): string {
  if (score >= 750) return '#3FAF7D';
  if (score >= 600) return '#F59E0B';
  return '#EF4444';
}
