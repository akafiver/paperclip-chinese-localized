/**
 * UI Token Layer — Tailwind-compatible class names and cn() helper.
 *
 * Every visual value in Paperclip comes from the token layer in
 * `ui/src/index.css`. This file provides programmatic access to those
 * tokens so components can use them in className strings, CSS-in-JS,
 * or template literals while keeping IDE autocomplete and type safety.
 *
 * Usage patterns:
 *   import { cn, token } from '@/lib/styles'
 *
 *   // Semantic class names (maps to CSS var → Tailwind theme):
 *   <div className={token.bg}>
 *   <div className={token.card}>
 *
 *   // Named color classes (shadcn palette):
 *   <span className={token.fg}>
 *
 *   // Shadow/gradient shorthand (use sparingly, prefer Tailwind classes):
 *   <div className={cn(token.shadowCard, 'p-4')}>
 *
 *   // Radius shorthand:
 *   <div className={token.radiusLg}>
 *
 *   // Re-export of existing cn() from lib/utils — use for all className
 *   // composition; overrides Tailwind conflicts automatically.
 *   <div className={cn(token.card, 'p-4', className)}>
 *
 * NOTE: cn() is already defined in lib/utils.ts. This re-export lets
 * you grab everything from one place: `import { cn, token } from '@/lib/styles'`.
 */

/**
 * NOTE: cn() is already defined in lib/utils.ts. We re-export it here so
 * consumers can grab everything from one place:
 *   `import { cn, token } from '@/lib/styles'`
 * (The function body is duplicated from utils.ts because tailwind-merge
 * must be a direct dependency of this file; importing from utils.ts would
 * create a circular dependency if any token consumer also imports from utils.)
 */

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { cn as _cn } from './utils'

/** Re-export cn() for convenience */
export const cn = _cn

// ─────────────────────────────────────────────
// Semantic color tokens
// Maps to --background, --foreground, etc.
// in ui/src/index.css :root block.
// ─────────────────────────────────────────────

/** Page/body background */
export const bg = 'bg-[var(--background)]'
/** Text on light surfaces */
export const fg = 'text-[var(--foreground)]'
/** Card/surface background */
export const card = 'bg-[var(--card)]'
/** Text on card surfaces */
export const cardFg = 'text-[var(--card-foreground)]'
/** Popover/modal background */
export const popover = 'bg-[var(--popover)]'
/** Text on popover surfaces */
export const popoverFg = 'text-[var(--popover-foreground)]'
/** Primary action text/button */
export const primary = 'text-[var(--primary)] bg-[var(--primary)]'
/** Text on primary backgrounds */
export const primaryFg = 'text-[var(--primary-foreground)]'
/** Secondary surface */
export const secondary = 'bg-[var(--secondary)]'
/** Text on secondary surfaces */
export const secondaryFg = 'text-[var(--secondary-foreground)]'
/** Muted/inactive text */
export const muted = 'bg-[var(--muted)]'
/** Muted text */
export const mutedFg = 'text-[var(--muted-foreground)]'
/** Accent highlight */
export const accent = 'bg-[var(--accent)]'
/** Text on accent surfaces */
export const accentFg = 'text-[var(--accent-foreground)]'
/** Destructive/error backgrounds */
export const destructive = 'bg-[var(--destructive)]'
/** Text on destructive surfaces */
export const destructiveFg = 'text-[var(--destructive-foreground)]'
/** Border color */
export const border = 'border-[var(--border)]'
/** Input field background */
export const input = 'bg-[var(--input)]'
/** Focus ring color */
export const ring = 'ring-[var(--ring)]'
/** Sidebar background */
export const sidebar = 'bg-[var(--sidebar)]'
/** Sidebar text */
export const sidebarFg = 'text-[var(--sidebar-foreground)]'
/** Sidebar primary */
export const sidebarPrimary = 'bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]'
/** Sidebar accent */
export const sidebarAccent = 'bg-[var(--sidebar-accent)]'
/** Sidebar accent text */
export const sidebarAccentFg = 'text-[var(--sidebar-accent-foreground)]'
/** Sidebar border */
export const sidebarBorder = 'border-[var(--sidebar-border)]'
/** Sidebar ring */
export const sidebarRing = 'ring-[var(--sidebar-ring)]'
/** Chart 1–5 (used in charts/diagrams) */
export const chart1 = 'bg-[var(--chart-1)]'
export const chart2 = 'bg-[var(--chart-2)]'
export const chart3 = 'bg-[var(--chart-3)]'
export const chart4 = 'bg-[var(--chart-4)]'
export const chart5 = 'bg-[var(--chart-5)]'

