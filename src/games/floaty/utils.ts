/**
 * Collects Three.js meshes from all solid entities in the scene.
 * Targets elements with `static-body` attribute or `.solid` class.
 * Results are cached on `window` and refreshed every ~2 seconds.
 */
export function collectSolidMeshes(): any[] {
  const win = window as any
  const now = performance.now()
  if (win.__solidMeshes && now - (win.__solidMeshesStamp || 0) < 2000) {
    return win.__solidMeshes as any[]
  }
  const meshes: any[] = []
  const solidEls = document.querySelectorAll('[static-body], .solid')
  solidEls.forEach((el: any) => {
    const mesh = el.getObject3D ? el.getObject3D('mesh') : null
    if (mesh) meshes.push(mesh)
  })
  win.__solidMeshes = meshes
  win.__solidMeshesStamp = now
  return meshes
}
