import * as THREE from 'three'
import { Ball, DEFAULT_DROP_HEIGHT } from './Ball'
import { Bullet } from './Bullet'
import type { Car } from './Car'
import { GluePuddle } from './GluePuddle'
import { Mine } from './Mine'
import { SoundGenerator } from './SoundGenerator'
import { Track } from './Track'
import type { UpgradeId } from './upgrades'
import { getWeaponIcon } from './upgrades'
import type { BallDropConfig } from './levels'

const BALL_SPAWN_MAX_ATTEMPTS = 8
const BALL_SPAWN_MARGIN = 0.2
const GLUE_SLOW_DURATION = 8
const GLUE_SLOW_MULTIPLIER = 0.5
const TURBO_BOOST_DURATION = 1.0
const TURBO_BOOST_COOLDOWN = 3.0
const TURBO_BOOST_MULTIPLIER = 1.5

export interface FireWeaponUiState {
  activeWeaponId: UpgradeId | null
  activeWeaponIcon: string
  nextWeaponIcon: string
  fireWeaponCount: number
  turboState: 'hidden' | 'ready' | 'active' | 'cooldown'
  turboCooldownProgress: number
}

interface CombatUiCallbacks {
  onWeaponUiStateChange?: (state: FireWeaponUiState) => void
}

interface CombatUpdateContext {
  canStart: boolean
  raceComplete: boolean
  firePressed: boolean
  cars: Car[]
  playerCar?: Car
  onExplosionHit: (car: Car, explosionOrigin: THREE.Vector3) => void
  onCameraShake: (duration: number, intensity: number) => void
  onPlayerBallExplosion?: () => void
}

export class RacingCombatController {
  private bullets: Bullet[] = []
  private balls: Ball[] = []
  private playerMines: Mine[] = []
  private playerGluePuddles: GluePuddle[] = []
  private fireWeapons: UpgradeId[] = []
  private activeWeaponIndex: number = 0
  private shootCooldown: number = 0
  private turboBoostActive: boolean = false
  private turboBoostTimer: number = 0
  private turboBoostCooldown: number = 0
  private lastFireWeaponUiStateSignature: string | null = null
  private gluedCarNames: Set<string> = new Set()

  constructor(
    private readonly scene: THREE.Scene,
    private readonly track: Track,
    private readonly soundGenerator: SoundGenerator,
    private readonly uiCallbacks: CombatUiCallbacks = {}
  ) {}

  public setFireWeapons(fireWeapons: UpgradeId[]): void {
    this.fireWeapons = [...fireWeapons]
    this.activeWeaponIndex = 0
    this.emitFireWeaponUiState(true)
  }

  public reset(playerCar?: Car): void {
    this.clearEntities()
    this.shootCooldown = 0
    this.turboBoostActive = false
    this.turboBoostTimer = 0
    this.turboBoostCooldown = 0
    this.lastFireWeaponUiStateSignature = null
    this.gluedCarNames.clear()
    playerCar?.setTurboBoostMultiplier(1)
  }

  public dispose(): void {
    this.clearEntities()
  }

  public rotateWeapon(): void {
    if (this.fireWeapons.length <= 1) return
    this.activeWeaponIndex = (this.activeWeaponIndex + 1) % this.fireWeapons.length
    this.soundGenerator.playWeaponSwitch()
    this.emitFireWeaponUiState(true)
  }

  public getActiveWeaponIcon(): string {
    if (this.fireWeapons.length === 0) return ''
    return getWeaponIcon(this.fireWeapons[this.activeWeaponIndex])
  }

  public getNextWeaponIcon(): string {
    if (this.fireWeapons.length <= 1) return ''
    return getWeaponIcon(this.fireWeapons[(this.activeWeaponIndex + 1) % this.fireWeapons.length])
  }

  public getFireWeaponCount(): number {
    return this.fireWeapons.length
  }

  public getFireWeaponUiState(): FireWeaponUiState {
    return this.buildFireWeaponUiState()
  }

  public emitUiState(force = false): void {
    this.emitFireWeaponUiState(force)
  }

  public getGluedCarNames(): string[] {
    return [...this.gluedCarNames]
  }