// ─────────────────────────────────────────────
// Radius tokens
// Maps to --radius-sm/md/lg/xl/2xl/3xl/4xl.
// ─────────────────────────────────────────────

export const radiusSm = 'rounded-[var(--radius-sm)]'
export const radiusMd = 'rounded-[var(--radius-md)]'
export const radiusLg = 'rounded-[var(--radius-lg)]'
export const radiusXl = 'rounded-[var(--radius-xl)]'
export const radius2xl = 'rounded-[var(--radius-2xl)]'
export const radius3xl = 'rounded-[var(--radius-3xl)]'
export const radius4xl = 'rounded-[var(--radius-4xl)]'
/** The base radius anchor (8px). Most Tailwind rounded-* map to this. */
export const radiusBase = 'rounded-[var(--radius)]'

// ─────────────────────────────────────────────
// Shadow tokens (extracted, grouped by pattern)
// Maps to --shadow-extract-* groupings.
// ─────────────────────────────────────────────

/** ChatComposer overlay popup shadow */
export const shadowOverlay = 'shadow-[0_-12px_28px_rgba(15,23,42,0.08)]'
/** 1px top-only line shadow */
export const shadowLine = 'shadow-[0_1px_0_rgba(15,23,42,0.02)]'
/** Card float — most common card shadow */
export const shadowCard = 'shadow-[0_18px_42px_rgba(15,23,42,0.06)]'
/** Blue glow — live/active elements */
export const shadowGlow = 'shadow-[0_16px_40px_rgba(37,99,235,0.08)]'
/** Deep float — large offset, dark */
export const shadowHeavy = 'shadow-[0_20px_80px_-40px_rgba(0,0,0,0.55)]'
/** 0-0-0 outline (1px) */
export const shadowOutline = 'shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
/** Outline + primary border (drag state) */
export const shadowDrag =
  'shadow-[0_-12px_28px_rgba(15,23,42,0.08),0_0_0_1px_hsl(var(--primary)/0.16)]'

// ─────────────────────────────────────────────
// Gradient tokens (extracted, grouped by pattern)
// Maps to --gradient-extract-* groupings.
// ─────────────────────────────────────────────

/** Red-tint card gradient */
export const gradientRedCard =
  'bg-[linear-gradient(180deg,rgba(255,80,80,0.12),rgba(255,255,255,0.02))]'
/** White subtle card gradient */
export const gradientWhiteCard =
  'bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]'
/** Radial decorative overlay */
export const gradientRadial =
  'bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.08),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.1),transparent_32%)]'
/** Brand gradient (primary → accent → muted) */
export const gradientBrand =
  'bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--accent))_55%,hsl(var(--muted))_100%)]'

// ─────────────────────────────────────────────
// Convenience objects for dot-access patterns
// ─────────────────────────────────────────────

export const token = {
  // Colors
  bg,
  fg,
  card,
  cardFg,
  popover,
  popoverFg,
  primary,
  primaryFg,
  secondary,
  secondaryFg,
  muted,
  mutedFg,
  accent,
  accentFg,
  destructive,
  destructiveFg,
  border,
  input,
  ring,
  sidebar,
  sidebarFg,
  sidebarAccent,
  sidebarAccentFg,
  sidebarBorder,
  sidebarRing,
  sidebarPrimary,
  chart1,
  chart2,
  chart3,
  chart4,
  chart5,

  // Radius
  radiusSm,
  radiusMd,
  radiusLg,
  radiusXl,
  radius2xl,
  radius3xl,
  radius4xl,
  radiusBase,

  // Shadows (by pattern)
  shadow: {
    /** Overlay popup */
    overlay: shadowOverlay,
    /** Line (top only) */
    line: shadowLine,
    /** Card float */
    card: shadowCard,
    /** Blue glow */
    glow: shadowGlow,
    /** Heavy float */
    heavy: shadowHeavy,
    /** 1px outline */
    outline: shadowOutline,
    /** Drag state (outline + primary border) */
    drag: shadowDrag,
  },

  // Gradients (by pattern)
  gradient: {
    /** Red-tint card */
    redCard: gradientRedCard,
    /** White subtle card */
    whiteCard: gradientWhiteCard,
    /** Radial decorative */
    radial: gradientRadial,
    /** Brand (primary → accent → muted) */
    brand: gradientBrand,
  },
} as const
