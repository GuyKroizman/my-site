import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import * as Phaser from 'phaser'

class RogueGameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle
  private walls: Phaser.GameObjects.Rectangle[] = []
  private monsters: Phaser.GameObjects.Rectangle[] = []
  private items: Phaser.GameObjects.Circle[] = []
  private keys: { [key: string]: boolean } = {}
  private playerHealth: number = 100
  private playerLevel: number = 1
  private playerExp: number = 0
  private statusText!: Phaser.GameObjects.Text
  private dungeonLevel: number = 1
  
  constructor() {
    super({ key: 'RogueGame' })
  }

  create() {
    // Generate dungeon
    this.generateDungeon()
    
    // Create player
    this.player = this.add.rectangle(100, 100, 20, 20, 0x00FF00)
    
    // Create some monsters
    this.spawnMonsters()
    
    // Create some items
    this.spawnItems()
    
    // UI
    this.statusText = this.add.text(16, 16, this.getStatusText(), {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 8, y: 4 }
    })
    
    // Input handling
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      this.keys[event.code] = true
      this.handleMovement(event.code)
    })
    
    this.input.keyboard?.on('keyup', (event: KeyboardEvent) => {
      this.keys[event.code] = false
    })
  }

  generateDungeon() {
    const { width, height } = this.scale
    
    // Create outer walls
    for (let x = 0; x < width; x += 20) {
      this.walls.push(this.add.rectangle(x, 0, 20, 20, 0x8B4513))
      this.walls.push(this.add.rectangle(x, height - 20, 20, 20, 0x8B4513))
    }
    for (let y = 0; y < height; y += 20) {
      this.walls.push(this.add.rectangle(0, y, 20, 20, 0x8B4513))
      this.walls.push(this.add.rectangle(width - 20, y, 20, 20, 0x8B4513))
    }
    
    // Create some random interior walls
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(Math.random() * (width / 20)) * 20
      const y = Math.floor(Math.random() * (height / 20)) * 20
      if (x > 80 && y > 80) { // Don't block starting area
        this.walls.push(this.add.rectangle(x, y, 20, 20, 0x8B4513))
      }
    }
  }

  spawnMonsters() {
    const numMonsters = 5 + this.dungeonLevel
    for (let i = 0; i < numMonsters; i++) {
      let x, y
      do {
        x = Math.floor(Math.random() * (this.scale.width / 20)) * 20 + 10
        y = Math.floor(Math.random() * (this.scale.height / 20)) * 20 + 10
      } while (this.isPositionBlocked(x, y) || (x < 150 && y < 150))
      
      const monster = this.add.rectangle(x, y, 18, 18, 0xFF0000)
      this.monsters.push(monster)
    }
  }

  spawnItems() {
    const numItems = 3 + Math.floor(this.dungeonLevel / 2)
    for (let i = 0; i < numItems; i++) {
      let x, y
      do {
        x = Math.floor(Math.random() * (this.scale.width / 20)) * 20 + 10
        y = Math.floor(Math.random() * (this.scale.height / 20)) * 20 + 10
      } while (this.isPositionBlocked(x, y))
      
      const item = this.add.circle(x, y, 6, 0xFFD700)
      this.items.push(item)
    }
  }

  handleMovement(keyCode: string) {
    let newX = this.player.x
    let newY = this.player.y
    
    switch (keyCode) {
      case 'KeyW':
      case 'ArrowUp':
        newY -= 20
        break
      case 'KeyS':
      case 'ArrowDown':
        newY += 20
        break
      case 'KeyA':
      case 'ArrowLeft':
        newX -= 20
        break
      case 'KeyD':
      case 'ArrowRight':
        newX += 20
        break
      default:
        return
    }
    
    // Check for wall collision
    if (!this.isPositionBlocked(newX, newY)) {
      this.player.setPosition(newX, newY)
      
      // Check for monster combat
      this.checkMonsterCombat(newX, newY)
      
      // Check for item pickup
      this.checkItemPickup(newX, newY)
    }
  }

  isPositionBlocked(x: number, y: number): boolean {
    return this.walls.some(wall => 
      Math.abs(wall.x - x) < 20 && Math.abs(wall.y - y) < 20
    )
  }

  checkMonsterCombat(playerX: number, playerY: number) {
    this.monsters.forEach((monster, index) => {
      if (Math.abs(monster.x - playerX) < 20 && Math.abs(monster.y - playerY) < 20) {
        // Combat!
        const damage = Math.floor(Math.random() * 20) + 10
        const playerDamage = this.playerLevel * 15 + Math.floor(Math.random() * 10)
        
        // Player takes damage
        this.playerHealth -= damage
        
        // Monster defeated
        monster.destroy()
        this.monsters.splice(index, 1)
        
        // Player gains exp
        this.playerExp += 25
        if (this.playerExp >= this.playerLevel * 100) {
          this.playerLevel++
          this.playerExp = 0
          this.playerHealth = Math.min(100, this.playerHealth + 20)
        }
        
        this.updateStatus()
        
        // Check if player died
        if (this.playerHealth <= 0) {
          this.gameOver()
        }
        
        // Check if all monsters defeated
        if (this.monsters.length === 0) {
          this.nextLevel()
        }
      }
    })
  }

  checkItemPickup(playerX: number, playerY: number) {
    this.items.forEach((item, index) => {
      if (Math.abs(item.x - playerX) < 15 && Math.abs(item.y - playerY) < 15) {
        // Pickup item
        item.destroy()
        this.items.splice(index, 1)
        
        // Heal player
        this.playerHealth = Math.min(100, this.playerHealth + 20)
        this.updateStatus()
      }
    })
  }

  getStatusText(): string {
    return `Level: ${this.playerLevel} | Health: ${this.playerHealth} | XP: ${this.playerExp}/${this.playerLevel * 100} | Dungeon: ${this.dungeonLevel}`
  }

  updateStatus() {
    this.statusText.setText(this.getStatusText())
  }

  nextLevel() {
    this.dungeonLevel++
    
    // Clear current level
    this.walls.forEach(wall => wall.destroy())
    this.monsters.forEach(monster => monster.destroy())
    this.items.forEach(item => item.destroy())
    
    this.walls = []
    this.monsters = []
    this.items = []
    
    // Generate new level
    this.generateDungeon()
    this.spawnMonsters()
    this.spawnItems()
    
    // Reset player position
    this.player.setPosition(100, 100)
    
    this.updateStatus()
    
    // Show level up message
    const levelText = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      `Dungeon Level ${this.dungeonLevel}!`,
      {
        fontSize: '32px',
        color: '#ffff00',
        align: 'center'
      }
    ).setOrigin(0.5)
    
    this.time.delayedCall(2000, () => {
      levelText.destroy()
    })
  }

  gameOver() {
    const gameOverText = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      `Game Over!\nYou reached dungeon level ${this.dungeonLevel}\nPress R to restart`,
      {
        fontSize: '24px',
        color: '#ff0000',
        align: 'center'
      }
    ).setOrigin(0.5)
    
    this.input.keyboard?.on('keydown-R', () => {
      this.scene.restart()
    })
  }
}

export default function Rogue0() {
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (!gameRef.current) {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: 'phaser-game',
        backgroundColor: '#1a1a1a',
        scene: RogueGameScene,
        pixelArt: true
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
          <h1 className="text-4xl font-bold">Rogue0 - Dungeon Adventure</h1>
          <Link 
            to="/" 
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition-colors"
          >
            ← Back to Menu
          </Link>
        </div>
        
        <div className="flex justify-center">
          <div id="phaser-game" className="border-2 border-gray-600 rounded-lg"></div>
        </div>
        
        <div className="mt-8 text-center text-gray-300">
          <p>Use WASD or arrow keys to move through the dungeon!</p>
          <p>🟢 You | 🟤 Walls | 🔴 Monsters | 🟡 Health Potions</p>
          <p>Fight monsters to gain experience and reach the next level!</p>
        </div>
      </div>
    </div>
  )
}
