import Phaser from 'phaser'

export class Enemy {
  container: Phaser.GameObjects.Container
  health = 30
  private speed = 45
  dead = false

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.container = scene.add.container(x, y)

    const body = scene.add.ellipse(0, 0, 56, 44, 0x1a0b2e)
    const outline = scene.add.ellipse(0, 0, 60, 48, 0x4a2b6e)
    outline.setStrokeStyle(2, 0x7c4dff)
    const glow = scene.add.ellipse(0, 0, 50, 38, 0x2d1b4e, 0.5)
    const leftEye = scene.add.circle(-12, -4, 6, 0xff0055)
    const rightEye = scene.add.circle(12, -4, 6, 0xff0055)

    leftEye.setBlendMode('ADD')
    rightEye.setBlendMode('ADD')

    this.container.add([outline, body, glow, leftEye, rightEye])

    // Pulsing glow animation
    scene.tweens.add({
      targets: glow,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: { from: 0.5, to: 0.9 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  update(targetX: number, targetY: number) {
    if (this.dead) return

    const dx = targetX - this.container.x
    const dy = targetY - this.container.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > 5) {
      const moveSpeed = this.speed * 0.016
      this.container.x += (dx / dist) * moveSpeed
      this.container.y += (dy / dist) * moveSpeed * 0.3
    }
  }

  takeDamage(): boolean {
    if (this.dead) return false
    this.health -= 50

    this.container.scene.tweens.add({
      targets: this.container,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 40,
      yoyo: true,
    })

    if (this.health <= 0) {
      this.die()
      return true
    }
    return false
  }

  private die() {
    this.dead = true
    const scene = this.container.scene

    for (let i = 0; i < 8; i++) {
      const particle = scene.add.circle(
        this.container.x + (Math.random() - 0.5) * 40,
        this.container.y + (Math.random() - 0.5) * 30,
        3 + Math.random() * 5,
        0x2d1b4e
      )
      particle.setBlendMode('ADD')
      scene.tweens.add({
        targets: particle,
        x: particle.x + (Math.random() - 0.5) * 60,
        y: particle.y + 30 + Math.random() * 30,
        alpha: 0,
        duration: 600 + Math.random() * 400,
        onComplete: () => particle.destroy(),
      })
    }

    this.container.destroy()
  }

  get x() {
    return this.container.x
  }

  get y() {
    return this.container.y
  }
}
