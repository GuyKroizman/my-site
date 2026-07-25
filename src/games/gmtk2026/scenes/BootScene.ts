import Phaser from 'phaser'
import { LEVEL } from '../data/levels'

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
    this.load.image('elderly', '/gmtk_2026/elderly.png')
  }

  create() {
    this.createPlaceholderTextures()
    this.createAnimations()
    const debug = (window as any).__GMTK2026_DEBUG || {}
    this.scene.start('game-scene', debug)
  }

  private createPlaceholderTextures() {
    const gfx = this.add.graphics()
    const colors: Record<string, number> = {
      grass: 0x4ade80,
      sun: 0xfacc15,
      'tree-1': 0x166534,
      'tree-2': 0x15803d,
      rock: 0x78716c,
      'mountain-far': 0x64748b,
      cloud: 0xffffff,
    }
    const seen = new Set<string>()

    Object.values(LEVEL.layers).forEach((layer) => {
      layer.forEach((row) => {
        row.forEach((cell) => {
          cell?.forEach((obj) => {
            if (seen.has(obj.type) || this.textures.exists(obj.type)) return
            seen.add(obj.type)
            gfx.clear()
            gfx.fillStyle(colors[obj.type] ?? 0xff00ff, 1)
            gfx.fillRect(0, 0, 32, 32)
            gfx.generateTexture(obj.type, 32, 32)
          })
        })
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
  }
}
