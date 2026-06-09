import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { PriorityType, WorkspaceStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {}
  }
  // Fallback for HTTP (non-secure) contexts
  const el = document.createElement('textarea')
  el.value = text
  el.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
  document.body.appendChild(el)
  el.focus()
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('es-PY', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 145
}

const FALLBACK_STATUS: Record<string, { label: string; color: string }> = {
  Nuevo:      { label: 'Nuevo',       color: '#c4c4c4' },
  Asignado:   { label: 'Asignado',    color: '#e2445c' },
  EnProgreso: { label: 'En progreso', color: '#579bfc' },
  EnRevision: { label: 'En revisión', color: '#a25ddc' },
  Bloqueado:  { label: 'Bloqueado',   color: '#bb3354' },
  Completado: { label: 'Completado',  color: '#00c875' },
  AlwaysOn:   { label: 'Siempre activo', color: '#00c2cd' },
}

export function getStatusInfo(slug: string, statuses: WorkspaceStatus[]): { label: string; bg: string; text: string } {
  const ws = statuses.find(s => s.slug === slug)
  if (ws) {
    return { label: ws.label, bg: ws.color, text: isLightColor(ws.color) ? '#333333' : '#ffffff' }
  }
  const fb = FALLBACK_STATUS[slug]
  if (fb) {
    return { label: fb.label, bg: fb.color, text: isLightColor(fb.color) ? '#333333' : '#ffffff' }
  }
  return { label: slug, bg: '#c4c4c4', text: '#333333' }
}

export function getPriorityStyle(priority: PriorityType): { bg: string; text: string } {
  const map: Record<PriorityType, { bg: string; text: string }> = {
    'Siempre activo': { bg: '#e2445c', text: '#ffffff' },
    'Crítica':   { bg: '#333333', text: '#ffffff' },
    'Alta':      { bg: '#e2445c', text: '#ffffff' },
    'Media':     { bg: '#fdab3d', text: '#ffffff' },
    'Baja':      { bg: '#e2e253', text: '#333333' },
  }
  return map[priority] ?? { bg: '#c4c4c4', text: '#333333' }
}
