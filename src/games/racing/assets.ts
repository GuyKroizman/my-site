import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import type { LevelConfig } from './levels'
import { DECORATION_MODELS } from './levels/decorationConfig'

const sharedAssetFlag = 'racingSharedAsset'
const textureLoader = new THREE.TextureLoader()
const gltfLoader = new GLTFLoader()
const fbxLoader = new FBXLoader()

const modelCache = new Map<string, Promise<THREE.Group>>()
const textureCache = new Map<string, Promise<THREE.Texture>>()
const resolvedModels = new Map<string, THREE.Group>()
const resolvedTextures = new Map<string, THREE.Texture>()

const SKYBOX_TEXTURE_PATH = '/racing/sunset-skybox.png'
const EYE_MODEL_PATH = '/racing/eye.glb'
const MINE_MODEL_PATH = '/racing/models/landmine.glb'

export interface RacingLevelAssets {
  modelPaths: string[]
  texturePaths: string[]
}

function markSharedAsset(root: THREE.Object3D): void {
  root.traverse((child) => {
    child.userData[sharedAssetFlag] = true
  })
}

function cloneSharedModel(model: THREE.Group): THREE.Group {
  const clone = model.clone(true)
  markSharedAsset(clone)
  return clone
}

async function loadModel(path: string): Promise<THREE.Group> {
  if (path.toLowerCase().endsWith('.glb') || path.toLowerCase().endsWith('.gltf')) {
    const gltf = await gltfLoader.loadAsync(path)
    markSharedAsset(gltf.scene)
    return gltf.scene
  }

  const model = await fbxLoader.loadAsync(path)
  markSharedAsset(model)
  return model
}

async function loadTexture(path: string): Promise<THREE.Texture> {
  const texture = await textureLoader.loadAsync(path)
  return texture
}

export function getLevelAssetPaths(level: LevelConfig): RacingLevelAssets {
  const modelPaths = new Set<string>()
  const texturePaths = new Set<string>()

  for (const car of level.cars) {
    if (car.modelPath) {
      modelPaths.add(car.modelPath)
    }
  }

  if (level.decorationRows?.length) {
    const usedKeys = new Set<string>()
    for (const row of level.decorationRows) {
      for (const char of row) {
        if (char !== ' ') {
          usedKeys.add(char)
        }
      }
    }

    for (const key of usedKeys) {
      const config = DECORATION_MODELS[key]
      if (config) {
        modelPaths.add(config.path)
      }
    }
  }

  if (level.id === 1) {
    texturePaths.add(SKYBOX_TEXTURE_PATH)
    modelPaths.add(EYE_MODEL_PATH)
  }

  if (level.id >= 2) {
    modelPaths.add(MINE_MODEL_PATH)
  }

  return {
    modelPaths: [...modelPaths],
    texturePaths: [...texturePaths],
  }
}

export async function preloadRacingLevelAssets(level: LevelConfig): Promise<void> {
  const assets = getLevelAssetPaths(level)
  await Promise.all([
    ...assets.modelPaths.map((path) => preloadModel(path)),
    ...assets.texturePaths.map((path) => preloadTexture(path)),
  ])
}

export async function preloadModel(path: string): Promise<void> {
  if (!modelCache.has(path)) {
    modelCache.set(
      path,
      loadModel(path).then((model) => {
        resolvedModels.set(path, model)
        return model
      })
    )
  }

  await modelCache.get(path)
}

export async function preloadTexture(path: string): Promise<void> {
  if (!textureCache.has(path)) {
    textureCache.set(
      path,
      loadTexture(path).then((texture) => {
        resolvedTextures.set(path, texture)
        return texture
      })
    )
  }

  await textureCache.get(path)
}

export function getCachedModelClone(path: string): THREE.Group | null {
  const cachedModel = resolvedModels.get(path)
  if (!cachedModel) {
    return null
  }

  return cloneSharedModel(cachedModel)
}

export function getCachedTexture(path: string): THREE.Texture | null {
  const cachedTexture = resolvedTextures.get(path)
  if (!cachedTexture) {
    return null
  }

  return cachedTexture
}

export function isSharedAssetObject(object: THREE.Object3D): boolean {
  return object.userData[sharedAssetFlag] === true
}

export const RACING_SHARED_ASSET_PATHS = {
  skyboxTexture: SKYBOX_TEXTURE_PATH,
  eyeModel: EYE_MODEL_PATH,
  mineModel: MINE_MODEL_PATH,
}
