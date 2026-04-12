import * as THREE from 'three'
import { SoundGenerator } from './SoundGenerator'

export type StartLightState = 'waiting' | 'red' | 'orange' | 'green' | 'go' | 'complete'

export class StartLights {
  private scene: THREE.Scene
  private lightsGroup: THREE.Group
  private redLight: THREE.Mesh
  private orangeLight: THREE.Mesh
  private greenLight: THREE.Mesh
  private goText: THREE.Mesh | null = null
  private state: StartLightState = 'waiting'
  private stateTimer: number = 0
  private onComplete: () => void
  private soundGenerator: SoundGenerator

  constructor(scene: THREE.Scene, onComplete: () => void) {
    this.scene = scene
    this.onComplete = onComplete
    this.soundGenerator = new SoundGenerator()
    this.lightsGroup = new THREE.Group()

    // Position lights at the top of the screen
    // Center horizontally, high on Y axis, close to camera
    const lightX = 0 // Centered horizontally
    const lightY = 3 // Above the ground plane so lights are visible
    const lightZ = -8 // Close to camera for visibility

    // Create three circular lights in a row - twice as big
    const lightRadius = 1.6 // Doubled from 0.8
    const lightSpacing = 5.0 // Doubled from 2.5
    const lightHeight = 0.4 // Doubled from 0.2

    // Red light (left)
    this.redLight = this.createLight(lightRadius, lightHeight)
    this.redLight.position.set(lightX - lightSpacing, lightY, lightZ)
    this.redLight.rotation.x = Math.PI / 2
    this.lightsGroup.add(this.redLight)

    // Orange light (middle)
    this.orangeLight = this.createLight(lightRadius, lightHeight)
    this.orangeLight.position.set(lightX, lightY, lightZ)
    this.orangeLight.rotation.x = Math.PI / 2
    this.lightsGroup.add(this.orangeLight)

    // Green light (right)
    this.greenLight = this.createLight(lightRadius, lightHeight)
    this.greenLight.position.set(lightX + lightSpacing, lightY, lightZ)
    this.greenLight.rotation.x = Math.PI / 2
    this.lightsGroup.add(this.greenLight)

    // Add lights to scene
    this.scene.add(this.lightsGroup)
    this.lightsGroup.visible = false
  }

