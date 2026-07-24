import Phaser from 'phaser'

export type PregnancyStage = 0 | 1 | 2 // 0=not pregnant, 1=small, 2=big

export class Woman {
  container: Phaser.GameObjects.Container
  private body!: Phaser.GameObjects.Image
  private bump!: Phaser.GameObjects.Ellipse
  private pregnancyStage: PregnancyStage = 0
  private isFollowing = false
  health = 100
  private followOffset = 50

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.container = scene.add.container(x, y)

    // Body — woman-adult sprite (single image, no spritesheet yet)
    this.body = scene.add.image(0, 0, 'woman-adult')
    this.body.setDisplaySize(46, 80)

    // Pregnancy bump (hidden by default)
    this.bump = scene.add.ellipse(6, 18, 20, 16, 0xf472b6)
    this.bump.setAlpha(0)

    this.container.add([this.body, this.bump])
  }

  startFollowing() {
    this.isFollowing = true
  }

  setPregnancyStage(stage: PregnancyStage) {
    this.pregnancyStage = stage

    if (stage === 0) {
      this.bump.setAlpha(0)
      this.bump.setSize(20, 16)
    } else if (stage === 1) {
      this.bump.setAlpha(1)
      this.bump.setSize(24, 20)
      this.bump.setFillStyle(0xf472b6)
    } else {
      this.bump.setAlpha(1)
      this.bump.setSize(32, 26)
      this.bump.setFillStyle(0xf9a8d4)
    }
  }

  getPregnancyStage(): PregnancyStage {
    return this.pregnancyStage
  }

  update(playerX: number, playerY: number) {
    if (!this.isFollowing) return

    const targetX = playerX - this.followOffset
    const targetY = playerY - 10

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
