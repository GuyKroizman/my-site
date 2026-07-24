import Phaser from 'phaser'

export type PlayerStage = 'baby' | 'young-adult' | 'adult' | 'adult-plus'

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
      this.sprite.stop()
      this.sprite.setTexture(textureKey)
      this.sprite.setScale(scale)
      this.sprite.refreshBody()
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
