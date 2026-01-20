import { level1 } from './level1'
import { level2 } from './level2'
import { level3 } from './level3'
import { level4 } from './level4'
import { level5 } from './level5'
import { LevelConfig } from './types'

export * from './types'

export const levels: LevelConfig[] = [level1, level2, level3, level4, level5]

export function getLevelById(id: number): LevelConfig | undefined {
  return levels.find(level => level.id === id)
}

export function getTotalLevels(): number {
  return levels.length
}
