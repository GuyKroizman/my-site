import Phaser from 'phaser'
import { LEVEL, TILE_MAP } from '../data/levels'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot-scene')
  }

  preload() {
    this.load.spritesheet('baby', '/gmtk_2026/baby.png', {
      frameWidth: 768,
      frameHeight: 448,
    })

    this.load.audio(
      'spring-music',
      '/gmtk_2026/Classicals.de-Vivaldi-The-Four-Seasons-01-John-Harrison-with-the-Wichita-State-University-Chamber-Players-Spring-Mvt-1-Allegro.mp3'
    )

    this.load.image('baby-girl', '/gmtk_2026/baby_girl.png')
    this.load.image('daughter-toddler', '/gmtk_2026/daugther_toddler.png')
    this.load.image('daughter-young-adult', '/gmtk_2026/daugther_young_adult.png')
    this.load.image('woman-adult', '/gmtk_2026/woman-adult.png')
    this.load.image('woman-adult-pregnant-half', '/gmtk_2026/woman-adult-pregnant-half.png')
    this.load.image('woman-adult-pregnant-full', '/gmtk_2026/woman-adult-pregnant-full.png')
    this.load.image('woman-middle-aged', '/gmtk_2026/woman_middle_aged.png')
    this.load.image('woman-elderly', '/gmtk_2026/woman-elderly.png')
    this.load.spritesheet('young-adult', '/gmtk_2026/young-adult.png', {
      frameWidth: 768,
      frameHeight: 448,
    })

    this.load.spritesheet('young-adult-jump', '/gmtk_2026/young-adult-jump-sheet.png', {
      frameWidth: 768,
      frameHeight: 448,
    })

    this.load.spritesheet('young-adult-attack', '/gmtk_2026/young-adult-attach-sheet.png', {
      frameWidth: 768,
      frameHeight: 448,
    })
    this.load.image('adult', '/gmtk_2026/adult.png')
    this.load.image('adult-plus', '/gmtk_2026/adulter.png')
    this.load.image('middle-aged', '/gmtk_2026/middle_aged.png')
    this.load.image('middle-ager', '/gmtk_2026/middle_ager.png')
    this.load.spritesheet('father-walk', '/gmtk_2026/father-walk-sheet.png', {
      frameWidth: 768,
      frameHeight: 448,
    })

    this.load.spritesheet('father-attack', '/gmtk_2026/father-attack-sheet.png', {
      frameWidth: 768,
      frameHeight: 448,
    })

    this.load.image('elderly', '/gmtk_2026/elderly.png')

    // Spring assets
    const spring = [
      'grass-1', 'grass-2', 'grass-3', 'grass-4',
      'rock-1', 'rock-2', 'rock-3', 'rock-4',
      'tree-blossom-1', 'tree-blossom-2', 'tree-blossom-3',
      'bush-flowers-1', 'bush-flowers-2', 'bush-flowers-3', 'bush-flowers-4',
      'flowers-1', 'flowers-2', 'flowers-3', 'flowers-4',
    ]
    spring.forEach((k) => this.load.image(k, `/gmtk_2026/spring-assets/${k}.png`))

    // Summer assets
    const summer = [
      'grass-gold-1', 'grass-gold-2', 'grass-gold-3', 'grass-gold-4',
      'rock-yellow-1', 'rock-yellow-2', 'rock-yellow-3', 'rock-yellow-4',
      'tree-green-1', 'tree-green-3',
      'wheat-bush-small', 'wheat-bush-medium', 'wheat-bush-large',
      'wheat-sheaf-small', 'wheat-sheaf-medium', 'wheat-sheaf-large',
      'corn-stalk-bottom-small',
      'corn-stalk-top-large',
      'barn',
    ]
    summer.forEach((k) => this.load.image(k, `/gmtk_2026/summer-assets/${k}.png`))

    // Autumn assets
    const autumn = [
      'grass-autumn-1', 'grass-autumn-3', 'grass-autumn-4',
      'rock-moss-1', 'rock-moss-2', 'rock-moss-4',
      'tree-autumn-small', 'tree-autumn-large', 'tree-autumn-bare',
      'bush-autumn-1', 'bush-autumn-2', 'grass-wheat-autumn',
      'leaf-pile', 'leaves-scattered',
    ]
    autumn.forEach((k) => this.load.image(k, `/gmtk_2026/autumn-assets/${k}.png`))

    // Winter assets
    const winter = [
      'grass-ice-1', 'grass-ice-2',
      'rock-snow-1',
      'tree-pine-small', 'tree-pine-medium', 'tree-pine-large',
      'branches-bare', 'bush-thorny-ice',
    ]
    winter.forEach((k) => this.load.image(k, `/gmtk_2026/winter-assets/extracted/${k}.png`))
  }

  create() {
    this.createPlaceholderTextures()
    this.createAnimations()
    const debug = (window as any).__GMTK2026_DEBUG || {}
    this.scene.start('game-scene', debug)
  }

  private createPlaceholderTextures() {
    const gfx = this.add.graphics()
    const seen = new Set<string>()

    Object.values(LEVEL.layers).forEach((layer) => {
      layer.forEach((row) => {
        for (const char of row) {
          if (char === ' ') continue
          const obj = TILE_MAP[char]
          if (!obj || seen.has(obj.type) || this.textures.exists(obj.type)) continue
          seen.add(obj.type)
          gfx.clear()
          gfx.fillStyle(0xff00ff, 1)
          gfx.fillRect(0, 0, 32, 32)
          gfx.generateTexture(obj.type, 32, 32)
        }
      })
    })
    gfx.destroy()
  }

  private createAnimations() {
    // New sheet: 21 frames, all a single crawl cycle — no separate idle pose
    this.anims.create({
      key: 'baby-idle',
      frames: this.anims.generateFrameNumbers('baby', { start: 0, end: 0 }),
      frameRate: 1,
      repeat: -1,
    })

    this.anims.create({
      key: 'baby-run',
      frames: this.anims.generateFrameNumbers('baby', { start: 0, end: 20 }),
      frameRate: 14,
      repeat: -1,
    })

    // Young adult: 21 frames, single run cycle — no separate idle pose
    this.anims.create({
      key: 'young-adult-idle',
      frames: this.anims.generateFrameNumbers('young-adult', { start: 0, end: 0 }),
      frameRate: 1,
      repeat: -1,
    })

    this.anims.create({
      key: 'young-adult-run',
      frames: this.anims.generateFrameNumbers('young-adult', { start: 0, end: 20 }),
      frameRate: 14,
      repeat: -1,
    })

    // Jump: 21 frames, play once (crouch → leap → fall → land)
    this.anims.create({
      key: 'young-adult-jump',
      frames: this.anims.generateFrameNumbers('young-adult-jump', { start: 0, end: 20 }),
      frameRate: 16,
      repeat: 0,
    })

    // Attack: 17 frames, right-facing, play once
    this.anims.create({
      key: 'young-adult-attack',
      frames: this.anims.generateFrameNumbers('young-adult-attack', { start: 0, end: 16 }),
      frameRate: 18,
      repeat: 0,
    })

    // Father walk: 21 frames, continuous walk cycle
    this.anims.create({
      key: 'father-walk',
      frames: this.anims.generateFrameNumbers('father-walk', { start: 0, end: 20 }),
      frameRate: 12,
      repeat: -1,
    })

    // Father attack: 29 frames (4 cols × 8 rows, last 3 cells empty), play once
    this.anims.create({
      key: 'father-attack',
      frames: this.anims.generateFrameNumbers('father-attack', { start: 0, end: 28 }),
      frameRate: 16,
      repeat: 0,
    })
  }
}
