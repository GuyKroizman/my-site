import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import * as Phaser from 'phaser'

class HootGameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container
  private bullets: Phaser.GameObjects.Shape[] = []
  private enemies: Phaser.GameObjects.Rectangle[] = []
  private keys: { [key: string]: boolean } = {}
  private lastShootTime: number = 0
  private gameOver: boolean = false
  private playerHealth: number = 100
  private healthText!: Phaser.GameObjects.Text
  private gameOverText!: Phaser.GameObjects.Text
  private instructionsText!: Phaser.GameObjects.Text
  
  constructor() {
    super({ key: 'HootGame' })
  }

  create() {
    // Game boundaries
    const { width, height } = this.scale
    
    // Create player (owl-like character)
    this.player = this.add.container(width / 2, height / 2)
    
    // Player body (circle)
    const body = this.add.circle(0, 0, 20, 0x8B4513)
    // Eyes
    const leftEye = this.add.circle(-8, -8, 4, 0xFFFFFF)
    const rightEye = this.add.circle(8, -8, 4, 0xFFFFFF)
    const leftPupil = this.add.circle(-8, -8, 2, 0x000000)
    const rightPupil = this.add.circle(8, -8, 2, 0x000000)
    
    this.player.add([body, leftEye, rightEye, leftPupil, rightPupil])
    
    // Create some initial enemies
    this.spawnEnemies()
    
    // UI
    this.healthText = this.add.text(16, 16, `Health: ${this.playerHealth}`, {
      fontSize: '20px',
      color: '#ffffff'
    })
    
    this.instructionsText = this.add.text(16, height - 100, 
      'WASD: Move\nSPACE: Shoot\nAvoid red enemies!', {
      fontSize: '16px',
      color: '#ffffff'
    })
    
    // Input handling
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      this.keys[event.code] = true
    })
    
    this.input.keyboard?.on('keyup', (event: KeyboardEvent) => {
      this.keys[event.code] = false
    })
  }

  update(time: number) {
    if (this.gameOver) return
    
    // Player movement
    const speed = 5
    let deltaX = 0
    let deltaY = 0
    
    if (this.keys['KeyW'] || this.keys['ArrowUp']) deltaY -= speed
    if (this.keys['KeyS'] || this.keys['ArrowDown']) deltaY += speed
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) deltaX -= speed
    if (this.keys['KeyD'] || this.keys['ArrowRight']) deltaX += speed
    
    // Keep player in bounds
    const newX = Math.max(30, Math.min(this.scale.width - 30, this.player.x + deltaX))
    const newY = Math.max(30, Math.min(this.scale.height - 30, this.player.y + deltaY))
    this.player.setPosition(newX, newY)
    
    // Shooting
    if (this.keys['Space'] && time - this.lastShootTime > 250) {
      this.shoot()
      this.lastShootTime = time
    }
    
    // Update bullets
    this.bullets.forEach((bullet, index) => {
      bullet.y -= 8
      if (bullet.y < 0) {
        bullet.destroy()
        this.bullets.splice(index, 1)
      }
    })
    
    // Update enemies
    this.enemies.forEach(enemy => {
      enemy.y += 2
      if (enemy.y > this.scale.height) {
        enemy.y = -20
        enemy.x = Math.random() * this.scale.width
      }
    })
    
    // Check collisions
    this.checkCollisions()
    
    // Spawn more enemies occasionally
    if (Math.random() < 0.01) {
      this.spawnEnemies()
    }
  }

  shoot() {
    const bullet = this.add.circle(this.player.x, this.player.y - 25, 3, 0x00FF00)
    this.bullets.push(bullet)
  }

  spawnEnemies() {
    const numEnemies = Math.min(3, Math.floor(Math.random() * 3) + 1)
    for (let i = 0; i < numEnemies; i++) {
      const enemy = this.add.rectangle(
        Math.random() * this.scale.width,
        -20,
        20,
        20,
        0xFF0000
      )
      this.enemies.push(enemy)
    }
  }

  checkCollisions() {
    // Bullet-enemy collisions
    this.bullets.forEach((bullet, bulletIndex) => {
      this.enemies.forEach((enemy, enemyIndex) => {
        const distance = Phaser.Math.Distance.Between(
          bullet.x, bullet.y, enemy.x, enemy.y
        )
        if (distance < 15) {
          bullet.destroy()
          enemy.destroy()
          this.bullets.splice(bulletIndex, 1)
          this.enemies.splice(enemyIndex, 1)
        }
      })
    })
    
    // Player-enemy collisions
    this.enemies.forEach((enemy, index) => {
      const distance = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, enemy.x, enemy.y
      )
      if (distance < 30) {
        enemy.destroy()
        this.enemies.splice(index, 1)
        this.playerHealth -= 20
        this.healthText.setText(`Health: ${this.playerHealth}`)
        
        if (this.playerHealth <= 0) {
          this.endGame()
        }
      }
    })
  }

  endGame() {
    this.gameOver = true
    this.gameOverText = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      'Game Over!\nPress R to restart',
      {
        fontSize: '32px',
        color: '#ffffff',
        align: 'center'
      }
    ).setOrigin(0.5)
    
    this.input.keyboard?.on('keydown-R', () => {
      this.scene.restart()
    })
  }
}

export default function Hoot() {
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (!gameRef.current) {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: 'phaser-game',
        backgroundColor: '#2d2d2d',
        scene: HootGameScene,
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
          }
        }
      }

      gameRef.current = new Phaser.Game(config)
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Hoot - Shooting Game</h1>
          <Link 
            to="/" 
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
          >
            ← Back to Menu
          </Link>
        </div>
        
        <div className="flex justify-center">
          <div id="phaser-game" className="border-2 border-gray-600 rounded-lg"></div>
        </div>
        
        <div className="mt-8 text-center text-gray-300">
          <p>Use WASD or arrow keys to move, SPACE to shoot!</p>
          <p>Avoid the red enemies and shoot them down!</p>
        </div>
      </div>
    </div>
  )
}
