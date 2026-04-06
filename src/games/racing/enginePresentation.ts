import * as THREE from 'three'
import { AmbientBunny } from './AmbientBunny'
import { AmbientWolf } from './AmbientWolf'
import { BackgroundEye } from './BackgroundEye'
import { DecorationGrid } from './DecorationGrid'
import { TimerBillboard } from './TimerBillboard'
import { LapDigitDropEffect } from './LapDigitDropEffect'
import { PlayerArrow } from './PlayerArrow'
import { StartLights } from './StartLights'
import type { LevelConfig } from './levels'
import { DECORATION_BOUNDS, DECORATION_MODELS } from './levels/decorationConfig'

interface PresentationCallbacks {
  onCameraReady?: (screenPos: { x: number; y: number }) => void
}

export class RacingPresentationController {
  private startLights: StartLights
  private playerArrow: PlayerArrow
  private backgroundEyes: BackgroundEye[] = []
  private ambientBunny: AmbientBunny | null = null
  private ambientWolf: AmbientWolf | null = null
  private ambientOuterWolf: AmbientWolf | null = null
  private decorationGrid: DecorationGrid | null = null
  private timerBillboard: TimerBillboard
  private lapDigitDropEffect: LapDigitDropEffect

  private shakeTimer: number = 0
  private shakeDuration: number = 0
  private shakeIntensity: number = 0

