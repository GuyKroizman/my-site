import Phaser from 'phaser'

export type PlayerStage = 'baby' | 'young-adult' | 'adult' | 'adult-plus' | 'middle-aged' | 'middle-ager' | 'elderly'

export class Player {
  sprite: Phaser.Physics.Arcade.Sprite
  private keys: {
    left: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
    up: Phaser.Input.Keyboard.Key
    down: Phaser.Input.Keyboard.Key
    jump: Phaser.Input.Keyboard.Key
    attack: Phaser.Input.Keyboard.Key
  }
  private speed = 120
  private jumpStrength = 400
  private isGrounded = false
  private canAttack = false
  private isAttacking = false
  private attackCooldown = 400
  private lastAttackTime = 0
  private attackSlash!: Phaser.GameObjects.Rectangle
  private attackAngle = 0 // radians
  private attackDistance = 60
  private maxHealth = 100
  health = 100
  private invincibleUntil = 0
  private invincibleDuration = 800
  stage: PlayerStage = 'baby'
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.sprite = scene.physics.add.sprite(x, y, 'baby')
    this.sprite.setCollideWorldBounds(true)
    this.sprite.setBounce(0.1)
    this.sprite.play('baby-idle')

    // New sheet frames are 768x448 with the baby content at x≈184-557, y≈39-383
    // Scale down so the baby appears roughly the old 100x85 size
    this.sprite.setScale(0.25)

    // Consistent bottom-aligned body for all stages (frame units, scaled by 0.25)
    this.sprite.setBodySize(240, 280, false)
    this.sprite.setOffset(250, 103)

    // Attack slash visual (hidden by default)
    this.attackSlash = scene.add.rectangle(0, 0, 70, 20, 0xffffff)
    this.attackSlash.setBlendMode('ADD')
    this.attackSlash.setAlpha(0)
    this.attackSlash.setDepth(10)

