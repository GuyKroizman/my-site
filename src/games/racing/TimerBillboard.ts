import * as THREE from 'three'
import { formatTime } from './utils'

export class TimerBillboard {
  private scene: THREE.Scene
  private group: THREE.Group
  private canvas: HTMLCanvasElement
  private context: CanvasRenderingContext2D
  private texture: THREE.CanvasTexture
  private lastText: string = ''

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.group = new THREE.Group()

    const postHeight = 10
    const boardWidth = 12
    const boardHeight = 6

    // Two wooden posts
    const postGeometry = new THREE.BoxGeometry(0.5, postHeight, 0.5)
    const postMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3520 })

    const leftPost = new THREE.Mesh(postGeometry, postMaterial)
    leftPost.position.set(-boardWidth / 2 + 0.5, postHeight / 2, 0)
    this.group.add(leftPost)

    const rightPost = new THREE.Mesh(postGeometry, postMaterial)
    rightPost.position.set(boardWidth / 2 - 0.5, postHeight / 2, 0)
    this.group.add(rightPost)

    // Backboard
    const backboardGeometry = new THREE.BoxGeometry(boardWidth, boardHeight, 0.3)
    const backboardMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 })
    const backboard = new THREE.Mesh(backboardGeometry, backboardMaterial)
    backboard.position.set(0, postHeight - boardHeight / 2, 0)
    this.group.add(backboard)

    // Canvas texture for timer text
    this.canvas = document.createElement('canvas')
    this.canvas.width = 512
    this.canvas.height = 256
    this.context = this.canvas.getContext('2d')!
    this.texture = new THREE.CanvasTexture(this.canvas)

    // Sign face — use emissiveMap so the texture itself glows and is readable
    const faceGeometry = new THREE.PlaneGeometry(boardWidth - 0.6, boardHeight - 0.6)
    const faceMaterial = new THREE.MeshStandardMaterial({
      map: this.texture,
      emissiveMap: this.texture,
      emissive: 0xffffff,
      emissiveIntensity: 1.0,
    })
    const face = new THREE.Mesh(faceGeometry, faceMaterial)
    face.position.set(0, postHeight - boardHeight / 2, 0.2)
    this.group.add(face)

    // Position next to the track, angled toward camera
    // Camera is at (0, 25, 26) looking at origin
    this.group.position.set(27, 0, -6)
    // Turn slightly toward center of track
    this.group.rotation.y = -Math.PI / 2

    this.scene.add(this.group)

    // Draw initial state
    this.drawText('0.0')
  }

  private drawText(text: string) {
    this.lastText = text
    const ctx = this.context

    // Dark background
    ctx.fillStyle = '#111111'
    ctx.fillRect(0, 0, 512, 256)

    // Border
    ctx.strokeStyle = '#444444'
    ctx.lineWidth = 4
    ctx.strokeRect(4, 4, 504, 248)

    // "TIME" label
    ctx.font = 'bold 52px monospace'
    ctx.fillStyle = '#999999'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('TIME', 256, 16)

    // Timer value
    ctx.font = 'bold 130px monospace'
    ctx.fillStyle = '#00ff44'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 256, 160)

    this.texture.needsUpdate = true
  }

  update(time: number) {
    const text = formatTime(time)
    if (text !== this.lastText) {
      this.drawText(text)
    }
  }

  dispose() {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => mat.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
    this.texture.dispose()
    this.scene.remove(this.group)
  }
}