  public update(deltaTime: number, context: CombatUpdateContext): void {
    this.shootCooldown = Math.max(0, this.shootCooldown - deltaTime)
    this.handleFireWeapons(context)
    this.updateTurboBoost(deltaTime, context.playerCar)
    this.updatePlayerMines(context.cars, context.onExplosionHit)
    this.updateGluePuddles(context.cars)
    this.updateBullets(deltaTime, context.cars)
    this.updateBalls(deltaTime, context.cars, context.raceComplete, context.onCameraShake, context.onPlayerBallExplosion)
  }

  public spawnBall(drop: BallDropConfig): void {
    let x: number
    let z: number

    if (drop.x !== undefined && drop.z !== undefined) {
      x = drop.x
      z = drop.z
    } else {
      const spawnPoint = this.findBallSpawnPoint()
      x = spawnPoint.x
      z = spawnPoint.z
    }

    const y = drop.y ?? DEFAULT_DROP_HEIGHT
    this.balls.push(new Ball(this.scene, x, y, z, this.soundGenerator))
  }

  private clearEntities(): void {
    this.bullets.forEach(bullet => bullet.dispose(this.scene))
    this.balls.forEach(ball => ball.dispose())
    this.playerMines.forEach(mine => mine.destroy())
    this.playerGluePuddles.forEach(puddle => puddle.destroy())
    this.bullets = []
    this.balls = []
    this.playerMines = []
    this.playerGluePuddles = []
  }

  private handleFireWeapons(context: CombatUpdateContext): void {
    if (
      this.fireWeapons.length === 0
      || !context.firePressed
      || this.shootCooldown > 0
      || !context.canStart
      || context.raceComplete
    ) {
      return
    }

    const activeWeapon = this.fireWeapons[this.activeWeaponIndex]
    switch (activeWeapon) {
      case 'gun':
        this.shootBullet(context.playerCar)
        break
      case 'mines':
        this.dropPlayerMine(context.playerCar)
        break
      case 'turbo_boost':
        this.activateTurboBoost(context.playerCar)
        break
      case 'glue_trap':
        this.dropPlayerGluePuddle(context.playerCar)
        break
    }
  }

  private updateTurboBoost(deltaTime: number, playerCar?: Car): void {
    let turboStateChanged = false

    if (this.turboBoostActive) {
      this.turboBoostTimer -= deltaTime
      turboStateChanged = true
      if (this.turboBoostTimer <= 0) {
        this.turboBoostActive = false
        playerCar?.setTurboBoostMultiplier(1)
        this.turboBoostCooldown = TURBO_BOOST_COOLDOWN
      }
    }

    if (this.turboBoostCooldown > 0) {
      this.turboBoostCooldown = Math.max(0, this.turboBoostCooldown - deltaTime)
      turboStateChanged = true
    }

    if (turboStateChanged) {
      this.emitFireWeaponUiState()
    }
  }

  private updatePlayerMines(cars: Car[], onExplosionHit: CombatUpdateContext['onExplosionHit']): void {
    for (let i = this.playerMines.length - 1; i >= 0; i--) {
      const mine = this.playerMines[i]
      if (!mine.isActive()) continue

      let mineHit = false
      for (const car of cars) {
        if (car.launched || car.finished) continue
        if (mine.collidesWith(car.position)) {
          onExplosionHit(car, mine.getPosition())
          mineHit = true
          break
        }
      }

      if (mineHit) {
        mine.destroy()
        this.playerMines.splice(i, 1)
      }
    }
  }

  private updateGluePuddles(cars: Car[]): void {
    for (let i = this.playerGluePuddles.length - 1; i >= 0; i--) {
      const puddle = this.playerGluePuddles[i]
      let puddleHit = false

      for (const car of cars) {
        if (car.launched || car.finished) continue
        if (puddle.collidesWith(car.position)) {
          car.applyGlueSlow(GLUE_SLOW_DURATION, GLUE_SLOW_MULTIPLIER)
          if (!car.isPlayer) {
            this.gluedCarNames.add(car.name)
          }
          puddleHit = true
          break
        }
      }

      if (puddleHit) {
        puddle.destroy()
        this.playerGluePuddles.splice(i, 1)
      }
    }
  }

  private updateBullets(deltaTime: number, cars: Car[]): void {
    const aiCars = cars.filter(car => !car.isPlayer)

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i]
      bullet.update(deltaTime)
      let hit = false

