import Phaser from 'phaser'

export type PlayerStage = 'baby' | 'young-adult' | 'adult' | 'adult-plus' | 'middle-aged' | 'middle-ager' | 'elderly'

export class Player {
  sprite: Phaser.Physics.Arcade.Sprite
  private keys: {
    left: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
    jump: Phaser.Input.Keyboard.Key
  }
  private speed = 120
  private jumpStrength = 400
  private isGrounded = false
  stage: PlayerStage = 'baby'
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.sprite = scene.physics.add.sprite(x, y, 'baby')
    this.sprite.setCollideWorldBounds(true)
    this.sprite.setBounce(0.1)
    this.sprite.play('baby-idle')

    // Consistent bottom-aligned body for all stages
    this.sprite.setBodySize(60, 70, false)
    this.sprite.setOffset(20, 15)

    this.keys = {
      left: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      jump: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    }
  }

  private flashTransition(textureKey: string, scale: number, newSpeed: number) {
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
      this.sprite.setScale(scale)

      // Keep a consistent body size so the feet always collide at the same spot
      this.sprite.setBodySize(60, 80, false)
      this.sprite.setOffset(
        (this.sprite.displayWidth - 60) / 2,
        this.sprite.displayHeight - 80
      )

      // Preserve body-bottom world position so feet stay on ground
      const newBody = this.sprite.body as Phaser.Physics.Arcade.Body
      this.sprite.y = oldBottomY - newBody.height / 2
    })
  }

  ageUp() {
    if (this.stage !== 'baby') return
    this.stage = 'young-adult'
    this.flashTransition('young-adult', 0.5, 220)
  }

  ageUpToAdult() {
    if (this.stage !== 'young-adult') return
    this.stage = 'adult'
    this.flashTransition('adult', 0.5, 200)
  }

  ageUpToAdultPlus() {
    if (this.stage !== 'adult') return
    this.stage = 'adult-plus'
    this.flashTransition('adult-plus', 0.5, 180)
  }

  ageUpToMiddleAged() {
    if (this.stage !== 'adult-plus') return
    this.stage = 'middle-aged'
    this.flashTransition('middle-aged', 0.5, 160)
  }

  ageUpToMiddleAger() {
    if (this.stage !== 'middle-aged') return
    this.stage = 'middle-ager'
    this.flashTransition('middle-ager', 0.5, 140)
  }

  ageUpToElderly() {
    if (this.stage !== 'middle-ager') return
    this.stage = 'elderly'
    this.flashTransition('elderly', 0.5, 100)
  }

  update() {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body
    this.isGrounded = body.blocked.down || body.touching.down

    // Movement
    if (this.keys.left.isDown) {
      this.sprite.setVelocityX(-this.speed)
      this.sprite.setFlipX(false)
      if (this.isGrounded && this.stage === 'baby') {
        this.sprite.play('baby-run', true)
      }
    } else if (this.keys.right.isDown) {
      this.sprite.setVelocityX(this.speed)
      this.sprite.setFlipX(false)
      if (this.isGrounded && this.stage === 'baby') {
        this.sprite.play('baby-run', true)
      }
    } else {
      this.sprite.setVelocityX(0)
      if (this.isGrounded && this.stage === 'baby') {
        this.sprite.play('baby-idle', true)
      }
    }

    // Jump
    if (Phaser.Input.Keyboard.JustDown(this.keys.jump) && this.isGrounded) {
      this.sprite.setVelocityY(-this.jumpStrength)
      if (this.stage === 'baby') {
        this.sprite.play('baby-run', true)
      }
    }
  }
}
