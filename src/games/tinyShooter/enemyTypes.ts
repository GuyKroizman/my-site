export interface EnemyModelConfig {
  modelPath: string
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
  model: EnemyModelConfig
}

export interface EnemySpawnBehaviorConfig {
  type: 'idle' | 'patrol' | 'strafe'
  distance?: number
  headingDegrees?: number
}
