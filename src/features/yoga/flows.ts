import type { Difficulty, Focus } from './poses'

export interface FlowPhase {
  poseId: string
  /** Duration in half-breaths. Inhale and exhale are each one half-breath. */
  halves: number
  /** Optional pin for the first half of this phase, so breath alignment never drifts. */
  start?: 'inhale' | 'exhale'
  side?: 'Left' | 'Right'
}

export interface Flow {
  id: string
  name: string
  sanskrit?: string
  focus: Focus[]
  difficulty: Difficulty
  defaultRounds: number
  description: string
  phases: FlowPhase[]
}

export const flows: Flow[] = [
  {
    id: 'cat-cow',
    name: 'Cat–Cow',
    sanskrit: 'Marjaryasana–Bitilasana',
    focus: ['Spine'],
    difficulty: 'Beginner',
    defaultRounds: 6,
    description: 'Alternate spinal flexion and extension with the breath — one movement on each inhale and exhale.',
    phases: [
      { poseId: 'cow', halves: 1, start: 'inhale' },
      { poseId: 'cat', halves: 1, start: 'exhale' },
    ],
  },
  {
    id: 'sun-salutation-a',
    name: 'Sun Salutation A',
    sanskrit: 'Surya Namaskar A',
    focus: ['Full body', 'Spine'],
    difficulty: 'Beginner',
    defaultRounds: 3,
    description: 'A steady breath-linked warm-up through standing, a halfway lift, plank, a backbend, and a four-breath downward dog hold.',
    phases: [
      { poseId: 'mountain', halves: 1, start: 'exhale' },
      { poseId: 'upward-salute', halves: 1, start: 'inhale' },
      { poseId: 'forward-fold', halves: 1, start: 'exhale' },
      { poseId: 'halfway-lift', halves: 1, start: 'inhale' },
      { poseId: 'plank', halves: 1, start: 'exhale' },
      { poseId: 'cobra', halves: 1, start: 'inhale' },
      { poseId: 'downward-dog', halves: 8, start: 'exhale' },
      { poseId: 'halfway-lift', halves: 1, start: 'inhale' },
      { poseId: 'forward-fold', halves: 1, start: 'exhale' },
      { poseId: 'upward-salute', halves: 1, start: 'inhale' },
      { poseId: 'mountain', halves: 1, start: 'exhale' },
    ],
  },
  {
    id: 'chaturanga-vinyasa',
    name: 'Chaturanga Vinyasa',
    sanskrit: 'Chaturanga Dandasana Vinyasa',
    focus: ['Strength', 'Full body'],
    difficulty: 'Intermediate',
    defaultRounds: 1,
    description: 'A classic transition between poses: plank, lower through chaturanga, rise into a gentle backbend, and settle in a two-breath downward dog.',
    phases: [
      { poseId: 'plank', halves: 1, start: 'inhale' },
      { poseId: 'chaturanga', halves: 1, start: 'exhale' },
      { poseId: 'cobra', halves: 1, start: 'inhale' },
      { poseId: 'downward-dog', halves: 4, start: 'exhale' },
    ],
  },
  {
    id: 'seated-spinal-twist',
    name: 'Seated Spinal Twist',
    sanskrit: 'Ardha Matsyendrasana',
    focus: ['Spine', 'Hips'],
    difficulty: 'Beginner',
    defaultRounds: 4,
    description: 'Lengthen on each inhale, rotate on each exhale, and hold the twist for two breaths before switching sides.',
    phases: [
      { poseId: 'easy-seat', halves: 2 },
      { poseId: 'seated-reach', halves: 1, start: 'inhale' },
      { poseId: 'seated-twist', halves: 4, start: 'exhale', side: 'Right' },
      { poseId: 'seated-reach', halves: 1, start: 'inhale' },
      { poseId: 'seated-twist', halves: 4, start: 'exhale', side: 'Left' },
    ],
  },
  {
    id: 'seated-neck-rolls',
    name: 'Seated Neck Rolls',
    sanskrit: 'Griva Sanchalana',
    focus: ['Spine', 'Rest'],
    difficulty: 'Beginner',
    defaultRounds: 3,
    description: 'Sit tall and roll the head in slow circles — inhale as it rolls back, exhale as it rolls forward — then reverse the direction.',
    phases: [
      { poseId: 'easy-seat', halves: 2 },
      { poseId: 'neck-roll', halves: 2, start: 'inhale', side: 'Right' },
      { poseId: 'neck-roll', halves: 2, start: 'inhale', side: 'Left' },
    ],
  },
  {
    id: 'head-to-knee-twist',
    name: 'Head-to-Knee & Twist',
    sanskrit: 'Janu Sirsasana Vinyasa',
    focus: ['Hips', 'Spine'],
    difficulty: 'Beginner',
    defaultRounds: 1,
    description: 'Settle into Head-to-Knee Pose, rise into a three-breath seated twist, then fold forward over the straight leg before switching sides.',
    phases: [
      { poseId: 'janu-sirsasana', halves: 2, start: 'inhale', side: 'Right' },
      { poseId: 'seated-twist', halves: 6, start: 'inhale', side: 'Right' },
      { poseId: 'janu-sirsasana', halves: 2, start: 'exhale', side: 'Right' },
      { poseId: 'janu-sirsasana', halves: 2, start: 'inhale', side: 'Left' },
      { poseId: 'seated-twist', halves: 6, start: 'inhale', side: 'Left' },
      { poseId: 'janu-sirsasana', halves: 2, start: 'exhale', side: 'Left' },
    ],
  },
  {
    id: 'sun-salutation-b',
    name: 'Sun Salutation B',
    sanskrit: 'Surya Namaskar B',
    focus: ['Full body', 'Strength'],
    difficulty: 'Intermediate',
    defaultRounds: 3,
    description: 'A stronger salutation with chair pose, warrior I on both sides, and breath-linked vinyasa transitions.',
    phases: [
      { poseId: 'mountain', halves: 1, start: 'exhale' },
      { poseId: 'chair', halves: 1, start: 'inhale' },
      { poseId: 'forward-fold', halves: 1, start: 'exhale' },
      { poseId: 'halfway-lift', halves: 1, start: 'inhale' },
      { poseId: 'plank', halves: 1, start: 'exhale' },
      { poseId: 'chaturanga', halves: 1, start: 'inhale' },
      { poseId: 'upward-dog', halves: 1, start: 'exhale' },
      { poseId: 'downward-dog', halves: 8, start: 'inhale' },
      { poseId: 'warrior-one', halves: 2, start: 'exhale', side: 'Right' },
      { poseId: 'warrior-one', halves: 2, start: 'inhale', side: 'Left' },
      { poseId: 'downward-dog', halves: 4, start: 'exhale' },
      { poseId: 'forward-fold', halves: 1, start: 'inhale' },
      { poseId: 'halfway-lift', halves: 1, start: 'exhale' },
      { poseId: 'chair', halves: 1, start: 'inhale' },
      { poseId: 'mountain', halves: 1, start: 'exhale' },
    ],
  },
  {
    id: 'crescent-lunge-flow',
    name: 'Crescent Lunge Flow',
    focus: ['Hips', 'Balance'],
    difficulty: 'Beginner',
    defaultRounds: 3,
    description: 'Reach up on each inhale and step into a crescent lunge on each exhale, alternating sides.',
    phases: [
      { poseId: 'mountain', halves: 1, start: 'exhale' },
      { poseId: 'upward-salute', halves: 1, start: 'inhale' },
      { poseId: 'crescent-lunge', halves: 2, start: 'exhale', side: 'Right' },
      { poseId: 'upward-salute', halves: 1, start: 'inhale' },
      { poseId: 'crescent-lunge', halves: 2, start: 'exhale', side: 'Left' },
      { poseId: 'mountain', halves: 1, start: 'exhale' },
    ],
  },
  {
    id: 'spinal-balance',
    name: 'Spinal Balance',
    sanskrit: 'Bird Dog',
    focus: ['Balance', 'Spine'],
    difficulty: 'Beginner',
    defaultRounds: 4,
    description: 'From all fours, reach opposite arm and leg on each inhale, alternating sides.',
    phases: [
      { poseId: 'cat', halves: 1, start: 'exhale' },
      { poseId: 'bird-dog', halves: 2, start: 'inhale', side: 'Right' },
      { poseId: 'cat', halves: 1, start: 'exhale' },
      { poseId: 'bird-dog', halves: 2, start: 'inhale', side: 'Left' },
      { poseId: 'cat', halves: 1, start: 'exhale' },
    ],
  },
  {
    id: 'knees-to-chest-flow',
    name: 'Knees to Chest',
    focus: ['Rest', 'Spine'],
    difficulty: 'Beginner',
    defaultRounds: 4,
    description: 'Hug your knees in on each inhale and release into resting pose on each exhale.',
    phases: [
      { poseId: 'knees-to-chest', halves: 2, start: 'inhale' },
      { poseId: 'savasana', halves: 2, start: 'exhale' },
    ],
  },
  {
    id: 'reclined-twist-flow',
    name: 'Reclined Twist Flow',
    focus: ['Spine', 'Rest'],
    difficulty: 'Beginner',
    defaultRounds: 3,
    description: 'Draw the knees in, twist to one side, return to center, and repeat on the other side.',
    phases: [
      { poseId: 'knees-to-chest', halves: 1, start: 'exhale' },
      { poseId: 'reclined-twist', halves: 4, start: 'inhale', side: 'Right' },
      { poseId: 'knees-to-chest', halves: 1, start: 'exhale' },
      { poseId: 'reclined-twist', halves: 4, start: 'inhale', side: 'Left' },
    ],
  },
]

