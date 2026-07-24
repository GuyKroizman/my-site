import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot-scene')
  }

  preload() {
    this.load.spritesheet('baby', '/gmtk_2026/baby.png', {
      frameWidth: 100,
      frameHeight: 85,
    })

    this.load.audio(
      'spring-music',
      '/gmtk_2026/Classicals.de-Vivaldi-The-Four-Seasons-01-John-Harrison-with-the-Wichita-State-University-Chamber-Players-Spring-Mvt-1-Allegro.mp3'
    )

    this.load.image('young-adult', '/gmtk_2026/young-adult.png')
    this.load.image('adult', '/gmtk_2026/adult.png')
    this.load.image('adult-plus', '/gmtk_2026/adulter.png')
  }

  create() {
    this.createAnimations()
    this.scene.start('game-scene')
  }

  private createAnimations() {
    this.anims.create({
      key: 'baby-idle',
      frames: this.anims.generateFrameNumbers('baby', { start: 0, end: 4 }),
      frameRate: 8,
      repeat: -1,
    })

    this.anims.create({
      key: 'baby-run',
      frames: this.anims.generateFrameNumbers('baby', { start: 5, end: 9 }),
      frameRate: 10,
      repeat: -1,
    })
  }
}
