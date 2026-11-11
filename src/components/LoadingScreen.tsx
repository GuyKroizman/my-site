import type { ReactNode } from 'react'
import '../loading.css'

/**
 * Per-route chunk loaders. Each variant follows the visual language of the page
 * it is loading, so a slow chunk never shows an unrelated white spinner.
 */
export type LoadingVariant =
  | 'notebook'
  | 'rogue0'
  | 'yoga'
  | 'snake'
  | 'hoot'
  | 'racing'
  | 'mask'
  | 'floaty'
  | 'tiny'
  | 'gmtk'
  | 'anim'

interface Loader {
  title: string
  sub: string
  art: ReactNode
  /** Extra modifier classes on the wrapper (dark backgrounds, etc.). */
  className?: string
  rtl?: boolean
}

const pips = (
  <span className="ld-pips" aria-hidden="true">
    <span />
    <span />
    <span />
  </span>
)

const LOADERS: Record<LoadingVariant, Loader> = {
  notebook: {
    title: "Guy's notebook",
    sub: 'sharpening a pencil…',
    art: (
      <span className="ld-pencil" aria-hidden="true">
        ✏️
      </span>
    ),
  },
  rogue0: {
    title: 'ROGUE0',
    sub: 'entering the dungeon',
    art: pips,
  },
  yoga: {
    title: 'Still',
    sub: 'settling into your practice…',
    art: (
      <span className="ld-breath" aria-hidden="true">
        <span className="ld-breath-ring" />
        <span className="ld-breath-dot" />
      </span>
    ),
  },
  snake: {
    title: 'נושך הנחשים',
    sub: 'טוען את הסיפור…',
    art: (
      <span className="ld-wiggle" aria-hidden="true">
        🐍
      </span>
    ),
    rtl: true,
  },
  hoot: {
    title: 'Hoot',
    sub: 'loading the hunt…',
    art: (
      <span className="ld-target" aria-hidden="true">
        🎯
      </span>
    ),
    className: 'ld-dark',
  },
  racing: {
    title: 'Racing Game',
    sub: 'warming up the engine…',
    art: (
      <span className="ld-race" aria-hidden="true">
        <span className="ld-car">🏎️</span>
        <span className="ld-checker" />
      </span>
    ),
    className: 'ld-dark',
  },
  mask: {
    title: 'The Mask',
    sub: 'unearthing the arena…',
    art: (
      <span className="ld-tilt" aria-hidden="true">
        🎭
      </span>
    ),
    className: 'ld-dark',
  },
  floaty: {
    title: 'Floaty McHandface',
    sub: 'inflating the hands…',
    art: (
      <span className="ld-float" aria-hidden="true">
        👋
      </span>
    ),
    className: 'ld-dark',
  },
  tiny: {
    title: 'Tiny Shooter',
    sub: 'spinning up the radar…',
    art: (
      <span className="ld-radar" aria-hidden="true">
        <span className="ld-radar-cross" />
      </span>
    ),
    className: 'ld-dark',
  },
  gmtk: {
    title: 'Seasons of Life',
    sub: 'planting the first seed…',
    art: (
      <span className="ld-grow" aria-hidden="true">
        🌱
      </span>
    ),
    className: 'ld-dark',
  },
  anim: {
    title: 'anim_viewer',
    sub: 'loading the skeletons…',
    art: <span className="ld-cube" aria-hidden="true" />,
    className: 'ld-dark',
  },
}

export default function LoadingScreen({ variant }: { variant: LoadingVariant }) {
  const loader = LOADERS[variant]
  return (
    <div
      className={`ld ld-${variant}${loader.className ? ` ${loader.className}` : ''}`}
      role="status"
      aria-live="polite"
      dir={loader.rtl ? 'rtl' : undefined}
    >
      <div className="ld-inner">
        {loader.art}
        <p className="ld-title">{loader.title}</p>
        <p className="ld-sub">{loader.sub}</p>
        <span className="sr-only">Loading</span>
      </div>
    </div>
  )
}
