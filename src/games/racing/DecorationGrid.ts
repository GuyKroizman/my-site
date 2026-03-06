import * as THREE from 'three'
import type { DecorationModelConfig } from './levels/decorationConfig'

const GRID_COLS = 80
const GRID_ROWS = 60

export interface DecorationBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export class DecorationGrid {
  public group: THREE.Group
  private scene: THREE.Scene

  constructor(
    scene: THREE.Scene,
    bounds: DecorationBounds,
    models: Record<string, DecorationModelConfig>,
    rows: string[]
  ) {
    this.scene = scene
    this.group = new THREE.Group()
    scene.add(this.group)

    const spanX = bounds.maxX - bounds.minX
    const spanZ = bounds.maxZ - bounds.minZ

    for (let row = 0; row < GRID_ROWS; row++) {
      const line = rows[row] ?? ''
      for (let col = 0; col < GRID_COLS; col++) {
        const char = line[col]
        if (char === ' ' || char === undefined) continue

        const config = models[char]
        if (!config) continue

        const x = bounds.minX + (col + 0.5) * (spanX / GRID_COLS)
        const z = bounds.minZ + (row + 0.5) * (spanZ / GRID_ROWS)

        this.placeModel(config, x, z)
      }
    }
  }

  private placeModel(config: DecorationModelConfig, x: number, z: number): void {
    const mesh = new THREE.Group()
    mesh.position.set(x, 0, z)
    const r = config.rotation
    if (r !== undefined) {
      if (typeof r === 'number') {
        mesh.rotation.y = r
      } else {
        if (r.x !== undefined) mesh.rotation.x = r.x
        if (r.y !== undefined) mesh.rotation.y = r.y
        if (r.z !== undefined) mesh.rotation.z = r.z
      }
    }
    this.group.add(mesh)

    void this.loadModel(config.path, config.scale ?? 1, mesh)
  }

  private async loadModel(
    path: string,
    scaleMultiplier: number,
    parent: THREE.Group
  ): Promise<void> {
    try {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
      const loader = new GLTFLoader()
      loader.load(
        path,
        (gltf) => {
          const model = gltf.scene as THREE.Group
          const box = new THREE.Box3().setFromObject(model)
          const size = new THREE.Vector3()
          box.getSize(size)
          const maxDim = Math.max(size.x, size.y, size.z, 0.001)
          const scale = (1 / maxDim) * scaleMultiplier
          model.scale.setScalar(scale)
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true
              child.receiveShadow = true
            }
          })
          parent.add(model)
        },
        undefined,
        (err) => console.warn('Failed to load decoration model', path, err)
      )
    } catch (e) {
      console.warn('Decoration model loader error', path, e)
    }
  }

  public destroy(): void {
    this.scene.remove(this.group)
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose())
        } else {
          child.material?.dispose()
        }
      }
    })
  }
}
