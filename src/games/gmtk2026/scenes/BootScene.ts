import Phaser from 'phaser'

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
    this.load.image('adult', '/gmtk_2026/adult.png')
    this.load.image('adult-plus', '/gmtk_2026/adulter.png')
    this.load.image('middle-aged', '/gmtk_2026/middle_aged.png')
    this.load.image('middle-ager', '/gmtk_2026/middle_ager.png')
    this.load.image('elderly', '/gmtk_2026/elderly.png')
  }

  create() {
    this.createAnimations()
    this.scene.start('game-scene')
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
  }
}