      if (!bullet.isExpired()) {
        for (const car of aiCars) {
          if (!car.isDestroyed && !car.finished && bullet.checkCollision(car)) {
            const wasAlive = !car.isDestroyed
            car.takeDamage()
            if (wasAlive && car.isDestroyed) {
              this.soundGenerator.playExplosionSound(0.5)
            } else {
              this.soundGenerator.playBulletImpact()
            }
            hit = true
            break
          }
        }
      }

      if (hit || bullet.isExpired()) {
        bullet.dispose(this.scene)
        this.bullets.splice(i, 1)
      }
    }
  }

  private updateBalls(
    deltaTime: number,
    cars: Car[],
    raceComplete: boolean,
    onCameraShake: CombatUpdateContext['onCameraShake'],
    onPlayerBallExplosion?: CombatUpdateContext['onPlayerBallExplosion']
  ): void {
    if (raceComplete) {
      return
    }

    const newlyExplodedPositions: THREE.Vector3[] = []
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i]
      const result = ball.update(deltaTime, cars, this.track)
      if (result.exploded) {
        if (result.playerLaunched) {
          onPlayerBallExplosion?.()
        }
        if (result.explosionPosition) {
          newlyExplodedPositions.push(result.explosionPosition)
          onCameraShake(0.5, 0.6)
        }
      }

      if (ball.exploded && !ball.isExplosionAnimating) {
        ball.dispose()
        this.balls.splice(i, 1)
      }
    }

    resolveBallCollisions(this.balls, this.track)
    triggerBallChainReactions(this.balls, newlyExplodedPositions)
  }

  private shootBullet(playerCar?: Car): void {
    if (!playerCar || playerCar.launched || playerCar.isDestroyed) return

    const forward = new THREE.Vector3(Math.sin(playerCar.rotation), 0, Math.cos(playerCar.rotation))
    const spawnPos = playerCar.position.clone().addScaledVector(forward, 1.8)
    spawnPos.y = playerCar.position.y

    const bullet = new Bullet(spawnPos, playerCar.rotation)
    this.scene.add(bullet.mesh)
    this.bullets.push(bullet)
    this.soundGenerator.playBulletShoot()
    this.shootCooldown = 0.05
  }

  private dropPlayerMine(playerCar?: Car): void {
    if (!playerCar || playerCar.launched || playerCar.isDestroyed) return

    const backward = new THREE.Vector3(-Math.sin(playerCar.rotation), 0, -Math.cos(playerCar.rotation))
    const spawnPos = playerCar.position.clone().addScaledVector(backward, 2.0)
    this.playerMines.push(new Mine(this.scene, spawnPos.x, spawnPos.z, 2.0))
    this.soundGenerator.playMineDrop()
    this.shootCooldown = 1.5
  }

  private dropPlayerGluePuddle(playerCar?: Car): void {
    if (!playerCar || playerCar.launched || playerCar.isDestroyed) return

    const backward = new THREE.Vector3(-Math.sin(playerCar.rotation), 0, -Math.cos(playerCar.rotation))
    const spawnPos = playerCar.position.clone().addScaledVector(backward, 2.6)
    this.playerGluePuddles.push(new GluePuddle(this.scene, spawnPos.x, spawnPos.z))
    this.soundGenerator.playMineDrop()
    this.shootCooldown = 1.5
  }

  private activateTurboBoost(playerCar?: Car): void {
    if (this.turboBoostActive || this.turboBoostCooldown > 0) return
    if (!playerCar || playerCar.launched || playerCar.isDestroyed) return

    this.turboBoostActive = true
    this.turboBoostTimer = TURBO_BOOST_DURATION
    playerCar.setTurboBoostMultiplier(TURBO_BOOST_MULTIPLIER)
    this.soundGenerator.playTurboBoost()
    this.shootCooldown = TURBO_BOOST_DURATION + TURBO_BOOST_COOLDOWN
    this.emitFireWeaponUiState(true)
  }

  private findBallSpawnPoint(): THREE.Vector3 {
    return findBallSpawnPoint(this.track, this.balls, BALL_SPAWN_MAX_ATTEMPTS, BALL_SPAWN_MARGIN)
  }

  private buildFireWeaponUiState(): FireWeaponUiState {
    const activeWeaponId = this.fireWeapons.length > 0 ? this.fireWeapons[this.activeWeaponIndex] : null
    const nextWeaponIcon = this.fireWeapons.length > 1
      ? getWeaponIcon(this.fireWeapons[(this.activeWeaponIndex + 1) % this.fireWeapons.length])
      : ''

    if (activeWeaponId !== 'turbo_boost') {
      return {
        activeWeaponId,
        activeWeaponIcon: activeWeaponId ? getWeaponIcon(activeWeaponId) : '',
        nextWeaponIcon,
        fireWeaponCount: this.fireWeapons.length,
        turboState: 'hidden',
        turboCooldownProgress: 1,
      }
    }

    if (this.turboBoostActive) {
      return {
        activeWeaponId,
        activeWeaponIcon: getWeaponIcon(activeWeaponId),
        nextWeaponIcon,
        fireWeaponCount: this.fireWeapons.length,
        turboState: 'active',
        turboCooldownProgress: 0,
      }
    }

    if (this.turboBoostCooldown > 0) {
      const turboCooldownProgress = 1 - (this.turboBoostCooldown / TURBO_BOOST_COOLDOWN)
      return {
        activeWeaponId,
        activeWeaponIcon: getWeaponIcon(activeWeaponId),
        nextWeaponIcon,
        fireWeaponCount: this.fireWeapons.length,
        turboState: 'cooldown',
        turboCooldownProgress: Math.max(0, Math.min(1, turboCooldownProgress)),
      }
    }

    return {
      activeWeaponId,
      activeWeaponIcon: getWeaponIcon(activeWeaponId),
      nextWeaponIcon,
      fireWeaponCount: this.fireWeapons.length,
      turboState: 'ready',
      turboCooldownProgress: 1,
    }
  }

  private emitFireWeaponUiState(force = false): void {
    const state = this.buildFireWeaponUiState()
    const signature = JSON.stringify({
      ...state,
      turboCooldownProgress: Number(state.turboCooldownProgress.toFixed(2)),
    })

    if (!force && signature === this.lastFireWeaponUiStateSignature) {
      return
    }

    this.lastFireWeaponUiStateSignature = signature
    this.uiCallbacks.onWeaponUiStateChange?.(state)
  }
}

