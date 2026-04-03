import * as THREE from 'three'

const DIGIT_GRID_WIDTH = 18
const DIGIT_GRID_HEIGHT = 24
const BOX_SIZE = 0.55
const DIGIT_THICKNESS = 0.75
const DROP_START_Y = 24
const DIGIT_CENTER = new THREE.Vector3(0, 0, 0)
const GRAVITY = -28
const FADE_DURATION = 5
const GROUND_Y = 0.05 + DIGIT_THICKNESS * 0.5

interface FallingDigitEffect {
  root: THREE.Group
  cubes: THREE.Mesh[]
  material: THREE.MeshStandardMaterial
  velocityY: number
  shattered: boolean
  fadeTime: number
  cubeStates: {
    velocity: THREE.Vector3
    rotationVelocity: THREE.Vector3
  }[]
}

export class LapDigitDropEffect {
  private scene: THREE.Scene
  private boxGeometry: THREE.BoxGeometry
  private activeEffects: FallingDigitEffect[] = []
  private digitCanvas: HTMLCanvasElement
  private digitContext: CanvasRenderingContext2D

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.boxGeometry = new THREE.BoxGeometry(BOX_SIZE, DIGIT_THICKNESS, BOX_SIZE)
    this.digitCanvas = document.createElement('canvas')
    this.digitCanvas.width = 180
    this.digitCanvas.height = 240
    const context = this.digitCanvas.getContext('2d')
    if (!context) {
      throw new Error('Failed to create lap digit canvas context')
    }
    this.digitContext = context
  }

  public spawnDigit(value: number): void {
    const digit = Math.max(0, Math.min(9, Math.floor(value)))
    const cells = this.rasterizeDigit(String(digit))
    if (cells.length === 0) return

    const root = new THREE.Group()
    root.position.set(DIGIT_CENTER.x, DROP_START_Y, DIGIT_CENTER.z)

    const color = new THREE.Color().setHSL(((digit * 0.11) + 0.08) % 1, 0.68, 0.56)
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.38,
      metalness: 0.18,
      transparent: true
    })

    const cubes: THREE.Mesh[] = []
    const cubeStates: FallingDigitEffect['cubeStates'] = []
    const xOffset = (DIGIT_GRID_WIDTH - 1) * BOX_SIZE * 0.5
    const zOffset = (DIGIT_GRID_HEIGHT - 1) * BOX_SIZE * 0.5

    for (const cell of cells) {
      const cube = new THREE.Mesh(this.boxGeometry, material)
      cube.position.set(
        cell.x * BOX_SIZE - xOffset,
        0,
        cell.y * BOX_SIZE - zOffset
      )
      cube.castShadow = true
      cube.receiveShadow = true
      root.add(cube)
      cubes.push(cube)

      const scatter = new THREE.Vector3(cube.position.x, 0, cube.position.z)
      const distanceScale = Math.min(1.35, 0.45 + scatter.length() * 0.1)
      const lateral = scatter.lengthSq() > 0.0001
        ? scatter.normalize().multiplyScalar((1.4 + Math.random() * 2.4) * distanceScale)
        : new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2)

      cubeStates.push({
        velocity: new THREE.Vector3(
          lateral.x + (Math.random() - 0.5) * 1.2,
          5 + Math.random() * 6,
          lateral.z + (Math.random() - 0.5) * 1.2
        ),
        rotationVelocity: new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8
        )
      })
    }

    this.scene.add(root)
    this.activeEffects.push({
      root,
      cubes,
      material,
      velocityY: -1.5,
      shattered: false,
      fadeTime: 0,
      cubeStates
    })
  }

  public update(deltaTime: number): void {
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const effect = this.activeEffects[i]

      if (!effect.shattered) {
        effect.velocityY += GRAVITY * deltaTime
        effect.root.position.y += effect.velocityY * deltaTime

        if (effect.root.position.y <= GROUND_Y) {
          effect.root.position.y = GROUND_Y
          effect.shattered = true
          effect.root.position.set(0, 0, 0)
          effect.cubes.forEach((cube) => {
            cube.position.add(DIGIT_CENTER)
            cube.position.y = GROUND_Y
          })
        }

        continue
      }

      effect.fadeTime += deltaTime
      effect.material.opacity = Math.max(0, 1 - effect.fadeTime / FADE_DURATION)

      effect.cubes.forEach((cube, index) => {
        const state = effect.cubeStates[index]
        state.velocity.y += GRAVITY * deltaTime
        cube.position.addScaledVector(state.velocity, deltaTime)
        cube.rotation.x += state.rotationVelocity.x * deltaTime
        cube.rotation.y += state.rotationVelocity.y * deltaTime
        cube.rotation.z += state.rotationVelocity.z * deltaTime

        if (cube.position.y <= GROUND_Y) {
          cube.position.y = GROUND_Y
          if (Math.abs(state.velocity.y) > 1.5) {
            state.velocity.y *= -0.28
          } else {
            state.velocity.y = 0
          }
          state.velocity.x *= 0.86
          state.velocity.z *= 0.86
          state.rotationVelocity.multiplyScalar(0.95)
        }
      })

      if (effect.fadeTime >= FADE_DURATION) {
        this.disposeEffect(effect)
        this.activeEffects.splice(i, 1)
      }
    }
  }

  public clear(): void {
    this.activeEffects.forEach((effect) => this.disposeEffect(effect))
    this.activeEffects = []
  }

  public dispose(): void {
    this.clear()
    this.boxGeometry.dispose()
  }

  private disposeEffect(effect: FallingDigitEffect): void {
    this.scene.remove(effect.root)
    effect.root.clear()
    effect.material.dispose()
  }

  private rasterizeDigit(text: string): Array<{ x: number; y: number }> {
    this.digitContext.clearRect(0, 0, this.digitCanvas.width, this.digitCanvas.height)
    this.digitContext.fillStyle = '#000'
    this.digitContext.fillRect(0, 0, this.digitCanvas.width, this.digitCanvas.height)
    this.digitContext.fillStyle = '#fff'
    this.digitContext.font = 'bold 220px Arial Black, Arial, sans-serif'
    this.digitContext.textAlign = 'center'
    this.digitContext.textBaseline = 'middle'
    this.digitContext.fillText(text, this.digitCanvas.width / 2, this.digitCanvas.height / 2 + 6)

    const imageData = this.digitContext.getImageData(0, 0, this.digitCanvas.width, this.digitCanvas.height).data
    const cells: Array<{ x: number; y: number }> = []
    const sampleWidth = this.digitCanvas.width / DIGIT_GRID_WIDTH
    const sampleHeight = this.digitCanvas.height / DIGIT_GRID_HEIGHT

    for (let gy = 0; gy < DIGIT_GRID_HEIGHT; gy++) {
      for (let gx = 0; gx < DIGIT_GRID_WIDTH; gx++) {
        const px = Math.floor((gx + 0.5) * sampleWidth)
        const py = Math.floor((gy + 0.5) * sampleHeight)
        const index = (py * this.digitCanvas.width + px) * 4
        if (imageData[index] > 120) {
          cells.push({ x: gx, y: gy })
        }
      }
    }

    return cells
  }
}
