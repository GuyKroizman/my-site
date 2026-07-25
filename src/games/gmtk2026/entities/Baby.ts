import Phaser from 'phaser'

export class Baby {
  container: Phaser.GameObjects.Container
  health = 50
  private followOffset = 60
  private sprite!: Phaser.GameObjects.Image
  private isDeparted = false
  private departureVx = 0
  private departureVy = 0

  // On-screen heights: baby = 86px (same as the player baby), toddler = 172px,
  // young adult = 430px (5x baby, same as the player young adult)
  private static SCALES: Record<string, number> = {
    'baby-girl': 0.915,
    'daughter-toddler': 1,
    'daughter-young-adult': 1,
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.container = scene.add.container(x, y)

    // Baby girl sprite, feet-anchored at the container origin
    this.sprite = scene.add.image(0, 0, 'baby-girl')
    this.sprite.setOrigin(0.5, 1)
    this.sprite.setScale(Baby.SCALES['baby-girl'])

    this.container.add([this.sprite])
  }

  ageUpToToddler() {
    this.sprite.setTexture('daughter-toddler')
    this.sprite.setScale(Baby.SCALES['daughter-toddler'])
  }

  ageUpToYoungAdult() {
    this.sprite.setTexture('daughter-young-adult')
    this.sprite.setScale(Baby.SCALES['daughter-young-adult'])
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

  update(womanX: number, womanFeetY: number) {
    if (this.isDeparted) {
      this.container.x += this.departureVx * 0.016
      this.container.y += this.departureVy * 0.016
      return
    }

    const targetX = womanX - this.followOffset
    const targetY = womanFeetY // container origin is at her feet

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
