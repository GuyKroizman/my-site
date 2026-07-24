import Phaser from 'phaser'
import { Player } from '../entities/Player'
import { Parent } from '../entities/Parent'
import { Enemy } from '../entities/Enemy'

export class GameScene extends Phaser.Scene {
  private player!: Player
  private ground!: Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body }
  private music!: Phaser.Sound.WebAudioSound
  private parents: Parent[] = []
  private enemies: Enemy[] = []
  private departureTriggered = false

  constructor() {
    super('game-scene')
  }

  create() {
    const height = this.cameras.main.height

    // Spring music — Childhood stage
    this.music = this.sound.add('spring-music', { loop: true, volume: 0.5 }) as Phaser.Sound.WebAudioSound

    if (this.sound.locked) {
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

    // Parents flank the baby
    const mom = new Parent(this, 120, height - 120, 0xe91e63, false)
    const dad = new Parent(this, 280, height - 120, 0x2196f3, true)
    this.parents.push(mom, dad)

    // Shadowy enemies ahead
    this.spawnEnemies()

    // Collisions
    this.physics.add.collider(this.player.sprite, this.ground)

    // Camera
    this.cameras.main.setBounds(0, 0, 5000, height)
    this.physics.world.setBounds(0, 0, 5000, height)
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1)
    this.cameras.main.setDeadzone(100, 50)
  }

  private spawnEnemies() {
    const height = this.cameras.main.height
    const positions = [
      { x: 480, y: height - 100 },
      { x: 750, y: height - 110 },
      { x: 1600, y: height - 100 },
      { x: 2200, y: height - 110 },
      { x: 2800, y: height - 100 },
    ]
    for (const pos of positions) {
      this.enemies.push(new Enemy(this, pos.x, pos.y))
    }
  }

  update() {
    this.player.update()

    const time = this.time.now
    const px = this.player.sprite.x
    const py = this.player.sprite.y

    // Departure event at X ≈ 1,200
    if (!this.departureTriggered && px > 1200) {
      this.departureTriggered = true
      this.parents.forEach((p) => p.depart())
    }

    // Update parents
    const enemyPositions = this.enemies.filter((e) => !e.dead).map((e) => ({ x: e.x, y: e.y }))
    this.parents[0]?.update(px, py, -80, -10, enemyPositions, time)
    this.parents[1]?.update(px, py, 80, -10, enemyPositions, time)

    // Update enemies
    for (const enemy of this.enemies) {
      enemy.update(px, py)
    }

    // Projectile-enemy collision
    for (const parent of this.parents) {
      for (const projectile of parent.getProjectiles()) {
        for (const enemy of this.enemies) {
          if (enemy.dead) continue
          const dx = projectile.x - enemy.x
          const dy = projectile.y - enemy.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 30) {
            if (enemy.takeDamage()) {
              // Enemy died — remove from array later
            }
            projectile.destroy()
            const idx = parent.getProjectiles().indexOf(projectile)
            if (idx > -1) parent.getProjectiles().splice(idx, 1)
            break
          }
        }
      }
    }

    // Clean up dead enemies
    this.enemies = this.enemies.filter((e) => !e.dead)
  }
}