export const flowById = new Map(flows.map(flow => [flow.id, flow]))

export function flowHalvesPerRound(flow: Flow): number {
  return flow.phases.reduce((sum, phase) => sum + phase.halves, 0)
}

export interface FlowHalfDetail {
  poseId: string
  side?: 'Left' | 'Right'
  inhale: boolean
  phaseIndex: number
  halfInPhase: number
  phaseHalves: number
}

/** Flatten one round of a flow into half-breaths, resolving breath pins and alternation. */
export function flowRoundDetail(flow: Flow): FlowHalfDetail[] {
  const result: FlowHalfDetail[] = []
  let nextInhale: boolean | null = null
  flow.phases.forEach((phase, phaseIndex) => {
    for (let k = 0; k < phase.halves; k++) {
      let inhale: boolean
      if (k === 0 && phase.start) inhale = phase.start === 'inhale'
      else inhale = nextInhale ?? true
      result.push({ poseId: phase.poseId, side: phase.side, inhale, phaseIndex, halfInPhase: k, phaseHalves: phase.halves })
      nextInhale = !inhale
    }
  })
  return result
}

/** Rough estimate for catalog cards, using the default 4s pace. */
export function flowEstimateSeconds(flow: Flow, phaseSeconds = 4): number {
  return flowHalvesPerRound(flow) * flow.defaultRounds * phaseSeconds
}