  private cinematicActive: boolean = false
  private cinematicTimer: number = 0
  private gameplayCameraPos: THREE.Vector3 = new THREE.Vector3()
  private cinematicStartPos: THREE.Vector3 = new THREE.Vector3()
  private cinematicStartLookAt: THREE.Vector3 = new THREE.Vector3()
  private readonly cinematicHoldDuration: number = 0.5
  private readonly cinematicSweepDuration: number = 2.0

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly callbacks: PresentationCallbacks,
    private readonly levelConfig: LevelConfig
  ) {
    this.startLights = new StartLights(this.scene, () => {})
    this.playerArrow = new PlayerArrow(this.scene)
    this.timerBillboard = new TimerBillboard(this.scene)
    this.lapDigitDropEffect = new LapDigitDropEffect(this.scene)
    this.createAmbientScene()
  }

  public updateCameraPosition(viewWidth: number, viewHeight: number): void {
    const aspect = viewWidth / viewHeight
    const trackWidth = 50
    const fovRad = (this.camera.fov * Math.PI) / 180
    const baseCameraY = 25
    const baseCameraZ = 26

    if (aspect < 1) {
      const requiredY = trackWidth / (2 * Math.tan(fovRad / 2) * aspect)
      const requiredZ = requiredY * (baseCameraZ / baseCameraY)
      this.gameplayCameraPos.set(0, requiredY, requiredZ)
    } else {
      this.gameplayCameraPos.set(0, baseCameraY, baseCameraZ)
    }

    if (!this.cinematicActive) {
      this.camera.position.copy(this.gameplayCameraPos)
    }
  }

  public updateStartLights(deltaTime: number): void {
    this.startLights.update(deltaTime)
  }

  public isStartGreen(): boolean {
    return this.startLights.isGreen()
  }

  public updateRaceTimer(elapsedTime: number): void {
    this.timerBillboard.update(elapsedTime)
  }

  public updatePlayerArrow(deltaTime: number, canStart: boolean, playerPosition?: THREE.Vector3): void {
    if (canStart) {
      this.playerArrow.hide()
      return
    }

    if (playerPosition) {
      this.playerArrow.update(deltaTime, playerPosition)
    }
  }

  public updateSceneEffects(deltaTime: number): void {
    this.updateCinematicCamera(deltaTime)
    this.backgroundEyes.forEach((eye) => eye.update(deltaTime))
    this.ambientBunny?.update(deltaTime)
    this.ambientOuterWolf?.update(deltaTime)
    this.ambientWolf?.update(deltaTime)
    this.lapDigitDropEffect.update(deltaTime)
    this.updateCameraShake(deltaTime)
  }

  public restoreCameraAfterRender(): void {
    if (this.shakeTimer > 0 && !this.cinematicActive) {
      this.camera.position.copy(this.gameplayCameraPos)
    }
  }

  public startRace(carConfigs: LevelConfig['cars']): void {
    this.initCinematicCamera(carConfigs)
    this.startLights.reset()
    this.playerArrow.show()
  }

  public projectFinishLine(): { x: number; y: number } {
    const pos = new THREE.Vector3(0, 0.5, -7).project(this.camera)
    return {
      x: (pos.x * 0.5 + 0.5) * window.innerWidth,
      y: (-pos.y * 0.5 + 0.5) * window.innerHeight,
    }
  }

  public clearLapDigits(): void {
    this.lapDigitDropEffect.clear()
  }

  public spawnLapDigit(lapNumber: number): void {
    this.lapDigitDropEffect.spawnDigit(lapNumber)
  }

  public triggerCameraShake(duration: number, intensity: number): void {
    this.shakeDuration = duration
    this.shakeTimer = duration
    this.shakeIntensity = intensity
  }

  public dispose(): void {
    this.startLights.dispose()
    this.playerArrow.dispose()
    this.timerBillboard.dispose()
    this.decorationGrid?.destroy()
    this.lapDigitDropEffect.dispose()
    this.backgroundEyes.forEach((eye) => eye.dispose())
    this.backgroundEyes = []
    this.ambientBunny?.dispose()
    this.ambientBunny = null
    this.ambientOuterWolf?.dispose()
    this.ambientOuterWolf = null
    this.ambientWolf?.dispose()
    this.ambientWolf = null
  }

  private createAmbientScene(): void {
    if (this.levelConfig.id === 1) {
      this.backgroundEyes.push(
        new BackgroundEye(this.scene, {
          position: { x: 62, y: 4, z: -25 },
          stroll: {
            delay: 10,
            duration: 15,
            endPosition: { x: 10, y: 4, z: -17 },
          },
        })
      )
      this.backgroundEyes.push(
        new BackgroundEye(this.scene, {
          position: { x: 62, y: 4, z: -25 },
          scaleMultiplier: 0.5,
          stroll: {
            delay: 24,
            duration: 10,
            endPosition: { x: 5, y: 4, z: -22 },
          },
        })
      )
    }

    if (this.levelConfig.id === 2) {
      const ambientOrbitCenter = { x: -24, y: 0.5, z: -19 }
      this.ambientWolf = new AmbientWolf(this.scene, ambientOrbitCenter)
      this.ambientOuterWolf = new AmbientWolf(this.scene, ambientOrbitCenter, {
        radius: 4.6,
        startAngle: 0.28,
      })
      this.ambientBunny = new AmbientBunny(this.scene, ambientOrbitCenter)
    }

    if (this.levelConfig.decorationRows?.length) {
      this.decorationGrid = new DecorationGrid(
        this.scene,
        DECORATION_BOUNDS,
        DECORATION_MODELS,
        this.levelConfig.decorationRows
      )
    }
  }

  private smootherstep(t: number): number {
    const clamped = Math.max(0, Math.min(1, t))
    return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10)
  }

  private initCinematicCamera(carConfigs: LevelConfig['cars']): void {
    let centerX = 0
    let centerZ = 0

    carConfigs.forEach((config) => {
      centerX += config.x
      centerZ += config.z
    })
    centerX /= carConfigs.length
    centerZ /= carConfigs.length

    this.cinematicStartPos.set(centerX + 8, 1.5, centerZ)
    this.cinematicStartLookAt.set(centerX - 2, 0.5, centerZ)

    this.camera.position.copy(this.cinematicStartPos)
    this.camera.lookAt(this.cinematicStartLookAt)

    this.cinematicActive = true
    this.cinematicTimer = 0
  }

  private updateCinematicCamera(deltaTime: number): void {
    if (!this.cinematicActive) return

    this.cinematicTimer += deltaTime

    if (this.cinematicTimer <= this.cinematicHoldDuration) {
      this.camera.position.copy(this.cinematicStartPos)
      this.camera.lookAt(this.cinematicStartLookAt)
      return
    }

    const sweepTime = this.cinematicTimer - this.cinematicHoldDuration
    const t = Math.min(sweepTime / this.cinematicSweepDuration, 1)
    const easedT = this.smootherstep(t)

    this.camera.position.lerpVectors(this.cinematicStartPos, this.gameplayCameraPos, easedT)

    const currentLookAt = new THREE.Vector3().lerpVectors(
      this.cinematicStartLookAt,
      new THREE.Vector3(0, 0, 0),
      easedT
    )
    this.camera.lookAt(currentLookAt)

    if (t >= 1) {
      this.cinematicActive = false
      this.camera.position.copy(this.gameplayCameraPos)
      this.camera.lookAt(0, 0, 0)
      this.callbacks.onCameraReady?.(this.projectFinishLine())
      this.startLights.startSequence()
    }
  }

  private updateCameraShake(deltaTime: number): void {
    if (this.shakeTimer <= 0 || this.cinematicActive) return

    this.shakeTimer -= deltaTime
    const t = Math.max(0, this.shakeTimer / this.shakeDuration)
    const magnitude = this.shakeIntensity * t
    this.camera.position.x = this.gameplayCameraPos.x + (Math.random() - 0.5) * 2 * magnitude
    this.camera.position.y = this.gameplayCameraPos.y + (Math.random() - 0.5) * 2 * magnitude
    this.camera.position.z = this.gameplayCameraPos.z + (Math.random() - 0.5) * 2 * magnitude
  }
}
