import * as THREE from 'three'

export class PlayerArrow {
  public mesh: THREE.Group
  private time: number = 0
  private baseY: number = 2.5
  private bobAmplitude: number = 0.4
  private bobSpeed: number = 3.0
  private visible: boolean = true

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.Group()

    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0x00dd00,
      emissive: 0x00aa00,
      emissiveIntensity: 0.6,
    })

    // Arrowhead: inverted cone (point facing down)
    const headGeom = new THREE.ConeGeometry(0.55, 1.0, 4)
    const head = new THREE.Mesh(headGeom, arrowMat)
    head.rotation.x = Math.PI // flip so tip points down
    head.position.y = 0
    this.mesh.add(head)

    // Shaft: thin cylinder above the cone
    const shaftGeom = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8)
    const shaft = new THREE.Mesh(shaftGeom, arrowMat)
    shaft.position.y = 0.9
    this.mesh.add(shaft)

    scene.add(this.mesh)
  }

  public update(deltaTime: number, playerPosition: THREE.Vector3) {
    if (!this.visible) return

    this.time += deltaTime
    const bobOffset = Math.sin(this.time * this.bobSpeed) * this.bobAmplitude
    this.mesh.position.set(
      playerPosition.x,
      this.baseY + bobOffset,
      playerPosition.z,
    )
  }

  public hide() {
    if (!this.visible) return
    this.visible = false
    this.mesh.visible = false
  }

  public show() {
    this.visible = true
    this.mesh.visible = true
    this.time = 0
  }

  public dispose() {
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
    this.mesh.parent?.remove(this.mesh)
  }
}
