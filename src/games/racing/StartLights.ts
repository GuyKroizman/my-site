import * as THREE from 'three'
import { SoundGenerator } from './SoundGenerator'

export type StartLightState = 'red' | 'orange' | 'green' | 'go' | 'complete'

export class StartLights {
  private scene: THREE.Scene
  private lightsGroup: THREE.Group
  private redLight: THREE.Mesh
  private orangeLight: THREE.Mesh
  private greenLight: THREE.Mesh
  private goText: THREE.Mesh | null = null
  private state: StartLightState = 'red'
  private stateTimer: number = 0
  private onComplete: () => void
  private soundGenerator: SoundGenerator

  constructor(scene: THREE.Scene, onComplete: () => void) {
    this.scene = scene
    this.onComplete = onComplete
    this.soundGenerator = new SoundGenerator()
    this.lightsGroup = new THREE.Group()

    // Position lights at the top of the screen, below the level name
    // Center horizontally, high on Y axis, close to camera
    const lightX = 0 // Centered horizontally
    const lightY = 8 // High on screen, below level name
    const lightZ = -8 // Close to camera for visibility

    // Create three circular lights in a row - twice as big
    const lightRadius = 1.6 // Doubled from 0.8
    const lightSpacing = 5.0 // Doubled from 2.5
    const lightHeight = 0.4 // Doubled from 0.2

    // Red light (left)
    const redGeometry = new THREE.CylinderGeometry(lightRadius, lightRadius, lightHeight, 32)
    const redMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333, // Dark when off
      emissive: 0x000000,
      emissiveIntensity: 0
    })
    this.redLight = new THREE.Mesh(redGeometry, redMaterial)
    this.redLight.position.set(lightX - lightSpacing, lightY, lightZ)
    this.redLight.rotation.x = Math.PI / 2
    this.lightsGroup.add(this.redLight)

    // Orange light (middle)
    const orangeGeometry = new THREE.CylinderGeometry(lightRadius, lightRadius, lightHeight, 32)
    const orangeMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333, // Dark when off
      emissive: 0x000000,
      emissiveIntensity: 0
    })
    this.orangeLight = new THREE.Mesh(orangeGeometry, orangeMaterial)
    this.orangeLight.position.set(lightX, lightY, lightZ)
    this.orangeLight.rotation.x = Math.PI / 2
    this.lightsGroup.add(this.orangeLight)

    // Green light (right)
    const greenGeometry = new THREE.CylinderGeometry(lightRadius, lightRadius, lightHeight, 32)
    const greenMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333, // Dark when off
      emissive: 0x000000,
      emissiveIntensity: 0
    })
    this.greenLight = new THREE.Mesh(greenGeometry, greenMaterial)
    this.greenLight.position.set(lightX + lightSpacing, lightY, lightZ)
    this.greenLight.rotation.x = Math.PI / 2
    this.lightsGroup.add(this.greenLight)

    // Add lights to scene
    this.scene.add(this.lightsGroup)

    // Start with red light on
    this.activateRed()
  }

  private activateRed() {
    this.state = 'red'
    this.stateTimer = 0
    // Turn on red light
    const redMaterial = this.redLight.material as THREE.MeshStandardMaterial
    redMaterial.color.setHex(0xff0000)
    redMaterial.emissive.setHex(0xff0000)
    redMaterial.emissiveIntensity = 1

    // Turn off orange and green
    const orangeMaterial = this.orangeLight.material as THREE.MeshStandardMaterial
    orangeMaterial.color.setHex(0x333333)
    orangeMaterial.emissive.setHex(0x000000)
    orangeMaterial.emissiveIntensity = 0

    const greenMaterial = this.greenLight.material as THREE.MeshStandardMaterial
    greenMaterial.color.setHex(0x333333)
    greenMaterial.emissive.setHex(0x000000)
    greenMaterial.emissiveIntensity = 0

    // Play low beep for red light (subtle, optional)
    this.soundGenerator.playBeep(250, 0.1, 0.3)
  }

  private activateOrange() {
    this.state = 'orange'
    this.stateTimer = 0
    // Turn off red
    const redMaterial = this.redLight.material as THREE.MeshStandardMaterial
    redMaterial.color.setHex(0x333333)
    redMaterial.emissive.setHex(0x000000)
    redMaterial.emissiveIntensity = 0

    // Turn on orange
    const orangeMaterial = this.orangeLight.material as THREE.MeshStandardMaterial
    orangeMaterial.color.setHex(0xff8800)
    orangeMaterial.emissive.setHex(0xff8800)
    orangeMaterial.emissiveIntensity = 1

    // Green still off
    const greenMaterial = this.greenLight.material as THREE.MeshStandardMaterial
    greenMaterial.color.setHex(0x333333)
    greenMaterial.emissive.setHex(0x000000)
    greenMaterial.emissiveIntensity = 0

    // Play medium beep for orange light
    this.soundGenerator.playBeep(450, 0.1, 0.5)
  }

  private activateGreen() {
    this.state = 'green'
    this.stateTimer = 0
    // Turn off orange
    const orangeMaterial = this.orangeLight.material as THREE.MeshStandardMaterial
    orangeMaterial.color.setHex(0x333333)
    orangeMaterial.emissive.setHex(0x000000)
    orangeMaterial.emissiveIntensity = 0

    // Turn on green
    const greenMaterial = this.greenLight.material as THREE.MeshStandardMaterial
    greenMaterial.color.setHex(0x00ff00)
    greenMaterial.emissive.setHex(0x00ff00)
    greenMaterial.emissiveIntensity = 1

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

  public update(deltaTime: number) {
    if (this.state === 'complete') return

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
    // Reset to initial state
    this.state = 'red'
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

    // Show lights again
    this.lightsGroup.visible = true

    // Start with red light on
    this.activateRed()
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
