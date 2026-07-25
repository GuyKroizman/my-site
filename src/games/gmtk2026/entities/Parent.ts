import Phaser from 'phaser'

interface EnemyTarget {
  x: number
  y: number
  dead: boolean
  takeDamage(): boolean
}

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
  private sprite?: Phaser.GameObjects.Sprite
  private isAttacking = false
  private detectionRange = 500
  private meleeRange = 90

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bodyColor: number,
    private flip: boolean,
    textureKey?: string
  ) {
    this.scene = scene
    this.container = scene.add.container(x, y)

    if (textureKey) {
      // Father — sprite sheet
      this.sprite = scene.add.sprite(0, 100, textureKey)
      this.sprite.setScale(0.8)
      this.sprite.setOrigin(0.5, 1)
      this.sprite.play('father-walk', true)
      this.container.add([this.sprite])
    } else {
      // Mother — simple shape
      const body = scene.add.rectangle(0, 0, 44, 64, bodyColor)
      const gun = scene.add.rectangle(flip ? -22 : 22, 8, 40, 14, 0x444444)
      const leftEye = scene.add.circle(-10, -18, 6, 0xffffff)
      const rightEye = scene.add.circle(10, -18, 6, 0xffffff)
      const leftPupil = scene.add.circle(-10, -18, 3, 0x000000)
      const rightPupil = scene.add.circle(10, -18, 3, 0x000000)
      this.container.add([body, gun, leftEye, rightEye, leftPupil, rightPupil])
    }
  }

  update(
    playerX: number,
    playerY: number,
    offsetX: number,
    offsetY: number,
    enemies: EnemyTarget[],
    time: number
  ) {
    if (this.isDeparted) {
      this.container.x += this.departureVx * 0.016
      this.container.y += this.departureVy * 0.016
      return
    }

    if (this.sprite) {
      // Father: melee behavior — chase enemies, hit them close-up
      this.updateMeleeBehavior(playerX, playerY, offsetX, offsetY, enemies, time)
    } else {
      // Mother: follow player and shoot projectiles
      this.container.x = Phaser.Math.Linear(this.container.x, playerX + offsetX, 0.08)
      this.container.y = Phaser.Math.Linear(this.container.y, playerY + offsetY, 0.08)

      let nearest: EnemyTarget | null = null
      let nearestDist = Infinity
      for (const e of enemies) {
        if (e.dead) continue
        const dx = e.x - this.container.x
        const dy = e.y - this.container.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist <= this.range && dist < nearestDist) {
          nearest = e
          nearestDist = dist
        }
      }

      if (nearest) {
        this.shootAt(nearest.x, nearest.y, time)
      }
    }

    // Update projectiles (mother only)
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

  private updateMeleeBehavior(
    playerX: number,
    playerY: number,
    offsetX: number,
    offsetY: number,
    enemies: EnemyTarget[],
    time: number
  ) {
    if (this.isAttacking) return

    let nearest: EnemyTarget | null = null
    let nearestDist = Infinity
    for (const e of enemies) {
      if (e.dead) continue
      const dx = e.x - this.container.x
      const dy = e.y - this.container.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= this.detectionRange && dist < nearestDist) {
        nearest = e
        nearestDist = dist
      }
    }

    if (nearest) {
      if (nearestDist <= this.meleeRange) {
        this.performMeleeAttack(nearest, time)
      } else {
        // Chase enemy
        this.container.x = Phaser.Math.Linear(this.container.x, nearest.x, 0.12)
        this.container.y = Phaser.Math.Linear(this.container.y, nearest.y, 0.12)
        this.sprite?.setFlipX(nearest.x < this.container.x)
      }
    } else {
      // Follow player
      const targetX = playerX + offsetX
      const targetY = playerY + offsetY
      this.container.x = Phaser.Math.Linear(this.container.x, targetX, 0.08)
      this.container.y = Phaser.Math.Linear(this.container.y, targetY, 0.08)
      if (Math.abs(targetX - this.container.x) > 5) {
        this.sprite?.setFlipX(targetX < this.container.x)
      }
    }
  }

  private performMeleeAttack(target: EnemyTarget, time: number) {
    if (time - this.lastShotTime < this.fireRate) return
    this.lastShotTime = time

    this.isAttacking = true
    this.sprite?.setFlipX(target.x < this.container.x)
    this.sprite?.setScale(2) // attack sprites are much smaller in-frame
    this.sprite?.setY(205)   // push down so feet align with ground
    this.sprite?.play('father-attack', true)

    // Deal damage at the start of the swing
    target.takeDamage()

    this.sprite?.once('animationcomplete-father-attack', () => {
      this.isAttacking = false
      this.sprite?.setScale(0.8) // restore walk scale
      this.sprite?.setY(100)
      this.sprite?.play('father-walk', true)
    })
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
      ; (projectile as any).vx = dirX * speed
      ; (projectile as any).vy = dirY * speed
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
