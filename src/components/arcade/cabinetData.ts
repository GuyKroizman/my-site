export type Availability = 'all' | 'desktop' | 'mobile' | 'mobile-no-iphone' | 'vr'

export interface Project {
  id: string
  emoji: string
  iconImage?: string
  title: string
  subtitle: string
  description: string
  path: string
  color: string
  availability: Availability
  badge?: string
}

export const projects: Project[] = [
  {
    id: 'snake-bitter',
    emoji: '\u{1F40D}',
    title: '\u05E0\u05D5\u05E9\u05DA \u05D4\u05E0\u05D7\u05E9\u05D9\u05DD',
    subtitle: '\u05E1\u05D9\u05E4\u05D5\u05E8 \u05D9\u05DC\u05D3\u05D9\u05DD',
    description: '\u05E1\u05D9\u05E4\u05D5\u05E8 \u05D9\u05DC\u05D3\u05D9\u05DD \u05E9\u05E0\u05DB\u05EA\u05D1 \u05D1\u05DE\u05E9\u05DA \u05DB\u05DE\u05D4 \u05D0\u05E8\u05D5\u05D7\u05D5\u05EA \u05E2\u05E8\u05D1 \u05E2\u05DD \u05D4\u05D9\u05DC\u05D3\u05D9\u05DD.',
    path: '/snake-bitter',
    color: '#f59e0b',
    availability: 'all',
  },
  {
    id: 'rogue0',
    emoji: '\u2694\uFE0F',
    title: 'Rogue0',
    subtitle: 'Dungeon Adventure',
    description: 'Work in progress dungeon adventure game.',
    path: '/rogue0',
    color: '#ef4444',
    availability: 'desktop',
    badge: 'Under Construction',
  },
  {
    id: 'hoot',
    emoji: '\u{1F3AF}',
    title: 'Hoot',
    subtitle: 'Cute 2D Survival',
    description: 'Desktop game with 3 stages and a boss fight. GMTK 2025.',
    path: '/hoot',
    color: '#3b82f6',
    availability: 'desktop',
  },
  {
    id: 'racing',
    emoji: '\u{1F3CE}\uFE0F',
    iconImage: '/racing/woman_and_dog_watching_sunset.png',
    title: 'Racing Game',
    subtitle: '3D Polygon Racing',
    description: 'Race against AI opponents on a 3D track.',
    path: '/racing-game',
    color: '#f97316',
    availability: 'all',
  },
  {
    id: 'the-mask',
    emoji: '\u{1F3AD}',
    title: 'The Mask',
    subtitle: '3D Top-Down Shooter',
    description: 'Mobile 3D shooter made in 32 hours for Global Game Jam.',
    path: '/the-mask',
    color: '#14b8a6',
    availability: 'mobile-no-iphone',
  },
  {
    id: 'floaty',
    emoji: '\u{1F97D}',
    title: 'Floaty McHandface',
    subtitle: 'VR Experience',
    description: 'VR room with floating hands. Push yourself around!',
    path: '/floaty-mchandface',
    color: '#ec4899',
    availability: 'vr',
  },
]
