import Phaser from 'phaser'

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

  constructor(scene: Phaser.Scene, x: number, y: number) {
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

  update() {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body
    this.isGrounded = body.blocked.down || body.touching.down

    // Movement
    if (this.keys.left.isDown) {
      this.sprite.setVelocityX(-this.speed)
      this.sprite.setFlipX(false)
      if (this.isGrounded) {
        this.sprite.play('baby-run', true)
      }
    } else if (this.keys.right.isDown) {
      this.sprite.setVelocityX(this.speed)
      this.sprite.setFlipX(false)
      if (this.isGrounded) {
        this.sprite.play('baby-run', true)
      }
    } else {
      this.sprite.setVelocityX(0)
      if (this.isGrounded) {
        this.sprite.play('baby-idle', true)
      }
    }

    // Jump
    if (Phaser.Input.Keyboard.JustDown(this.keys.jump) && this.isGrounded) {
      this.sprite.setVelocityY(-this.jumpStrength)
      this.sprite.play('baby-run', true)
    }
  }
}
