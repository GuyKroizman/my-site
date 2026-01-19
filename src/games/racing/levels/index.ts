import { level1 } from './level1'
import { level2 } from './level2'
import { LevelConfig } from './types'

export * from './types'

export const levels: LevelConfig[] = [level1, level2]

export function getLevelById(id: number): LevelConfig | undefined {
  return levels.find(level => level.id === id)
}

export function getTotalLevels(): number {
  return levels.length
}
