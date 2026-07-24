import Phaser from 'phaser'

export class Baby {
  container: Phaser.GameObjects.Container
  health = 50
  private followOffset = 30
  private sprite!: Phaser.GameObjects.Image
  private isDeparted = false
  private departureVx = 0
  private departureVy = 0

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.container = scene.add.container(x, y)

    // Baby girl sprite
    this.sprite = scene.add.image(0, 0, 'baby-girl')
    this.sprite.setDisplaySize(28, 28)

    this.container.add([this.sprite])
  }

  ageUpToToddler() {
    this.sprite.setTexture('daughter-toddler')
    this.sprite.setDisplaySize(26, 40)
  }

  ageUpToYoungAdult() {
    this.sprite.setTexture('daughter-young-adult')
    this.sprite.setDisplaySize(33, 60)
  }

  flashRed() {
    this.sprite.setTint(0xff0055)
    this.container.scene.time.delayedCall(150, () => {
      this.sprite.clearTint()
    })
  }

  depart() {
    if (this.isDeparted) return
    this.isDeparted = true
    // She heads off on her own path — ahead and up, away from the family
    this.departureVx = 160
    this.departureVy = -110
  }

  update(womanX: number, womanY: number) {
    if (this.isDeparted) {
      this.container.x += this.departureVx * 0.016
      this.container.y += this.departureVy * 0.016
      return
    }

    const targetX = womanX - this.followOffset
    const targetY = womanY + 5

    this.container.x = Phaser.Math.Linear(this.container.x, targetX, 0.06)
    this.container.y = Phaser.Math.Linear(this.container.y, targetY, 0.06)
  }

  get x() {
    return this.container.x
  }

  get y() {
    return this.container.y
  }
}
