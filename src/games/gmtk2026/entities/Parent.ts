import Phaser from 'phaser'

export class Parent {
  container: Phaser.GameObjects.Container
  private scene: Phaser.Scene
  private projectiles: Phaser.GameObjects.Rectangle[] = []
  private lastShotTime = 0
  private fireRate = 350
  range = 320
  private isDeparted = false
  private departureVx = 0
  private departureVy = 0

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bodyColor: number,
    private flip: boolean
  ) {
    this.scene = scene
    this.container = scene.add.container(x, y)

    const body = scene.add.rectangle(0, 0, 44, 64, bodyColor)
    const gun = scene.add.rectangle(flip ? -22 : 22, 8, 40, 14, 0x444444)
    const leftEye = scene.add.circle(-10, -18, 6, 0xffffff)
    const rightEye = scene.add.circle(10, -18, 6, 0xffffff)
    const leftPupil = scene.add.circle(-10, -18, 3, 0x000000)
    const rightPupil = scene.add.circle(10, -18, 3, 0x000000)

    this.container.add([body, gun, leftEye, rightEye, leftPupil, rightPupil])
  }

  update(
    playerX: number,
    playerY: number,
    offsetX: number,
    offsetY: number,
    enemies: { x: number; y: number }[],
    time: number
  ) {
    if (!this.isDeparted) {
      this.container.x = Phaser.Math.Linear(this.container.x, playerX + offsetX, 0.08)
      this.container.y = Phaser.Math.Linear(this.container.y, playerY + offsetY, 0.08)
    } else {
      this.container.x += this.departureVx * 0.016
      this.container.y += this.departureVy * 0.016
    }

    // Find nearest enemy
    let nearest: { x: number; y: number; dist: number } | null = null
    for (const e of enemies) {
      const dx = e.x - this.container.x
      const dy = e.y - this.container.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= this.range && (!nearest || dist < nearest.dist)) {
        nearest = { x: e.x, y: e.y, dist }
      }
    }

    if (nearest) {
      this.shootAt(nearest.x, nearest.y, time)
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]
      p.x += (p as any).vx
      p.y += (p as any).vy

      const cam = this.scene.cameras.main
      const margin = 300
      if (
        p.x < cam.scrollX - margin ||
        p.x > cam.scrollX + cam.width + margin ||
        p.y < -margin ||
        p.y > cam.height + margin
      ) {
        p.destroy()
        this.projectiles.splice(i, 1)
      }
    }
  }

  private shootAt(targetX: number, targetY: number, time: number) {
    if (time - this.lastShotTime < this.fireRate) return
    this.lastShotTime = time

    const dx = targetX - this.container.x
    const dy = targetY - this.container.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist === 0) return

    const dirX = dx / dist
    const dirY = dy / dist
    const muzzleX = this.container.x + dirX * 38
    const muzzleY = this.container.y + dirY * 38 + 8

    // Muzzle flash — additive glow
    const flash = this.scene.add.circle(muzzleX, muzzleY, 18, 0xffaa00)
    flash.setBlendMode('ADD')
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2.5,
      duration: 80,
      onComplete: () => flash.destroy(),
    })

    // Projectile
    const speed = 14
    const projectile = this.scene.add.rectangle(muzzleX, muzzleY, 20, 5, 0xffdd44)
    ;(projectile as any).vx = dirX * speed
    ;(projectile as any).vy = dirY * speed
    this.projectiles.push(projectile)
  }

  depart() {
    if (this.isDeparted) return
    this.isDeparted = true
    this.departureVx = this.flip ? -80 : 120
    this.departureVy = -90
  }

  getProjectiles() {
    return this.projectiles
  }

  destroy() {
    this.projectiles.forEach((p) => p.destroy())
    this.projectiles = []
    this.container.destroy()
  }

  get x() {
    return this.container.x
  }

  get y() {
    return this.container.y
  }
}