  private createLight(radius: number, height: number) {
    const lightGeometry = new THREE.CylinderGeometry(radius, radius, height, 48)
    const lightMaterial = new THREE.MeshStandardMaterial({
      color: 0x353535,
      emissive: 0x000000,
      emissiveIntensity: 0,
      transparent: true,
      opacity: 0.5,
      metalness: 0.05,
      roughness: 0.35
    })
    const light = new THREE.Mesh(lightGeometry, lightMaterial)

    const ringOuterRadius = radius * 1.035
    const ringInnerRadius = radius * 0.92
    const ringDepth = height * 0.24
    const ringShape = new THREE.Shape()
    ringShape.absarc(0, 0, ringOuterRadius, 0, Math.PI * 2, false)

    const ringHole = new THREE.Path()
    ringHole.absarc(0, 0, ringInnerRadius, 0, Math.PI * 2, true)
    ringShape.holes.push(ringHole)

    const ringGeometry = new THREE.ExtrudeGeometry(ringShape, {
      depth: ringDepth,
      bevelEnabled: false,
      curveSegments: 48
    })
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xb5b8bf,
      metalness: 0.85,
      roughness: 0.3
    })
    const ring = new THREE.Mesh(ringGeometry, ringMaterial)
    ring.name = 'light-ring'
    ring.position.set(0, 0, height * 0.5 - ringDepth)
    ring.rotation.x = Math.PI / 2
    light.add(ring)

    const lensGeometry = new THREE.CircleGeometry(ringInnerRadius * 0.98, 48)
    const lensMaterial = new THREE.MeshStandardMaterial({
      color: 0x252525,
      emissive: 0x000000,
      emissiveIntensity: 0,
      transparent: true,
      opacity: 0.9,
      metalness: 0.02,
      roughness: 0.18
    })
    const lens = new THREE.Mesh(lensGeometry, lensMaterial)
    lens.name = 'light-lens'
    lens.position.set(0, 0, height * 0.5 - ringDepth * 0.2)
    lens.rotation.x = Math.PI / 2
    light.add(lens)

    return light
  }

  private setLightState(light: THREE.Mesh, color: number | null) {
    const bodyMaterial = light.material as THREE.MeshStandardMaterial
    const lens = light.children.find(
      (child) => child instanceof THREE.Mesh && child.name === 'light-lens'
    ) as THREE.Mesh | undefined
    const lensMaterial = lens?.material as THREE.MeshStandardMaterial | undefined

    if (color === null) {
      bodyMaterial.color.setHex(0x353535)
      bodyMaterial.emissive.setHex(0x000000)
      bodyMaterial.emissiveIntensity = 0
      bodyMaterial.opacity = 0.5

      if (lensMaterial) {
        lensMaterial.color.setHex(0x252525)
        lensMaterial.emissive.setHex(0x000000)
        lensMaterial.emissiveIntensity = 0
        lensMaterial.opacity = 0.9
      }

      return
    }

    bodyMaterial.color.setHex(color)
    bodyMaterial.emissive.setHex(color)
    bodyMaterial.emissiveIntensity = 1
    bodyMaterial.opacity = 1

    if (lensMaterial) {
      lensMaterial.color.setHex(color)
      lensMaterial.emissive.setHex(color)
      lensMaterial.emissiveIntensity = 1.4
      lensMaterial.opacity = 1
    }
  }

  private activateRed() {
    this.state = 'red'
    this.stateTimer = 0
    this.setLightState(this.redLight, 0xff0000)
    this.setLightState(this.orangeLight, null)
    this.setLightState(this.greenLight, null)

    // Play low beep for red light (subtle, optional)
    this.soundGenerator.playBeep(250, 0.1, 0.3)
  }

  private activateOrange() {
    this.state = 'orange'
    this.stateTimer = 0
    this.setLightState(this.redLight, null)
    this.setLightState(this.orangeLight, 0xff8800)
    this.setLightState(this.greenLight, null)

    // Play medium beep for orange light
    this.soundGenerator.playBeep(450, 0.1, 0.5)
  }

  private activateGreen() {
    this.state = 'green'
    this.stateTimer = 0
    this.setLightState(this.orangeLight, null)
    this.setLightState(this.greenLight, 0x00ff00)

    // Play higher beep for green light (ready signal)
    this.soundGenerator.playBeep(700, 0.15, 0.7)
  }

  private showGoText() {
    // Show "Go!" text immediately when green activates, but keep lights visible
    if (this.goText) return // Already showing

    // Play ascending tone for "Go!" - emphatic and exciting
    this.soundGenerator.playAscendingTone(800, 1200, 0.2, 1.0)

    // Create "Go!" text using canvas texture
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const context = canvas.getContext('2d')

    if (context) {
      // Fill with transparent background
      context.clearRect(0, 0, canvas.width, canvas.height)

      // Set text style
      context.font = 'bold 220px Arial'
      context.fillStyle = '#00ff00'
      context.strokeStyle = '#000000'
      context.lineWidth = 8
      context.textAlign = 'center'
      context.textBaseline = 'middle'

      // Draw text with outline for visibility
      context.strokeText('Go!', canvas.width / 2, canvas.height / 2)
      context.fillText('Go!', canvas.width / 2, canvas.height / 2)
    }

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true

    // Create plane with text texture
    const goGeometry = new THREE.PlaneGeometry(6, 3)
    const goMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      emissive: 0x00ff00,
      emissiveIntensity: 1.5,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1
    })
    const goMesh = new THREE.Mesh(goGeometry, goMaterial)

    // Position in front of camera, visible area - center of track
    goMesh.position.set(0, 4, -5)
    goMesh.rotation.x = -Math.PI / 4 // Angle towards camera
    this.goText = goMesh
    this.scene.add(this.goText)
  }

  private hideLightsAndGo() {
    // Hide all lights (green light has lingered for 4 seconds)
    this.lightsGroup.visible = false
    // Transition to 'go' state for animation
    this.state = 'go'
    this.stateTimer = 0
  }

  public startSequence() {
    if (this.state !== 'waiting') return
    this.lightsGroup.visible = true
    this.activateRed()
  }

  public update(deltaTime: number) {
    if (this.state === 'complete' || this.state === 'waiting') return

    this.stateTimer += deltaTime

    if (this.state === 'red' && this.stateTimer >= 1.0) {
      this.activateOrange()
    } else if (this.state === 'orange' && this.stateTimer >= 1.0) {
      this.activateGreen()
      // Show "Go!" immediately when green activates
      this.showGoText()
    } else if (this.state === 'green' && this.stateTimer >= 4.0) {
      // Green light lingers for 4 seconds, then hide lights and transition to 'go' state
      this.hideLightsAndGo()
    } else if (this.state === 'go') {
      // Animate "Go!" flying off screen
      if (this.goText) {
        this.goText.position.y += deltaTime * 15 // Fly upward
        this.goText.position.z -= deltaTime * 25 // Fly forward (away from camera)
        this.goText.scale.multiplyScalar(1 + deltaTime * 1.5) // Grow
        const material = this.goText.material as THREE.MeshStandardMaterial
        if (material) {
          material.opacity = Math.max(0, 1 - this.stateTimer * 1.5) // Fade out
          material.transparent = true
        }
      }

      if (this.stateTimer >= 1.0) {
        // Remove "Go!" text
        if (this.goText) {
          this.scene.remove(this.goText)
          if (this.goText instanceof THREE.Mesh) {
            this.goText.geometry.dispose()
            if (Array.isArray(this.goText.material)) {
              this.goText.material.forEach(mat => mat.dispose())
            } else {
              this.goText.material.dispose()
            }
          }
          this.goText = null
        }

        this.state = 'complete'
        this.onComplete()
      }
    }
  }

  public isGreen(): boolean {
    return this.state === 'green' || this.state === 'go' || this.state === 'complete'
  }

  public reset() {
    this.state = 'waiting'
    this.stateTimer = 0

    // Remove "Go!" text if it exists
    if (this.goText) {
      this.scene.remove(this.goText)
      if (this.goText instanceof THREE.Mesh) {
        this.goText.geometry.dispose()
        if (Array.isArray(this.goText.material)) {
          this.goText.material.forEach(mat => mat.dispose())
        } else {
          this.goText.material.dispose()
        }
      }
      this.goText = null
    }

    this.lightsGroup.visible = false
    this.setLightState(this.redLight, null)
    this.setLightState(this.orangeLight, null)
    this.setLightState(this.greenLight, null)
  }

  public dispose() {
    if (this.goText) {
      this.scene.remove(this.goText)
      if (this.goText instanceof THREE.Mesh) {
        this.goText.geometry.dispose()
        if (Array.isArray(this.goText.material)) {
          this.goText.material.forEach(mat => mat.dispose())
        } else {
          this.goText.material.dispose()
        }
      }
    }

    this.lightsGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => mat.dispose())
        } else {
          child.material.dispose()
        }
      }
    })

    this.scene.remove(this.lightsGroup)

    // Clean up sound generator
    this.soundGenerator.dispose()
  }
}