    this.keys = {
      left: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      up: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      jump: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      attack: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
    }
  }

  // Per-stage visuals: scale (baby = 86px tall on screen; young-adult = 5x baby;
  // adult = young-adult +10%; middle-aged/-ager = adult; elderly = middle-aged -10%)
  // Body box is in frame units: ~45% of content width, full content height, bottom-aligned
  private static STAGE_VISUALS: Record<
    string,
    { scale: number; bodyX: number; bodyY: number; bodyW: number; bodyH: number }
  > = {
      'young-adult': { scale: 0.5385, bodyX: 294, bodyY: 2, bodyW: 202, bodyH: 399 },
      adult: { scale: 1, bodyX: 41, bodyY: 20, bodyW: 67, bodyH: 299 },
      'adult-plus': { scale: 0.8, bodyX: 63, bodyY: 0, bodyW: 94, bodyH: 372 },
      'middle-aged': { scale: 1, bodyX: 49, bodyY: 19, bodyW: 80, bodyH: 299 },
      'middle-ager': { scale: 0.8, bodyX: 71, bodyY: 0, bodyW: 116, bodyH: 377 },
      elderly: { scale: 0.7, bodyX: 79, bodyY: 0, bodyW: 129, bodyH: 375 },
    }

  // Jump sprite is rendered 2x the base young-adult scale while airborne
  private static JUMP_SCALE_MULTIPLIER = 2
  private isJumpScaled = false

  private setJumpScale(on: boolean) {
    if (this.isJumpScaled === on) return
    this.isJumpScaled = on

    const v = Player.STAGE_VISUALS['young-adult']
    const baseScale = v.scale
    const jumpScale = baseScale * Player.JUMP_SCALE_MULTIPLIER
    // Distance from sprite center to body bottom, per unit scale (frame units)
    const bottomOffset = v.bodyY + v.bodyH - 448 / 2

    if (on) {
      this.sprite.y += (baseScale - jumpScale) * bottomOffset // keep feet planted
      this.sprite.setScale(jumpScale)
    } else {
      this.sprite.y += (jumpScale - baseScale) * bottomOffset // restore on landing
      this.sprite.setScale(baseScale)
    }
  }

  getFeetY(): number {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body
    return body.y + body.height
  }

  private flashTransition(textureKey: string, newSpeed: number) {
    this.speed = newSpeed

    this.sprite.setTint(0xffffff)
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.2,
      duration: 80,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.sprite.clearTint()
        this.sprite.setAlpha(1)
      },
    })

    this.scene.time.delayedCall(150, () => {
      const oldBody = this.sprite.body as Phaser.Physics.Arcade.Body
      const oldBottomY = oldBody.y + oldBody.height

      this.sprite.stop()
      this.sprite.setTexture(textureKey)
      this.isJumpScaled = false // stage change cancels any jump scaling

      const visuals = Player.STAGE_VISUALS[textureKey]
      this.sprite.setScale(visuals.scale)
      this.sprite.setBodySize(visuals.bodyW, visuals.bodyH, false)
      this.sprite.setOffset(visuals.bodyX, visuals.bodyY)

      // Preserve body-bottom world position so feet stay on ground
      const newBody = this.sprite.body as Phaser.Physics.Arcade.Body
      this.sprite.y = oldBottomY - newBody.height / 2
    })
  }

  ageUp() {
    if (this.stage !== 'baby') return
    this.stage = 'young-adult'
    this.canAttack = true
    // 768x448 frames, ~399px-tall character → scale 0.22 ≈ 88px on screen
    this.flashTransition('young-adult', 220)
  }

  ageUpToAdult() {
    if (this.stage !== 'young-adult') return
    this.stage = 'adult'
    this.flashTransition('adult', 200)
  }

  ageUpToAdultPlus() {
    if (this.stage !== 'adult') return
    this.stage = 'adult-plus'
    this.flashTransition('adult-plus', 180)
  }

  ageUpToMiddleAged() {
    if (this.stage !== 'adult-plus') return
    this.stage = 'middle-aged'
    this.flashTransition('middle-aged', 160)
  }

  ageUpToMiddleAger() {
    if (this.stage !== 'middle-aged') return
    this.stage = 'middle-ager'
    this.flashTransition('middle-ager', 140)
  }

  ageUpToElderly() {
    if (this.stage !== 'middle-ager') return
    this.stage = 'elderly'
    this.flashTransition('elderly', 100)
  }

  setStage(stage: PlayerStage) {
    if (this.stage === stage) return

    this.stage = stage
    this.canAttack = stage !== 'baby'
    this.isJumpScaled = false

    if (stage === 'baby') {
      this.sprite.stop()
      this.sprite.setTexture('baby')
      this.sprite.setScale(0.25)
      this.sprite.setBodySize(240, 280, false)
      this.sprite.setOffset(103, 103)
      this.speed = 180
    } else {
      const visuals = Player.STAGE_VISUALS[stage]
      this.sprite.stop()
      this.sprite.setTexture(stage)
      this.sprite.setScale(visuals.scale)
      this.sprite.setBodySize(visuals.bodyW, visuals.bodyH, false)
      this.sprite.setOffset(visuals.bodyX, visuals.bodyY)
      this.speed = {
        'young-adult': 220,
        adult: 200,
        'adult-plus': 180,
        'middle-aged': 160,
        'middle-ager': 140,
        elderly: 100,
      }[stage]!
    }

    const prefix = this.animPrefix()
    if (prefix) {
      this.sprite.play(`${prefix}-idle`, true)
    }
  }

  private animPrefix(): string | null {
    if (this.stage === 'baby') return 'baby'
    if (this.stage === 'young-adult') return 'young-adult'
    return null
  }

  update() {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body
    this.isGrounded = body.blocked.down || body.touching.down
    const animPrefix = this.animPrefix()

    // Movement
    if (this.keys.left.isDown) {
      this.sprite.setVelocityX(-this.speed)
      this.sprite.setFlipX(true)
      if (!this.isAttacking && this.isGrounded && animPrefix) {
        this.sprite.play(`${animPrefix}-run`, true)
      }
    } else if (this.keys.right.isDown) {
      this.sprite.setVelocityX(this.speed)
      this.sprite.setFlipX(false)
      if (!this.isAttacking && this.isGrounded && animPrefix) {
        this.sprite.play(`${animPrefix}-run`, true)
      }
    } else {
      this.sprite.setVelocityX(0)
      if (!this.isAttacking && this.isGrounded && animPrefix) {
        this.sprite.play(`${animPrefix}-idle`, true)
      }
    }

    // Jump — only from young-adult onwards
    if (Phaser.Input.Keyboard.JustDown(this.keys.jump) && this.isGrounded && this.stage !== 'baby') {
      this.sprite.setVelocityY(-this.jumpStrength)
    }

    // Jump animation while airborne (young-adult stage), rendered 2x bigger
    // On landing, the movement code above resumes run/idle, which also restores the run texture
    if (!this.isAttacking && !this.isGrounded && this.stage === 'young-adult') {
      this.setJumpScale(true)
      this.sprite.play('young-adult-jump', true)
    } else if (this.isGrounded && this.isJumpScaled) {
      this.setJumpScale(false)
    }

    // Attack — Z key, only from young-adult onwards
    if (Phaser.Input.Keyboard.JustDown(this.keys.attack) && this.canAttack && !this.isAttacking) {
      const now = this.scene.time.now
      if (now - this.lastAttackTime >= this.attackCooldown) {
        this.lastAttackTime = now
        this.performAttack()
      }
    }

    // Update attack slash position and rotation
    if (this.isAttacking) {
      this.updateAttackSlashPosition()
    }
  }

  private updateAttackSlashPosition() {
    const cx = this.sprite.x
    const cy = this.sprite.y - 20
    this.attackSlash.x = cx + Math.cos(this.attackAngle) * this.attackDistance
    this.attackSlash.y = cy + Math.sin(this.attackAngle) * this.attackDistance
    this.attackSlash.setRotation(this.attackAngle)
  }

  private performAttack() {
    this.isAttacking = true
    this.lastAttackTime = this.scene.time.now

    if (this.stage === 'young-adult') {
      // Horizontal-only attack for the young-adult stage
      const facingLeft = this.keys.left.isDown
      this.sprite.setFlipX(facingLeft)
      this.attackAngle = facingLeft ? Math.PI : 0

      this.sprite.stop()
      this.sprite.setTexture('young-adult-attack')
      this.sprite.setScale(Player.STAGE_VISUALS['young-adult'].scale)
      this.sprite.play('young-adult-attack', true)

      // The sprite sheet already contains the sword slash, so hide the generic slash
      this.attackSlash.setAlpha(0)
      this.updateAttackSlashPosition()

      this.sprite.once('animationcomplete-young-adult-attack', () => {
        this.isAttacking = false
        this.sprite.setTexture('young-adult')
        // The next update frame will resume run/idle
      })
      return
    }

    // Compute 8-direction angle from held keys (used for adult+ stages)
    let dx = 0
    let dy = 0
    if (this.keys.left.isDown) dx = -1
    else if (this.keys.right.isDown) dx = 1
    if (this.keys.up.isDown) dy = -1
    else if (this.keys.down.isDown) dy = 1

    // Default to right if no direction held
    if (dx === 0 && dy === 0) {
      dx = 1
    }

    this.attackAngle = Math.atan2(dy, dx)

    this.updateAttackSlashPosition()
    this.attackSlash.setAlpha(0.9)
    this.attackSlash.setScale(1, 1)

    this.scene.tweens.add({
      targets: this.attackSlash,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 150,
      onComplete: () => {
        this.isAttacking = false
      },
    })
  }

  getAttackHitbox(): { x: number; y: number; radius: number } | null {
    if (!this.isAttacking) return null
    // Circular hitbox centered on slash tip
    return {
      x: this.attackSlash.x,
      y: this.attackSlash.y,
      radius: 40,
    }
  }

  takeDamage(amount: number): boolean {
    const now = this.scene.time.now
    if (now < this.invincibleUntil) return false

    this.health -= amount
    this.invincibleUntil = now + this.invincibleDuration

    // Flash red
    this.sprite.setTint(0xff0055)
    this.scene.time.delayedCall(150, () => {
      this.sprite.clearTint()
    })

    // Knockback slightly
    this.sprite.setVelocityY(-150)

    return true
  }

  getHealthPercent() {
    return Math.max(0, this.health / this.maxHealth)
  }

  isDead() {
    return this.health <= 0
  }
}