function getNearestLiveBallDistance(position: THREE.Vector3, balls: Ball[]): number {
  let nearestDistance = Infinity

  for (const ball of balls) {
    if (ball.exploded) continue
    nearestDistance = Math.min(nearestDistance, position.distanceTo(ball.position))
  }

  return nearestDistance
}

function getBallSpawnClearance(balls: Ball[], margin: number): number {
  return balls.length > 0 ? balls[0].getRadius() * 2 + margin : 0
}

function findBallSpawnPoint(track: Track, balls: Ball[], maxAttempts: number, margin: number): THREE.Vector3 {
  let bestCandidate = track.getRandomPointOnTrack()
  let bestDistance = -Infinity

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = track.getRandomPointOnTrack()
    const nearestDistance = getNearestLiveBallDistance(candidate, balls)
    if (nearestDistance > bestDistance) {
      bestCandidate = candidate
      bestDistance = nearestDistance
    }
    if (nearestDistance >= getBallSpawnClearance(balls, margin)) {
      return candidate
    }
  }

  return bestCandidate
}

function resolveBallCollisions(balls: Ball[], track: Track): void {
  const activeBalls = balls.filter(ball => !ball.exploded)
  if (activeBalls.length < 2) return

  for (let pass = 0; pass < activeBalls.length; pass++) {
    let changed = false
    for (let i = 0; i < activeBalls.length; i++) {
      for (let j = i + 1; j < activeBalls.length; j++) {
        if (activeBalls[i].resolveCollisionWithBall(activeBalls[j], track)) {
          changed = true
        }
      }
    }
    if (!changed) break
  }
}

function triggerBallChainReactions(balls: Ball[], explosionPositions: THREE.Vector3[]): void {
  if (explosionPositions.length === 0) {
    return
  }

  for (const ball of balls) {
    if (ball.exploded) continue
    for (const pos of explosionPositions) {
      if (ball.isInChainReactionRange(pos)) {
        if (ball.activated) {
          ball.triggerImmediateDetonation()
        } else {
          ball.triggerActivation()
        }
        break
      }
    }
  }
}
