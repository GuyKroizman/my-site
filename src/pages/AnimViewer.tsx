import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

type ViewerState = {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  clock: THREE.Clock
  frameId: number | null
}

function disposeMaterial(material: THREE.Material): void {
  material.dispose()
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) {
      return
    }

    mesh.geometry?.dispose()

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(disposeMaterial)
      return
    }

    if (mesh.material) {
      disposeMaterial(mesh.material)
    }
  })
}

function frameObject(
  object: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls
): void {
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const maxSize = Math.max(size.x, size.y, size.z, 1)
  const fitHeightDistance = maxSize / (2 * Math.tan((Math.PI * camera.fov) / 360))
  const distance = fitHeightDistance * 1.6

  camera.near = Math.max(distance / 100, 0.01)
  camera.far = distance * 100
  camera.position.set(center.x + distance * 0.6, center.y + distance * 0.35, center.z + distance)
  camera.lookAt(center)
  camera.updateProjectionMatrix()

  controls.target.copy(center)
  controls.minDistance = distance * 0.2
  controls.maxDistance = distance * 6
  controls.update()
}

export default function AnimViewer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const viewerRef = useRef<ViewerState | null>(null)
  const loadedSceneRef = useRef<THREE.Object3D | null>(null)
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const actionsRef = useRef<THREE.AnimationAction[]>([])
  const clipsRef = useRef<THREE.AnimationClip[]>([])
  const isPlayingRef = useRef(false)

  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('Choose a GLB file to preview.')
  const [error, setError] = useState('')
  const [clipNames, setClipNames] = useState<string[]>([])
  const [selectedClip, setSelectedClip] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b1020)

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      1000
    )
    camera.position.set(2.5, 1.8, 4.5)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.target.set(0, 1, 0)
    controls.update()

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8)
    scene.add(ambientLight)

    const mainLight = new THREE.DirectionalLight(0xffffff, 2.4)
    mainLight.position.set(4, 7, 5)
    scene.add(mainLight)

    const rimLight = new THREE.DirectionalLight(0x9fc4ff, 1.5)
    rimLight.position.set(-5, 3, -4)
    scene.add(rimLight)

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(8, 64),
      new THREE.MeshStandardMaterial({
        color: 0x172033,
        metalness: 0.05,
        roughness: 0.9,
      })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.02
    scene.add(ground)

    const grid = new THREE.GridHelper(10, 20, 0x3b82f6, 0x334155)
    scene.add(grid)

    const clock = new THREE.Clock()

    const renderFrame = () => {
      const delta = clock.getDelta()
      if (mixerRef.current && isPlayingRef.current) {
        mixerRef.current.update(delta)
      }
      controls.update()
      renderer.render(scene, camera)
      viewerRef.current!.frameId = window.requestAnimationFrame(renderFrame)
    }

    viewerRef.current = {
      scene,
      camera,
      renderer,
      controls,
      clock,
      frameId: window.requestAnimationFrame(renderFrame),
    }

    const handleResize = () => {
      const nextContainer = containerRef.current
      const viewer = viewerRef.current
      if (!nextContainer || !viewer) {
        return
      }

      viewer.camera.aspect = nextContainer.clientWidth / Math.max(nextContainer.clientHeight, 1)
      viewer.camera.updateProjectionMatrix()
      viewer.renderer.setSize(nextContainer.clientWidth, nextContainer.clientHeight)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)

      if (viewerRef.current?.frameId != null) {
        window.cancelAnimationFrame(viewerRef.current.frameId)
      }

      actionsRef.current.forEach((action) => action.stop())
      actionsRef.current = []
      clipsRef.current = []
      mixerRef.current = null

      if (loadedSceneRef.current) {
        scene.remove(loadedSceneRef.current)
        disposeObject(loadedSceneRef.current)
        loadedSceneRef.current = null
      }

      scene.remove(ground)
      disposeObject(ground)

      viewerRef.current?.controls.dispose()
      viewerRef.current?.renderer.dispose()
      renderer.domElement.remove()
      viewerRef.current = null
    }
  }, [])

  const resetModel = () => {
    const viewer = viewerRef.current
    if (!viewer) {
      return
    }

    actionsRef.current.forEach((action) => action.stop())
    actionsRef.current = []
    clipsRef.current = []
    mixerRef.current = null

    if (loadedSceneRef.current) {
      viewer.scene.remove(loadedSceneRef.current)
      disposeObject(loadedSceneRef.current)
      loadedSceneRef.current = null
    }
  }

  const playClip = (clipName: string, shouldPlay = true) => {
    const clip = clipsRef.current.find((entry) => entry.name === clipName)
    if (!clip || !mixerRef.current) {
      setIsPlaying(false)
      return
    }

    actionsRef.current.forEach((action) => action.stop())
    const action = mixerRef.current.clipAction(clip)
    action.reset()
    action.setLoop(THREE.LoopRepeat, Infinity)
    action.clampWhenFinished = false
    actionsRef.current = [action]

    if (shouldPlay) {
      action.play()
      setIsPlaying(true)
      return
    }

    setIsPlaying(false)
  }

  const handleClipChange = (clipName: string) => {
    setSelectedClip(clipName)
    playClip(clipName, true)
  }

  const handleTogglePlayback = () => {
    const currentAction = actionsRef.current[0]
    if (!currentAction) {
      return
    }

    if (isPlaying) {
      currentAction.paused = true
      setIsPlaying(false)
      return
    }

    currentAction.paused = false
    currentAction.play()
    setIsPlaying(true)
  }

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const viewer = viewerRef.current
    if (!viewer) {
      setError('Viewer is not ready yet.')
      return
    }

    setIsLoading(true)
    setError('')
    setStatus(`Loading ${file.name}...`)
    setFileName(file.name)
    setClipNames([])
    setSelectedClip('')
    setIsPlaying(false)

    resetModel()

    try {
      const arrayBuffer = await file.arrayBuffer()
      const loader = new GLTFLoader()
      const gltf = (await loader.parseAsync(arrayBuffer, '')) as GLTF
      const model = gltf.scene

      model.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (!mesh.isMesh) {
          return
        }

        mesh.castShadow = true
        mesh.receiveShadow = true
      })

      viewer.scene.add(model)
      loadedSceneRef.current = model
      frameObject(model, viewer.camera, viewer.controls)

      const clips = gltf.animations ?? []
      clipsRef.current = clips

      if (clips.length === 0) {
        setStatus(`Loaded ${file.name}. No animations found.`)
        return
      }

      const normalizedClipNames = clips.map((clip, index) => clip.name || `Animation ${index + 1}`)
      const normalizedClips = clips.map((clip, index) => {
        if (clip.name) {
          return clip
        }

        const clonedClip = clip.clone()
        clonedClip.name = normalizedClipNames[index]
        return clonedClip
      })

      clipsRef.current = normalizedClips
      mixerRef.current = new THREE.AnimationMixer(model)
      setClipNames(normalizedClipNames)
      setSelectedClip(normalizedClipNames[0])
      playClip(normalizedClipNames[0], true)
      setStatus(`Loaded ${file.name}. Found ${normalizedClipNames.length} animation${normalizedClipNames.length === 1 ? '' : 's'}.`)
    } catch (unknownError) {
      console.error('Failed to load GLB file', unknownError)
      resetModel()
      setClipNames([])
      setSelectedClip('')
      setIsPlaying(false)
      setError('Could not load this GLB file.')
      setStatus('Choose a GLB file to preview.')
    } finally {
      setIsLoading(false)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 px-5 py-4 backdrop-blur sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link to="/" className="text-sm text-sky-300 underline underline-offset-4 hover:text-sky-200">
              Back to Menu
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-white">anim_viewer</h1>
            <p className="mt-1 text-sm text-slate-400">
              Upload a local GLB file, inspect its animation clips, and play one.
            </p>
          </div>

          <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-100 transition hover:border-sky-300 hover:bg-sky-500/20">
            <input
              ref={inputRef}
              type="file"
              accept=".glb,model/gltf-binary"
              className="hidden"
              onChange={handleFileUpload}
            />
            Upload GLB
          </label>
        </header>

        <section className="grid flex-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Controls</h2>

            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">File</div>
                <div className="mt-2 text-sm text-slate-200">{fileName || 'No file loaded'}</div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Status</div>
                <div className="mt-2 text-sm text-slate-300">{isLoading ? 'Loading...' : status}</div>
                {error ? <div className="mt-2 text-sm text-rose-300">{error}</div> : null}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Animation</div>
                {clipNames.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    <select
                      value={selectedClip}
                      onChange={(event) => handleClipChange(event.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
                    >
                      {clipNames.map((clipName) => (
                        <option key={clipName} value={clipName}>
                          {clipName}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleTogglePlayback}
                      className="w-full rounded-xl bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                    >
                      {isPlaying ? 'Pause' : 'Play'}
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-slate-500">No animations loaded.</div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-400">
                Drag is not required. Use the mouse to orbit and inspect the model after upload.
              </div>
            </div>
          </aside>

          <section className="flex min-h-[420px] flex-col overflow-hidden rounded-[2rem] border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_rgba(15,23,42,0.95)_50%)]">
            <div className="border-b border-slate-800 px-5 py-3 text-sm text-slate-400">
              Viewer
            </div>
            <div ref={containerRef} className="min-h-[420px] flex-1" />
          </section>
        </section>
      </div>
    </main>
  )
}
