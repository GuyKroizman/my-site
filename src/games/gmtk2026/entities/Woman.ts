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

  flashRed() {
    this.body.setTint(0xff0055)
    this.body.scene.time.delayedCall(150, () => {
      this.body.clearTint()
    })
  }

  setPregnancyStage(stage: PregnancyStage) {
    this.pregnancyStage = stage

    if (stage === 0) {
      this.body.setTexture('woman-adult')
      this.body.setDisplaySize(46, 80)
      this.bump.setAlpha(0)
      this.bump.setSize(20, 16)
    } else if (stage === 1) {
      // Half-pregnant sprite (no bump overlay needed)
      this.body.setTexture('woman-adult-pregnant-half')
      this.body.setDisplaySize(41, 80)
      this.bump.setAlpha(0)
    } else {
      // Full-pregnancy sprite (no bump overlay needed)
      this.body.setTexture('woman-adult-pregnant-full')
      this.body.setDisplaySize(42, 80)
      this.bump.setAlpha(0)
    }
  }

  ageUpToMiddleAged() {
    this.body.setTexture('woman-middle-aged')
    this.body.setDisplaySize(59, 80)
    this.bump.setAlpha(0)
  }

  ageUpToElderly() {
    this.body.setTexture('woman-elderly')
    this.body.setDisplaySize(53, 80)
    this.bump.setAlpha(0)
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
