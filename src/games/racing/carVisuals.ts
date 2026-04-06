import * as THREE from 'three'
import { isSharedAssetObject } from './assets'

export interface FireEffectState {
  fireMeshes: THREE.Sprite[]
  fireLight: THREE.PointLight | null
}

export interface HealthBarState {
  sprite: THREE.Sprite
  canvas: HTMLCanvasElement
  texture: THREE.CanvasTexture
}

export function createDefaultCarMesh(color: number): THREE.Group {
  const mesh = new THREE.Group()

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.6, 2),
    new THREE.MeshStandardMaterial({ color })
  )
  body.castShadow = true
  body.receiveShadow = true
  mesh.add(body)

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.4, 1.2),
    new THREE.MeshStandardMaterial({ color: color * 0.8 })
  )
  roof.position.y = 0.5
  roof.castShadow = true
  mesh.add(roof)

  const wheelGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3)
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 })
  const wheelPositions = [
    { x: -0.5, y: -0.3, z: 0.7 },
    { x: 0.5, y: -0.3, z: 0.7 },
    { x: -0.5, y: -0.3, z: -0.7 },
    { x: 0.5, y: -0.3, z: -0.7 }
  ]

  wheelPositions.forEach(pos => {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial)
    wheel.position.set(pos.x, pos.y, pos.z)
    wheel.castShadow = true
    mesh.add(wheel)
  })

  return mesh
}

export function computeLocalHalfSize(mesh: THREE.Object3D): THREE.Vector3 {
  const originalRotationY = mesh.rotation.y
  mesh.rotation.y = 0
  mesh.updateMatrixWorld(true)

  const localHalfSize = new THREE.Vector3()
  const localBox = new THREE.Box3().setFromObject(mesh)
  localBox.getSize(localHalfSize)
  localHalfSize.multiplyScalar(0.5)

  mesh.rotation.y = originalRotationY
  mesh.updateMatrixWorld(true)
  return localHalfSize
}

export function orientAndScaleCarModel(model: THREE.Group): THREE.Group {
  const initialBounds = new THREE.Box3().setFromObject(model)
  const initialSize = new THREE.Vector3()
  initialBounds.getSize(initialSize)

  if (initialSize.x > initialSize.z) {
    model.rotation.y = Math.PI / 2
  }

  const orientedBounds = new THREE.Box3().setFromObject(model)
  const orientedSize = new THREE.Vector3()
  orientedBounds.getSize(orientedSize)

  const targetLength = 3
  const scale = targetLength / Math.max(orientedSize.z, 0.001)
  model.scale.setScalar(scale)

  const finalBounds = new THREE.Box3().setFromObject(model)
  const finalCenter = new THREE.Vector3()
  finalBounds.getCenter(finalCenter)
  const targetBottomY = -0.3
  model.position.set(-finalCenter.x, targetBottomY - finalBounds.min.y, -finalCenter.z)

  model.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })

  return model
}

export function disposeVisualObject(object: THREE.Object3D): void {
  if (isSharedAssetObject(object)) {
    return
  }

  object.traverse(child => {
    if (isSharedAssetObject(child)) {
      return
    }

    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      if (Array.isArray(child.material)) {
        child.material.forEach(mat => mat.dispose())
      } else {
        child.material.dispose()
      }
    }
  })
}

export function createHealthBar(): HealthBarState {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 8

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    sizeAttenuation: true,
  }))
  sprite.scale.set(2.5, 0.3, 1)
  sprite.visible = false

  return { sprite, canvas, texture }
}

export function drawHealthBar(canvas: HTMLCanvasElement, texture: THREE.CanvasTexture, health: number): void {
  const ctx = canvas.getContext('2d')!
  const w = canvas.width
  const h = canvas.height
  const ratio = Math.max(0, health / 100)

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.fillRect(0, 0, w, h)

  if (ratio > 0.5) {
    ctx.fillStyle = '#22cc22'
  } else if (ratio > 0.25) {
    ctx.fillStyle = '#cccc22'
  } else {
    ctx.fillStyle = '#cc2222'
  }

  ctx.fillRect(1, 1, (w - 2) * ratio, h - 2)
  texture.needsUpdate = true
}

export function addFireEffect(
  mesh: THREE.Group,
  count: number,
  spreadXZ: number,
  baseScale: number,
  lightIntensity: number,
  lightDistance: number
): FireEffectState {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx2d = canvas.getContext('2d')!
  const gradient = ctx2d.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255, 220, 50, 0.95)')
  gradient.addColorStop(0.3, 'rgba(255, 120, 0, 0.85)')
  gradient.addColorStop(0.7, 'rgba(200, 30, 0, 0.5)')
  gradient.addColorStop(1, 'rgba(100, 0, 0, 0)')
  ctx2d.fillStyle = gradient
  ctx2d.fillRect(0, 0, 64, 64)
  const texture = new THREE.CanvasTexture(canvas)

  const fireMeshes: THREE.Sprite[] = []
  for (let i = 0; i < count; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }))
    sprite.position.set(
      (Math.random() - 0.5) * spreadXZ,
      0.5 + Math.random() * spreadXZ,
      (Math.random() - 0.5) * spreadXZ
    )
    const s = baseScale + Math.random() * (baseScale * 0.75)
    sprite.scale.set(s, s, 1)
    mesh.add(sprite)
    fireMeshes.push(sprite)
  }

  const fireLight = new THREE.PointLight(0xff4400, lightIntensity, lightDistance)
  fireLight.position.set(0, 1.2, 0)
  mesh.add(fireLight)

  return { fireMeshes, fireLight }
}

export function animateFireEffect(
  fireMeshes: THREE.Sprite[],
  fireLight: THREE.PointLight | null,
  fireTime: number
): void {
  fireMeshes.forEach((sprite, i) => {
    const phase = i * (Math.PI * 2 / fireMeshes.length)
    const oscillation = 0.2 * Math.sin(fireTime * 5 + phase)
    const baseScale = 0.8 + (i % 3) * 0.3
    const s = baseScale + oscillation
    sprite.scale.set(s, s, 1)
    sprite.position.x += (Math.random() - 0.5) * 0.04
    sprite.position.z += (Math.random() - 0.5) * 0.04
    sprite.position.x = Math.max(-0.5, Math.min(0.5, sprite.position.x))
    sprite.position.z = Math.max(-0.5, Math.min(0.5, sprite.position.z))
  })

  if (fireLight) {
    fireLight.intensity = 1.5 + 0.5 * Math.sin(fireTime * 7)
  }
}

export function clearFireEffect(mesh: THREE.Group, fireState: FireEffectState): FireEffectState {
  fireState.fireMeshes.forEach(sprite => {
    mesh.remove(sprite)
    sprite.material.map?.dispose()
    sprite.material.dispose()
  })

  if (fireState.fireLight) {
    mesh.remove(fireState.fireLight)
  }

  return {
    fireMeshes: [],
    fireLight: null
  }
}
