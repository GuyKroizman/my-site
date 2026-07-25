import Phaser from 'phaser'
import { Player, type PlayerStage } from '../entities/Player'
import { LEVEL, TILE_MAP } from '../data/levels'
import { Parent } from '../entities/Parent'
import { Enemy } from '../entities/Enemy'
import { Woman } from '../entities/Woman'
import { Baby } from '../entities/Baby'

export class GameScene extends Phaser.Scene {
  private player!: Player
  private ground!: Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body }
  private music!: Phaser.Sound.WebAudioSound
  private parents: Parent[] = []
  private enemies: Enemy[] = []
  private departureTriggered = false
  private adultTransitionTriggered = false
  private adultPlusTransitionTriggered = false
  private middleAgedTransitionTriggered = false
  private middleAgerTransitionTriggered = false
  private elderlyTransitionTriggered = false
  private distanceText!: Phaser.GameObjects.Text
  private healthBarBg!: Phaser.GameObjects.Graphics
  private healthBarFill!: Phaser.GameObjects.Graphics
  private healthBarGhost!: Phaser.GameObjects.Graphics
  private healthText!: Phaser.GameObjects.Text
  private ghostHealth = 100
  private woman: Woman | null = null
  private baby: Baby | null = null
  private womanMet = false
  private pregnancyStage = 0
  private pregnancyStartX = 0
  private pregnancyDistanceForStage = 300
  private babySpawned = false
  private toddlerTransitionTriggered = false
  private daughterYoungAdultTransitionTriggered = false
  private daughterDeparted = false
  private womanHealthBar!: Phaser.GameObjects.Graphics
  private babyHealthBar!: Phaser.GameObjects.Graphics
  private womanLabel!: Phaser.GameObjects.Text
  private babyLabel!: Phaser.GameObjects.Text

  constructor() {
    super('game-scene')
  }

  create() {
    const height = this.cameras.main.height
    const debugData = (this.scene.settings.data as {
      startStage?: PlayerStage
      startX?: number
    }) || {}
    const startStage = debugData.startStage
    const startX = debugData.startX

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

    // Ground — spans full world width
    this.ground = this.add.rectangle(5000, height - 40, 10000, 80, 0x4ade80) as Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body }
    this.physics.add.existing(this.ground, true)

    // Player
    this.player = new Player(this, 200, height - 120)
    this.player.sprite.setDepth(10)

    // Render level decoration layers
    this.renderLevel()

    // Draw the full-world sky gradient
    this.drawSkyGradient()

    if (startStage) {
      this.player.setStage(startStage)

      const stages: PlayerStage[] = [
        'baby',
        'young-adult',
        'adult',
        'adult-plus',
        'middle-aged',
        'middle-ager',
        'elderly',
      ]
      const idx = stages.indexOf(startStage)
      if (idx >= 1) this.departureTriggered = true
      if (idx >= 2) this.adultTransitionTriggered = true
      if (idx >= 3) this.adultPlusTransitionTriggered = true
      if (idx >= 4) this.middleAgedTransitionTriggered = true
      if (idx >= 5) this.middleAgerTransitionTriggered = true
      if (idx >= 6) this.elderlyTransitionTriggered = true

      if (startX !== undefined && !isNaN(startX)) {
        this.player.sprite.x = startX
        this.cameras.main.scrollX = startX - this.cameras.main.width / 2
      }
    }

    // Parents flank the baby
    const mom = new Parent(this, 120, height - 120, 0xe91e63, false)
    const dad = new Parent(this, 280, height - 120, 0x2196f3, true, 'father-walk')
    this.parents.push(mom, dad)
    if (startStage && startStage !== 'baby') {
      mom.depart()
      dad.depart()
    }

    // Shadowy enemies ahead
    this.spawnEnemies()

    // Woman narrative event at X ≈ 3,000 (adulthood)
    this.woman = new Woman(this, 3000, height - 80) // feet on the ground

    // Collisions
    this.physics.add.collider(this.player.sprite, this.ground)

    // Camera
    this.cameras.main.setBounds(0, 0, 10000, height)
    this.physics.world.setBounds(0, 0, 10000, height)
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1)
    this.cameras.main.setDeadzone(100, 50)

    // Distance HUD
    this.distanceText = this.add.text(10, 10, 'Distance: 0', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#00000088',
      padding: { x: 6, y: 3 },
    })
    this.distanceText.setScrollFactor(0)

    // Health bar — Dead Cells style
    this.createHealthBar()

    // Companion health bars (hidden by default)
    this.womanHealthBar = this.add.graphics()
    this.womanHealthBar.setScrollFactor(0)
    this.womanHealthBar.setDepth(91)
    this.womanHealthBar.setAlpha(0)

    this.babyHealthBar = this.add.graphics()
    this.babyHealthBar.setScrollFactor(0)
    this.babyHealthBar.setDepth(91)
    this.babyHealthBar.setAlpha(0)

    this.womanLabel = this.add.text(0, 0, 'MOM', {
      fontSize: '10px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    this.womanLabel.setOrigin(1, 0.5)
    this.womanLabel.setScrollFactor(0)
    this.womanLabel.setDepth(92)
    this.womanLabel.setAlpha(0)

    this.babyLabel = this.add.text(0, 0, 'BABY', {
      fontSize: '10px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    this.babyLabel.setOrigin(1, 0.5)
    this.babyLabel.setScrollFactor(0)
    this.babyLabel.setDepth(92)
    this.babyLabel.setAlpha(0)

    // Debug start: spawn the woman next to the player for adult+ stages
    if (startStage && ['adult', 'adult-plus', 'middle-aged', 'middle-ager', 'elderly'].includes(startStage)) {
      this.woman.container.destroy(true)
      this.woman = new Woman(this, this.player.sprite.x - 120, height - 80)
      this.woman.startFollowing()
      this.womanMet = true
      this.pregnancyStartX = this.player.sprite.x
      if (['middle-aged', 'middle-ager', 'elderly'].includes(startStage)) {
        this.woman.ageUpToMiddleAged()
      }
      if (startStage === 'elderly') {
        this.woman.ageUpToElderly()
      }
      this.womanHealthBar.setAlpha(1)
      this.womanLabel.setAlpha(1)
    }
  }

  private createHealthBar() {
    this.healthBarBg = this.add.graphics()
    this.healthBarBg.setScrollFactor(0)
    this.healthBarBg.setDepth(90)

    this.healthBarGhost = this.add.graphics()
    this.healthBarGhost.setScrollFactor(0)
    this.healthBarGhost.setDepth(91)

    this.healthBarFill = this.add.graphics()
    this.healthBarFill.setScrollFactor(0)
    this.healthBarFill.setDepth(92)

    this.healthText = this.add.text(this.cameras.main.width / 2, 16 + 12, '100', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    this.healthText.setOrigin(0.5)
    this.healthText.setScrollFactor(0)
    this.healthText.setDepth(93)

    this.drawHealthBar()
  }

  private drawCompanionHealthBar(
    graphics: Phaser.GameObjects.Graphics,
    labelText: Phaser.GameObjects.Text,
    health: number,
    maxHealth: number,
    x: number,
    y: number
  ) {
    const width = 180
    const height = 16
    const radius = 4
    const pct = Math.max(0, health / maxHealth)

    graphics.clear()

    // Background
    graphics.fillStyle(0x1a1a2e, 0.85)
    graphics.fillRoundedRect(x, y, width, height, radius)
    graphics.lineStyle(1, 0x444466, 1)
    graphics.strokeRoundedRect(x, y, width, height, radius)

    // Fill
    let fillColor = 0x22c55e
    if (pct <= 0.3) fillColor = 0xef4444
    else if (pct <= 0.6) fillColor = 0xeab308

    graphics.fillStyle(fillColor, 0.9)
    graphics.fillRoundedRect(x + 2, y + 2, (width - 4) * pct, height - 4, radius - 2)

    // Position label
    labelText.setPosition(x - 5, y + height / 2)
  }

  private drawHealthBar() {
    const width = 320
    const height = 24
    const x = this.cameras.main.width / 2 - width / 2
    const y = 16
    const radius = 6

    const hp = this.player.health
    const pct = Math.max(0, hp / 100)
    const ghostPct = Math.max(0, this.ghostHealth / 100)

    // Background
    this.healthBarBg.clear()
    this.healthBarBg.fillStyle(0x1a1a2e, 0.9)
    this.healthBarBg.fillRoundedRect(x, y, width, height, radius)
    this.healthBarBg.lineStyle(2, 0x444466, 1)
    this.healthBarBg.strokeRoundedRect(x, y, width, height, radius)

    // Ghost bar (recent damage, lags behind)
    if (ghostPct > pct) {
      this.healthBarGhost.clear()
      this.healthBarGhost.fillStyle(0xffffff, 0.35)
      this.healthBarGhost.fillRoundedRect(x + 2, y + 2, (width - 4) * ghostPct, height - 4, radius - 2)
    }

    // Health fill with color based on percentage
    this.healthBarFill.clear()
    let fillColor: number
    if (pct > 0.6) {
      fillColor = 0x22c55e // green
    } else if (pct > 0.3) {
      fillColor = 0xeab308 // yellow
    } else {
      fillColor = 0xef4444 // red
    }
    this.healthBarFill.fillStyle(fillColor, 0.95)
    this.healthBarFill.fillRoundedRect(x + 2, y + 2, (width - 4) * pct, height - 4, radius - 2)

    // Inner glow highlight
    this.healthBarFill.fillStyle(0xffffff, 0.15)
    this.healthBarFill.fillRoundedRect(x + 2, y + 2, (width - 4) * pct, (height - 4) / 2, radius - 2)

    // Text
    this.healthText.setText(`${Math.max(0, Math.ceil(hp))}`)
    this.healthText.setColor(pct > 0.3 ? '#ffffff' : '#ffcccc')
  }

  private showMeetingHeart() {
    if (!this.woman) return

    const midX = (this.player.sprite.x + this.woman.x) / 2
    const midY = Math.min(this.player.sprite.y, this.woman.y) - 520

    const heart = this.add.text(midX, midY, '\u2665', {
      fontSize: '48px',
      color: '#ef4444',
    })
    heart.setOrigin(0.5)
    heart.setScale(0)
    heart.setDepth(95)

    // Grow in
    this.tweens.add({
      targets: heart,
      scale: 1.4,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Throb
        this.tweens.add({
          targets: heart,
          scale: 1.1,
          duration: 220,
          yoyo: true,
          repeat: 3,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            // Disappear (float up + fade + shrink)
            this.tweens.add({
              targets: heart,
              scale: 0,
              alpha: 0,
              y: midY - 40,
              duration: 400,
              ease: 'Sine.easeIn',
              onComplete: () => heart.destroy(),
            })
          },
        })
      },
    })
  }

  private spawnEnemies() {
    const height = this.cameras.main.height
    const positions = [
      { x: 480, y: height - 100 },
      { x: 750, y: height - 110 },
      { x: 1600, y: height - 100 },
      { x: 2200, y: height - 110 },
      { x: 2800, y: height - 100 },
      { x: 3500, y: height - 100 },
      { x: 4200, y: height - 110 },
      { x: 5000, y: height - 100 },
      { x: 5800, y: height - 110 },
      { x: 6500, y: height - 100 },
      { x: 7200, y: height - 110 },
      { x: 8000, y: height - 100 },
      { x: 8800, y: height - 110 },
      { x: 9500, y: height - 100 },
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
      this.player.ageUp()
    }

    // Adult transition at X ≈ 2,500
    if (!this.adultTransitionTriggered && px > 2500) {
      this.adultTransitionTriggered = true
      this.player.ageUpToAdult()
    }

    // Adult-plus transition at X ≈ 4,000
    if (!this.adultPlusTransitionTriggered && px > 4000) {
      this.adultPlusTransitionTriggered = true
      this.player.ageUpToAdultPlus()
    }

    // Middle-aged transition at X ≈ 5,500
    if (!this.middleAgedTransitionTriggered && px > 5500) {
      this.middleAgedTransitionTriggered = true
      this.player.ageUpToMiddleAged()
      this.woman?.ageUpToMiddleAged()
    }

    // Daughter leaves home soon after the parents become middle-aged (X ≈ 5,900)
    if (!this.daughterDeparted && this.middleAgedTransitionTriggered && this.baby && px > 5900) {
      this.daughterDeparted = true
      this.baby.depart()
      this.babyHealthBar.setAlpha(0)
      this.babyLabel.setAlpha(0)
    }

    // Middle-ager transition at X ≈ 7,000
    if (!this.middleAgerTransitionTriggered && px > 7000) {
      this.middleAgerTransitionTriggered = true
      this.player.ageUpToMiddleAger()
    }

    // Elderly transition at X ≈ 8,500
    if (!this.elderlyTransitionTriggered && px > 8500) {
      this.elderlyTransitionTriggered = true
      this.player.ageUpToElderly()
      this.woman?.ageUpToElderly()
    }

    // Update parents
    const liveEnemies = this.enemies.filter((e) => !e.dead)
    this.parents[0]?.update(px, py, -80, -10, liveEnemies, time)
    this.parents[1]?.update(px, py, 80, -10, liveEnemies, time)

    // Update enemies
    for (const enemy of this.enemies) {
      enemy.update(px, py)
    }

    // Update distance HUD
    this.distanceText.setText(`Distance: ${Math.floor(px)}`)

    // Woman narrative event
    if (this.woman && !this.womanMet && px > 2900) {
      this.womanMet = true
      this.woman.startFollowing()
      this.pregnancyStartX = px
      this.womanHealthBar.setAlpha(1)
      this.womanLabel.setAlpha(1)
      this.showMeetingHeart()
    }

    if (this.woman && this.womanMet) {
      this.woman.update(px, this.player.getFeetY())

      // Pregnancy progression
      const togetherDistance = px - this.pregnancyStartX
      if (togetherDistance > this.pregnancyDistanceForStage && this.pregnancyStage === 0) {
        this.pregnancyStage = 1
        this.woman.setPregnancyStage(1)
      } else if (togetherDistance > this.pregnancyDistanceForStage * 2 && this.pregnancyStage === 1) {
        this.pregnancyStage = 2
        this.woman.setPregnancyStage(2)
      } else if (togetherDistance > this.pregnancyDistanceForStage * 3 && !this.babySpawned) {
        // Birth!
        this.babySpawned = true
        this.baby = new Baby(this, this.woman.x, this.woman.y)
        this.woman.setPregnancyStage(0)
        this.babyHealthBar.setAlpha(1)
        this.babyLabel.setAlpha(1)
      }

      // Draw woman health bar
      this.drawCompanionHealthBar(
        this.womanHealthBar,
        this.womanLabel,
        this.woman.health,
        100,
        this.cameras.main.width / 2 - 160,
        48
      )

      // Update baby
      if (this.baby) {
        this.baby.update(this.woman.x, this.woman.y)

        // Toddler transition one stage after birth
        if (!this.toddlerTransitionTriggered && togetherDistance > this.pregnancyDistanceForStage * 4) {
          this.toddlerTransitionTriggered = true
          this.baby.ageUpToToddler()
        }

        // Young adult transition another stage later
        if (
          !this.daughterYoungAdultTransitionTriggered &&
          togetherDistance > this.pregnancyDistanceForStage * 5
        ) {
          this.daughterYoungAdultTransitionTriggered = true
          this.baby.ageUpToYoungAdult()
        }

        this.drawCompanionHealthBar(
          this.babyHealthBar,
          this.babyLabel,
          this.baby.health,
          50,
          this.cameras.main.width / 2 - 160,
          70
        )
      }
    }

    // Ghost health slowly catches up
    if (this.ghostHealth > this.player.health) {
      this.ghostHealth = Math.max(this.player.health, this.ghostHealth - 0.5)
    }

    // Redraw health bar
    this.drawHealthBar()

    // Enemy-player contact damage
    for (const enemy of this.enemies) {
      if (enemy.dead) continue
      const dx = enemy.x - px
      const dy = enemy.y - py
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 40) {
        if (this.player.takeDamage(10)) {
          this.woman?.flashRed()
          this.baby?.flashRed()
        }
      }
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

    // Player melee attack vs enemies
    const attackBox = this.player.getAttackHitbox()
    if (attackBox) {
      for (const enemy of this.enemies) {
        if (enemy.dead) continue
        const dx = enemy.x - attackBox.x
        const dy = enemy.y - attackBox.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < attackBox.radius + 25) {
          enemy.takeDamage()
        }
      }
    }

    // Clean up dead enemies
    this.enemies = this.enemies.filter((e) => !e.dead)
  }

  private renderLevel() {
    const groundTop = this.ground.y - this.ground.height / 2

    const layerDepths: Record<string, number> = {
      sky: -100,
      background: -50,
      ground: 0,
      foreground: 50,
    }
    const layerScrollFactors: Record<string, number> = {
      sky: 0.1,
      background: 0.5,
      ground: 1,
      foreground: 1,
    }

    Object.entries(LEVEL.layers).forEach(([layerName, layer]) => {
      const depth = layerDepths[layerName] ?? 0
      const scrollFactor = layerScrollFactors[layerName] ?? 1

      for (let r = 0; r < layer.length; r++) {
        const row = layer[r]
        for (let c = 0; c < row.length; c++) {
          const char = row[c]
          if (char === ' ') continue

          const obj = TILE_MAP[char]
          if (!obj) continue

          const wx = c * LEVEL.cellSize + LEVEL.cellSize / 2
          const wy = groundTop - (r * LEVEL.cellSize + LEVEL.cellSize / 2)

          if (!this.textures.exists(obj.type)) continue

          const img = this.add.image(
            wx + (obj.offsetX ?? 0),
            wy + (obj.offsetY ?? 0),
            obj.type
          )
          img.setDepth(depth)
          img.setScrollFactor(scrollFactor)
          if (obj.scale !== undefined) img.setScale(obj.scale)
          if (obj.rotation !== undefined) img.setAngle(obj.rotation)
          if (obj.flipX) img.setFlipX(true)
          if (obj.tint !== undefined) img.setTint(obj.tint)
        }
      }
    })
  }

  private drawSkyGradient() {
    const gfx = this.add.graphics()
    gfx.setDepth(-200)

    const groundTop = this.ground.y - this.ground.height / 2
    const topY = -2000
    const bottomY = groundTop + 300
    const stripH = bottomY - topY

    // Season colors: top (sky) → bottom (horizon/ground)
    const zones = [
      { start: 0, end: 39, top: 0x87ceeb, bottom: 0xe0f7fa },   // spring — fresh blue → cyan
      { start: 40, end: 78, top: 0x1e90ff, bottom: 0xffd700 },  // summer — deep blue → gold
      { start: 79, end: 117, top: 0xff4500, bottom: 0x8b4513 }, // autumn — orange-red → brown
      { start: 118, end: 156, top: 0xb0c4de, bottom: 0xf0f8ff },// winter — steel blue → white
    ]

    const lerpColor = (a: number, b: number, t: number): number => {
      const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
      const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
      return (
        (Math.round(ar + (br - ar) * t) << 16) |
        (Math.round(ag + (bg - ag) * t) << 8) |
        Math.round(ab + (bb - ab) * t)
      )
    }

    for (let c = 0; c < 157; c++) {
      let topColor = zones[0].top
      let bottomColor = zones[0].bottom

      for (let z = 0; z < zones.length; z++) {
        const zone = zones[z]
        if (c >= zone.start && c <= zone.end) {
          topColor = zone.top
          bottomColor = zone.bottom
          // Smooth 4-column blend at the transition to the next season
          if (z < zones.length - 1 && c >= zone.end - 3) {
            const next = zones[z + 1]
            const t = (c - (zone.end - 3)) / 4
            topColor = lerpColor(zone.top, next.top, t)
            bottomColor = lerpColor(zone.bottom, next.bottom, t)
          }
          break
        }
      }

      const x = c * 64
      gfx.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1)
      gfx.fillRect(x, topY, 64, stripH)
    }
  }
}
