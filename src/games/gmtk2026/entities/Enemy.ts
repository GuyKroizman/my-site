import Phaser from 'phaser'

export class Enemy {
  container: Phaser.GameObjects.Container
  private sprite: Phaser.GameObjects.Sprite
  private glow: Phaser.GameObjects.Ellipse
  private scene: Phaser.Scene
  private isHurt = false
  private isDying = false
  private deathAnimStarted = false
  private hurtFrame = 0
  private hurtNextTime = 0
  private static readonly SCALE = 8
  // Padding below the visual content within the 146px frame (feet at row ~82)
  private static readonly PAD_BELOW = 63

  health = 30
  private speed = 45
  dead = false

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.container = scene.add.container(x, y)

    // Mimic sprite — anchor at frame bottom; visual feet are PAD_BELOW*SCALE
    // pixels above anchor, so push anchor below container to bring feet to ground
    this.sprite = scene.add.sprite(
      0,
      Enemy.PAD_BELOW * Enemy.SCALE,
      'mimic-walk'
    )
    this.sprite.setOrigin(0.5, 1)
    this.sprite.setScale(Enemy.SCALE)
    this.sprite.play('mimic-walk')

    // Red glow beneath the mimic (at ground level)
    this.glow = scene.add.ellipse(0, 0, 160, 60, 0xff0055, 0.3)
    this.glow.setBlendMode('ADD')

    this.container.add([this.glow, this.sprite])

    // Pulsing glow
    scene.tweens.add({
      targets: this.glow,
      scaleX: 1.4,
      scaleY: 1.4,
      alpha: { from: 0.3, to: 0.55 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  update(targetX: number, targetY: number) {
    if (this.dead) return

    // Handle hurt animation cycling (500ms per frame)
    if (this.isHurt) {
      const now = this.scene.time.now
      if (now >= this.hurtNextTime) {
        this.hurtFrame++
        if (this.hurtFrame >= 3) {
          // Hurt complete — switch to death animation
          this.isHurt = false
          this.isDying = true
          this.sprite.clearTint()
          this.sprite.setTexture('mimic-death')
          this.sprite.setOrigin(0.5, 1)
          this.sprite.setScale(Enemy.SCALE)
          this.sprite.y = Enemy.PAD_BELOW * Enemy.SCALE
          this.sprite.play('mimic-death')
          this.deathAnimStarted = false
          this.scene.sound.play('mimic-death-sfx', { volume: 0.45 })
          return
        }
        this.sprite.setFrame(this.hurtFrame)
        this.hurtNextTime = now + 500
        this.scene.sound.play('mimic-hurt-sfx', {
          volume: 0.35,
          detune: -300 + this.hurtFrame * 300,
        })
      }
      return
    }

    // Death animation playing — wait for it to actually start, then finish
    if (this.isDying) {
      if (this.sprite.anims.isPlaying) {
        this.deathAnimStarted = true
      } else if (this.deathAnimStarted) {
        // Animation played through and stopped — destroy
        this.finalDie()
      }
      return
    }

    const dx = targetX - this.container.x
    const dy = targetY - this.container.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > 5) {
      const moveSpeed = this.speed * 0.016
      this.container.x += (dx / dist) * moveSpeed
      this.container.y += (dy / dist) * moveSpeed * 0.3
    }

    // Flip sprite to face the player
    this.sprite.setFlipX(dx < 0)
  }

  takeDamage(): boolean {
    if (this.dead || this.isHurt) return false
    this.health -= 50

    // Switch to hurt spritesheet and cycle frames every 500ms
    this.isHurt = true
    this.hurtFrame = 0
    this.hurtNextTime = this.scene.time.now + 500
    this.sprite.setTexture('mimic-hurt', 0)
    this.sprite.setOrigin(0.5, 1)
    this.sprite.setScale(Enemy.SCALE)
    this.sprite.y = Enemy.PAD_BELOW * Enemy.SCALE
    this.sprite.setTint(0xffffff)

    this.scene.time.delayedCall(100, () => {
      if (!this.dead) this.sprite.clearTint()
    })

    // Play initial hurt sound
    this.scene.sound.play('mimic-hurt-sfx', { volume: 0.35, detune: -300 })

    // Knockback
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 50,
      yoyo: true,
    })

    return true
  }

  private finalDie() {
    if (this.dead) return
    this.dead = true

    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14
      const particle = this.scene.add.circle(
        this.container.x + Math.cos(angle) * 20,
        this.container.y + Math.sin(angle) * 10,
        4 + Math.random() * 8,
        0xff0055
      )
      particle.setBlendMode('ADD')
      this.scene.tweens.add({
        targets: particle,
        x: particle.x + Math.cos(angle) * (60 + Math.random() * 40),
        y: particle.y + Math.sin(angle) * 30 - 20,
        alpha: 0,
        scale: 0.2,
        duration: 500 + Math.random() * 400,
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
