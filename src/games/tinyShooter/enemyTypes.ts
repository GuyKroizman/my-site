export interface EnemyModelConfig {
  modelPath: string
  idleAnimation: string
  walkAnimation: string
  deathAnimation: string
  visualScaleCorrection: number
  visualFootContactOffset: number
  useDirectScene?: boolean
}

export interface EnemyArchetype {
  id: string
  health: number
  moveSpeed: number
  height: number
  hitRadius: number
  knockbackDamping: number
  bodyRadius: number
  aggroRange: number
  disengageRange: number
  playerContactRadius: number
  playerContactDamage: number
  playerContactCooldownSeconds: number
  objectiveContactDamage: number
  objectiveContactCooldownSeconds: number
  model: EnemyModelConfig
}

export interface EnemySpawnBehaviorConfig {
  type: 'idle' | 'patrol' | 'strafe' | 'seekObjective'
  distance?: number
  headingDegrees?: number
}
