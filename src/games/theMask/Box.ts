import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { FLOOR_Y } from './types'

export interface BoxOptions {
  width: number
  height: number
  depth: number
  x: number
  y: number
  z: number
  color?: number
  mass?: number
}

export class Box {
  body: CANNON.Body
  mesh: THREE.Mesh

  constructor(world: CANNON.World, scene: THREE.Scene, options: BoxOptions) {
    const { width, height, depth, x, y, z, color = 0x8d6e63, mass = 4 } = options
    const halfExtents = new CANNON.Vec3(width / 2, height / 2, depth / 2)
    this.body = new CANNON.Body({
      mass,
      position: new CANNON.Vec3(x, y + height / 2, z),
      shape: new CANNON.Box(halfExtents),
      linearDamping: 0.1,
      angularDamping: 0.2,
      collisionFilterGroup: 1,
      collisionFilterMask: 1 | 2, // 1 = default (player, bullets), 2 = bullets
    })
    world.addBody(this.body)

    const geometry = new THREE.BoxGeometry(width, height, depth)
    const material = new THREE.MeshStandardMaterial({ color })
    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.mesh.position.set(x, y + height / 2, z)
    scene.add(this.mesh)
  }

  syncMesh() {
    this.mesh.position.set(this.body.position.x, this.body.position.y, this.body.position.z)
    this.mesh.quaternion.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    )
  }

  dispose(scene: THREE.Scene, world: CANNON.World) {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
    world.removeBody(this.body)
  }
}

/** Create a pile of boxes for the arena. */
export function createBoxPiles(
  world: CANNON.World,
  scene: THREE.Scene
): Box[] {
  const boxes: Box[] = []
  const colors = [0x8d6e63, 0x795548, 0xa1887f, 0x6d4c41]
  const pilePositions: [number, number][] = [
    [-10, -8],
    [10, -6],
    [-6, 8],
    [8, 10],
    [0, 0],
    [-15, 0],
    [14, -12],
    [-12, 14],
  ]
  pilePositions.forEach(([px, pz], i) => {
    const count = 2 + (i % 3)
    for (let j = 0; j < count; j++) {
      const w = 0.8 + Math.random() * 0.4
      const h = 0.6 + Math.random() * 0.3
      const d = 0.8 + Math.random() * 0.4
      const y = FLOOR_Y + j * h
      boxes.push(
        new Box(world, scene, {
          width: w,
          height: h,
          depth: d,
          x: px + (Math.random() - 0.5),
          y,
          z: pz + (Math.random() - 0.5),
          color: colors[i % colors.length],
          mass: 4,
        })
      )
    }
  })
  return boxes
}
