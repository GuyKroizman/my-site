import Phaser from 'phaser'

export type PregnancyStage = 0 | 1 | 2 // 0=not pregnant, 1=small, 2=big

export class Woman {
  container: Phaser.GameObjects.Container
  private body!: Phaser.GameObjects.Image
  private bump!: Phaser.GameObjects.Ellipse
  private pregnancyStage: PregnancyStage = 0
  private isFollowing = false
  health = 100
  private followOffset = 120

  // Scale so her on-screen height matches the man's (473px; 426px when elderly)
  private static SCALES: Record<string, number> = {
    'woman-adult': 1.962,
    'woman-adult-pregnant-half': 1.915,
    'woman-adult-pregnant-full': 1.923,
    'woman-middle-aged': 1.907,
    'woman-elderly': 1.732,
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.container = scene.add.container(x, y)

    // Body — woman-adult sprite, feet-anchored at the container origin
    this.body = scene.add.image(0, 0, 'woman-adult')
    this.body.setOrigin(0.5, 1)
    this.body.setScale(Woman.SCALES['woman-adult'])

    // Pregnancy bump (hidden by default)
    this.bump = scene.add.ellipse(6, -60, 20, 16, 0xf472b6)
    this.bump.setAlpha(0)

    this.container.add([this.body, this.bump])
  }

  startFollowing() {
    this.isFollowing = true
  }

  private setSprite(texture: string) {
    this.body.setTexture(texture)
    this.body.setScale(Woman.SCALES[texture])
    this.bump.setAlpha(0)
  }

  setPregnancyStage(stage: PregnancyStage) {
    this.pregnancyStage = stage

    if (stage === 0) {
      this.setSprite('woman-adult')
    } else if (stage === 1) {
      this.setSprite('woman-adult-pregnant-half')
    } else {
      this.setSprite('woman-adult-pregnant-full')
    }
  }

  ageUpToMiddleAged() {
    this.setSprite('woman-middle-aged')
  }

  ageUpToElderly() {
    this.setSprite('woman-elderly')
  }

  flashRed() {
    this.body.setTint(0xff0055)
    this.body.scene.time.delayedCall(150, () => {
      this.body.clearTint()
    })
  }

  getPregnancyStage(): PregnancyStage {
    return this.pregnancyStage
  }

  update(playerX: number, playerFeetY: number) {
    if (!this.isFollowing) return

    const targetX = playerX - this.followOffset
    const targetY = playerFeetY // container origin is at her feet

    this.container.x = Phaser.Math.Linear(this.container.x, targetX, 0.08)
    this.container.y = Phaser.Math.Linear(this.container.y, targetY, 0.08)
  }

  get x() {
    return this.container.x
  }

  get y() {
    return this.container.y
  }
}
