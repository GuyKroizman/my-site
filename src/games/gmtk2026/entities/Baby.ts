import Phaser from 'phaser'

export class Baby {
  container: Phaser.GameObjects.Container
  health = 50
  private followOffset = 30

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.container = scene.add.container(x, y)

    // Body — tiny rectangle
    const body = scene.add.rectangle(0, 0, 20, 25, 0x60a5fa)
    body.setStrokeStyle(2, 0x93c5fd)

    // Head
    const head = scene.add.circle(0, -18, 10, 0xfbbf24)
    head.setStrokeStyle(2, 0xf59e0b)

    this.container.add([body, head])
  }

  update(womanX: number, womanY: number) {
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
