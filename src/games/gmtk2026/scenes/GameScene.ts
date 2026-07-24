import Phaser from 'phaser'
import { Player } from '../entities/Player'

export class GameScene extends Phaser.Scene {
  private player!: Player
  private ground!: Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body }

  constructor() {
    super('game-scene')
  }

  private music!: Phaser.Sound.WebAudioSound

  create() {
    const height = this.cameras.main.height

    // Spring music — Childhood stage
    this.music = this.sound.add('spring-music', { loop: true, volume: 0.5 }) as Phaser.Sound.WebAudioSound

    if (this.sound.locked) {
      // Browser autoplay policy: wait for first key press inside the game
      this.input.keyboard?.once('keydown', () => {
        this.sound.unlock()
        this.music.play()
      })
    } else {
      this.music.play()
    }

    // Ground
    this.ground = this.add.rectangle(0, height - 40, 5000, 80, 0x4ade80) as Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body }
    this.physics.add.existing(this.ground, true)

    // Player
    this.player = new Player(this, 200, height - 120)

    // Collisions
    this.physics.add.collider(this.player.sprite, this.ground)

    // Camera
    this.cameras.main.setBounds(0, 0, 5000, height)
    this.physics.world.setBounds(0, 0, 5000, height)
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1)
    this.cameras.main.setDeadzone(100, 50)
  }

  update() {
    this.player.update()
  }
}
