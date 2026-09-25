import * as THREE from 'three'

// Muted, desaturated palette so the sky reads as "outdoors" without
// competing with the game's glowing cyan/red/orange accents.
export const SKY_HORIZON_COLOR = new THREE.Color(0xdfe5ea)
export const SKY_ZENITH_COLOR = new THREE.Color(0x7e93a8)

// The dome is a sphere with BackSide faces. It must be added to the camera
// (or otherwise follow it) so the gradient stays anchored to the world
// horizon while the camera pitches and turns.
const VERTEX_SHADER = /* glsl */ `
varying vec3 vViewPosition;

void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = viewPosition.xyz;
  gl_Position = projectionMatrix * viewPosition;
}
`

const FRAGMENT_SHADER = /* glsl */ `
uniform vec3 topColor;
uniform vec3 bottomColor;
varying vec3 vViewPosition;

void main() {
  float height = normalize(vViewPosition).y;
  float t = smoothstep(-0.05, 0.6, height);
  gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
}
`

export class Sky {
  private readonly geometry: THREE.SphereGeometry
  private readonly material: THREE.ShaderMaterial
  readonly mesh: THREE.Mesh

  constructor(radius = 800) {
    this.geometry = new THREE.SphereGeometry(radius, 32, 16)
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: SKY_ZENITH_COLOR },
        bottomColor: { value: SKY_HORIZON_COLOR },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    })
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -1
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
