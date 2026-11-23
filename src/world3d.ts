// ===== Chronoshard world in Three.js =====
// Three.js owns the game canvas in 3D mode. Each map is built from diorama.ts's data (ground, walls and roofs,
// standing cards for trees and props) into Three meshes; every frame the game's draw calls fill Frame (characters,
// effects, lights, glows, particles), which become billboards, lights and points here. Lighting is Three's: a
// hemisphere sky, a low western sun with a shadow map, and a pool of point lights. Water is a real mirror (Reflector).
// Post-processing: depth of field from the depth buffer, bloom, then the colour grade, vignette and the UI on top.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { Frame, H, SW, TILE, UIK, VH, VW, canvas, fitResolution, uiCanvas } from './engine.js';
import { CAM_D, Cam, FAR, FOVY, NEAR, SUN } from './camera.js';
import { Dio } from './diorama.js';
import { Space } from './space.js';
import { prepareNormal } from './pixel.js';
import type { MapDef, RGB } from './types.js';

/** light shafts: where each lands relative to the view's centre (art px) and how wide it is; and how long they are */
const SHAFTS: [number, number, number][] = [[-170, -40, 22], [-70, 10, 30], [40, -70, 18], [140, 20, 26], [215, -30, 20]], SHAFT_LEN = 300;
/** A fixed pool keeps the shader variant stable. Each frame uses the strongest nearby lights. */
const POINT_LIGHTS = 16;
const AW = VW * TILE, AH = VH * TILE, MAX_SHADOWS = 32, MAX_POINTS = 700;
/** writes an sRGB 0-255 colour (times k) into `out`; the per-frame code reuses its colours instead of allocating */
const setSrgb = (out: THREE.Color, c: RGB, k = 1) => out.setRGB(c[0] / 255 * k, c[1] / 255 * k, c[2] / 255 * k, THREE.SRGBColorSpace);
/** the sun's slight warmth over the ambient colour */
const SUN_TINT = new THREE.Color(1, 0.96, 0.88);
/** Layer for things the water mirror leaves out: effects, glows, particles, shafts, shards and contact shadows. They are
 * see-through extras whose reflection added little, and some (glows, shafts) skip the depth test and would show
 * through everything in the mirror. The main camera sees layers 0 and 1; the Reflector's camera only layer 0. */
const FX_LAYER = 1;
const fxOnly = <T extends THREE.Object3D>(o: T): T => { o.layers.set(FX_LAYER); return o; };
// scratch objects for updateScene, so a frame allocates nothing
const V_SEE = new THREE.Vector3(), V_NDC = new THREE.Vector3(), V_CENTRE = new THREE.Vector3(), V_TO_CAM = new THREE.Vector3(), V_SIDE = new THREE.Vector3();
const SUN_DIR = new THREE.Vector3(...SUN), BASIS = new THREE.Matrix4(), COL = new THREE.Color();

// ---------- textures and materials ----------
const TEX = new WeakMap<HTMLCanvasElement, THREE.CanvasTexture>();
const FLAT_NORMAL = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
FLAT_NORMAL.needsUpdate = true;
/** Crisp pixel art, or smooth mipmaps for the high-resolution sheet art. */
function canvasTexture(c: HTMLCanvasElement, colour = true, smooth = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c); t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  if (smooth) { t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = 4; }
  else { t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  return t;
}
/** Sprite and UI textures can outlive the current map. */
function tex(c: HTMLCanvasElement, colour = true, smooth = false): THREE.CanvasTexture {
  let t = TEX.get(c);
  if (!t) { t = canvasTexture(c, colour, smooth); TEX.set(c, t); }
  return t;
}
/** shared by every patched material: battle dim, and the drifting cloud shadows (strength per map, and the clock) */
const SHARED = { uDim: { value: 0 }, uClouds: { value: 0 }, uTime: { value: 0 },
  /** see-through: the player on screen (x, y in buffer pixels, radius; radius 0 = off), their distance from the camera, the camera */
  uSee: { value: new THREE.Vector3() }, uSeeDepth: { value: 0 }, uEye: { value: new THREE.Vector3() } };
/** soft cloud shadows: value noise in world space, drifting slowly; 1 where a cloud is overhead */
const CLOUD_GLSL = `
uniform float uClouds, uTime; varying vec3 vCloudW;
float cHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cHash(i), cHash(i + vec2(1, 0)), f.x), mix(cHash(i + vec2(0, 1)), cHash(i + vec2(1, 1)), f.x), f.y); }
float cloudShade(vec2 xz) { if (uClouds <= 0.0) return 0.0; vec2 p = xz / 70.0 + vec2(uTime * 0.035, uTime * 0.012); float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * cNoise(p); p *= 2.03; a *= 0.5; } return smoothstep(0.52, 0.78, v) * uClouds; }
`;
/**
 * small shader tweaks on Three's Lambert material: cloud shadows drift over everything; `dim` darkens scenery during
 * battle focus; `sky` tips normal-mapped cards and characters toward the sky so they read as lit like the ground
 * rather than like a wall facing the camera
 */
function patch(m: THREE.Material, o: { dim?: boolean; sky?: boolean; see?: boolean }): void {
  m.onBeforeCompile = sh => {
    if (o.see) { // scenery between the camera and the player turns see-through around them (screen-door dither)
      Object.assign(sh.uniforms, { uSee: SHARED.uSee, uSeeDepth: SHARED.uSeeDepth, uEye: SHARED.uEye });
      sh.fragmentShader = 'uniform vec3 uSee, uEye; uniform float uSeeDepth;\n' + sh.fragmentShader.replace('void main() {', `void main() {
  if (uSee.z > 0.0 && length(vCloudW - uEye) < uSeeDepth - 6.0 && distance(gl_FragCoord.xy, uSee.xy) < uSee.z
      && mod(floor(gl_FragCoord.x / 2.0) + floor(gl_FragCoord.y / 2.0), 2.0) < 1.0) discard;`);
    }
    sh.uniforms.uClouds = SHARED.uClouds; sh.uniforms.uTime = SHARED.uTime;
    sh.vertexShader = 'varying vec3 vCloudW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vCloudW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    // clouds dim the light reaching a surface (in linear light; 0.62 here is about 0.8 on screen)
    sh.fragmentShader = CLOUD_GLSL + sh.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n  gl_FragColor.rgb *= 1.0 - 0.38 * cloudShade(vCloudW.xz);');
    if (o.dim) {
      sh.uniforms.uDim = SHARED.uDim;
      sh.fragmentShader = 'uniform float uDim;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor.rgb *= 1.0 - uDim * 0.6;');
    }
    if (o.sky) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = normalize(normal + 0.9 * normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));');
  };
  m.customProgramCacheKey = () => 'c' + (o.dim ? 'd' : '') + (o.sky ? 's' : '') + (o.see ? 'v' : '');
}
/** a radial falloff, for glows and contact shadows */
function radial(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
}
/** one time shard: a little lilac crystal with a white-hot core (drawn at 4x, shown about 5 art px across) */
function shardArt(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = 20; const g = c.getContext('2d')!;
  g.fillStyle = '#6a40a0'; g.beginPath(); g.moveTo(10, 0); g.lineTo(18, 10); g.lineTo(10, 20); g.lineTo(2, 10); g.closePath(); g.fill();
  g.fillStyle = '#c890ff'; g.beginPath(); g.moveTo(10, 3); g.lineTo(15, 10); g.lineTo(10, 17); g.lineTo(5, 10); g.closePath(); g.fill();
  g.fillStyle = '#ffffff'; g.fillRect(8, 8, 4, 4); return c;
}
/** a light shaft: warm, fading in from the sky end, strongest through the middle, softening where it meets the ground */
function shaft(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 32; c.height = 128; const g = c.getContext('2d')!;
  const v = g.createLinearGradient(0, 0, 0, 128);
  v.addColorStop(0, 'rgba(255,240,190,0)'); v.addColorStop(0.3, 'rgba(255,240,190,0.9)'); v.addColorStop(0.75, 'rgba(255,240,190,0.7)'); v.addColorStop(1, 'rgba(255,240,190,0)');
  g.fillStyle = v; g.fillRect(0, 0, 32, 128);
  g.globalCompositeOperation = 'destination-in'; const h = g.createLinearGradient(0, 0, 32, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.5, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = h; g.fillRect(0, 0, 32, 128);
  return c;
}

// ---------- post-processing passes ----------
/** depth of field: sharp at the camera's focus distance, a disc blur growing in front of and behind it */
class DofPass extends Pass {
  quad: FullScreenQuad; mat: THREE.ShaderMaterial; strength = 0.85;
  constructor() {
    super();
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uFocus: { value: CAM_D }, uNF: { value: new THREE.Vector2(NEAR, FAR) }, uK: { value: 0.85 }, uPx: { value: new THREE.Vector2() } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse, tDepth; uniform float uFocus, uK; uniform vec2 uNF, uPx; varying vec2 vUv;
        float lin(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNF.x * uNF.y / (uNF.y + uNF.x - z * (uNF.y - uNF.x)); }
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          float coc = smoothstep(35.0, 230.0, abs(lin(texture2D(tDepth, vUv).r) - uFocus)) * uK;
          if (coc < 0.02) { gl_FragColor = c; return; }
          vec3 acc = c.rgb; float n = 1.0;
          for (int i = 0; i < 8; i++) { float a = float(i) * 2.39996, r = sqrt((float(i) + 0.5) / 8.0);
            acc += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * r * coc * uPx).rgb; n += 1.0; }
          gl_FragColor = vec4(acc / n, c.a);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.mat);
  }
  override render(renderer: THREE.WebGLRenderer, write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget): void {
    const u = this.mat.uniforms; u.tDiffuse.value = read.texture; u.tDepth.value = read.depthTexture; u.uK.value = this.strength;
    u.uPx.value.set(7 / SW, 7 / H);
    renderer.setRenderTarget(this.renderToScreen ? null : write); this.quad.render(renderer);
  }
}
/** the colour grade (per era), vignette and dither on the world, then the UI layer laid over everything */
class FinalPass extends Pass {
  quad: FullScreenQuad; mat: THREE.ShaderMaterial; ui: THREE.CanvasTexture;
  constructor() {
    super();
    this.ui = new THREE.CanvasTexture(uiCanvas); this.ui.colorSpace = THREE.NoColorSpace; this.ui.minFilter = this.ui.magFilter = THREE.LinearFilter; this.ui.generateMipmaps = false;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tUI: { value: this.ui }, uWorld: { value: 0 }, uLift: { value: new THREE.Vector3() }, uGain: { value: new THREE.Vector3(1, 1, 1) },
        uSat: { value: 1 }, uCon: { value: 1 }, uVig: { value: 0.42 }, uT: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse, tUI; uniform float uWorld, uSat, uCon, uVig, uT; uniform vec3 uLift, uGain; varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        vec3 softClip(vec3 c) { vec3 t = vec3(0.78); vec3 o = max(c - t, 0.0); return min(c, t) + (1.0 - t) * (1.0 - exp(-o / (1.0 - t))); }
        void main() {
          vec3 c = vec3(0.0);
          if (uWorld > 0.5) {
            c = texture2D(tDiffuse, vUv).rgb;
            c *= uGain; c += uLift * (1.0 - clamp(c, 0.0, 1.0));
            float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, uSat);
            c = (c - 0.5) * uCon + 0.5; c = softClip(max(c, 0.0));
            c *= 1.0 - smoothstep(0.38, 0.82, length((vUv - 0.5) * vec2(1.0, 0.9))) * uVig;
            c += (hash(gl_FragCoord.xy + fract(uT) * 91.0) - 0.5) / 255.0;
          }
          vec4 ui = texture2D(tUI, vUv);
          gl_FragColor = vec4(c * (1.0 - ui.a) + ui.rgb * ui.a, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.mat);
  }
  override render(renderer: THREE.WebGLRenderer, write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget): void {
    this.mat.uniforms.tDiffuse.value = read.texture; this.ui.needsUpdate = true;
    renderer.setRenderTarget(this.renderToScreen ? null : write); this.quad.render(renderer);
  }
}

/**
 * water: Three's Reflector renders the mirrored scene; this shader lays it over the water art (so it reads as water,
 * not a sheet of sky) with a gentle ripple
 */
const WATER_SHADER = {
  name: 'ChronoWater',
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, tGround: { value: null }, uRect: { value: new THREE.Vector4() }, uT: { value: 0 } },
  vertexShader: `
    uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
    void main() { vUv = textureMatrix * vec4(position, 1.0); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform vec3 color; uniform sampler2D tDiffuse, tGround; uniform vec4 uRect; uniform float uT; varying vec4 vUv; varying vec3 vW;
    void main() {
      vec2 g = (vW.xz - uRect.xy) / uRect.zw;
      vec3 w = texture2D(tGround, vec2(g.x, 1.0 - g.y)).rgb;
      vec2 rip = vec2(sin(vW.z * 0.9 + uT * 3.0), cos(vW.x * 0.7 + uT * 2.0)) * 0.004 * vUv.w;
      vec3 r = texture2DProj(tDiffuse, vec4(vUv.xy + rip, vUv.zw)).rgb;
      float glint = pow(max(0.0, sin(vW.x * 0.55 + uT * 2.1) * sin(vW.z * 1.2 - uT * 1.6)), 30.0);
      vec3 c = mix(w, r * color, 0.4) + glint * 0.35;
      // the pixel ripples from the 2D game: on each water tile two light dashes drift across, and now and then a
      // white sparkle; worked out on the art-pixel grid so they stay crisp
      vec2 px = floor(vW.xz), T = floor(px / 16.0) * 16.0, l = px - T;
      float ph = uT * 1.4 + (T.x + T.y * 0.6) * 0.05;
      for (int i = 0; i < 2; i++) {
        float fi = float(i), off = mod(ph * 6.0 + fi * 8.0 + T.y * 0.3, 16.0), x0 = floor(mod(off + fi * 5.0, 12.0) + 2.0);
        if (l.y == 4.0 + fi * 6.0 && l.x >= x0 && l.x < x0 + 4.0) c = mix(c, vec3(0.162, 0.479, 0.871), 0.75); // #70b8f0
      }
      if (sin(uT * 3.0 + T.x * 0.7 + T.y * 1.3) > 0.97 && l == vec2(mod(T.x * 3.0, 12.0) + 2.0, mod(T.y * 5.0, 10.0) + 3.0)) c = vec3(1.0);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};
/** a map turned into Three meshes */
interface MapScene {
  id: string; group: THREE.Group; ground: THREE.MeshLambertMaterial; walls: THREE.MeshLambertMaterial;
  water: THREE.ShaderMaterial | null; textures: THREE.CanvasTexture[];
}

function disposeMap(map: MapScene): void {
  map.group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    if (object instanceof Reflector) object.dispose(); // owns the reflection target and its shader material
    else for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
  });
  for (const texture of map.textures) texture.dispose();
}

export const World3D = {
  ok: false,
  renderer: null as THREE.WebGLRenderer | null, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(FOVY * 180 / Math.PI, AW / AH, NEAR, FAR),
  composer: null as EffectComposer | null, passes: {} as { render: RenderPass; dof: DofPass; bloom: UnrealBloomPass; output: OutputPass; final: FinalPass },
  hemi: new THREE.HemisphereLight(), sun: new THREE.DirectionalLight(), points: [] as THREE.PointLight[],
  map: null as MapScene | null, size: [0, 0],
  sprites: [] as THREE.Mesh[], effects: [] as THREE.Mesh[], shadows: [] as THREE.Mesh[], glows: [] as THREE.Sprite[], shafts: [] as THREE.Mesh[],
  dust: null as THREE.Points | null, sparks: null as THREE.Points | null,
  shardSprites: [] as THREE.Sprite[], shardMat: null as THREE.SpriteMaterial | null,
  spriteMats: new WeakMap<HTMLCanvasElement, THREE.MeshLambertMaterial>(), effectMats: new WeakMap<HTMLCanvasElement, THREE.MeshBasicMaterial>(),
  radialTex: null as THREE.CanvasTexture | null,
  fog: new THREE.Fog(0x000000, CAM_D + 120, CAM_D + 760), sky: new THREE.Color(),

  init(): boolean {
    try {
      const r = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
      r.setPixelRatio(1); r.toneMapping = THREE.NoToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
      r.shadowMap.autoUpdate = false; // render() requests the shadow update for each world frame
      this.renderer = r;
    } catch (e) { console.error(e); return false; }
    const S = this.scene;
    S.add(this.hemi, this.sun, this.sun.target); S.fog = this.fog; S.background = this.sky;
    this.camera.layers.enable(FX_LAYER);
    const sh = this.sun.shadow; sh.mapSize.set(2048, 2048); sh.bias = -0.0004; sh.normalBias = 1.2;
    Object.assign(sh.camera, { left: -420, right: 420, top: 420, bottom: -420, near: 10, far: 2400 }); sh.camera.updateProjectionMatrix();
    this.sun.castShadow = true;
    for (let i = 0; i < POINT_LIGHTS; i++) { const p = new THREE.PointLight(0xffffff, 0, 60, 1); this.points.push(p); S.add(p); }
    this.radialTex = tex(radial(), true, true);
    // ambient particles and spell debris: two point clouds (one glowing)
    const pts = (add: boolean) => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 3), 3));
      const p = new THREE.Points(g, new THREE.PointsMaterial({ size: add ? 2.2 : 1.6, vertexColors: true, transparent: true, depthWrite: false, opacity: 0.95, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
      p.frustumCulled = false; S.add(fxOnly(p)); return p;
    };
    this.dust = pts(false); this.sparks = pts(true);
    // light shafts slanting down along the sun's direction (forest and village); placed each frame
    const shaftTex = tex(shaft(), true, true);
    for (let i = 0; i < SHAFTS.length; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(SHAFTS[i][2], SHAFT_LEN), new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
      m.visible = false; m.renderOrder = 15; m.frustumCulled = false; this.shafts.push(m); S.add(fxOnly(m));
    }
    this.resize();
    this.ok = true;
    return true;
  },
  /** Resize final output with the UI. The 3D world and its effects use the base resolution. */
  resize(): void {
    fitResolution();
    const w = SW * UIK, h = H * UIK, r = this.renderer!;
    if (this.size[0] === w && this.size[1] === h && this.composer) return;
    this.size = [w, h]; r.setSize(w, h, false);
    if (!this.composer) {
      const rt = new THREE.WebGLRenderTarget(SW, H, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(SW, H) });
      const c = new EffectComposer(r, rt);
      const render = new RenderPass(this.scene, this.camera), dof = new DofPass();
      const bloom = new UnrealBloomPass(new THREE.Vector2(SW, H), 0.55, 0.6, 0.92), output = new OutputPass(), final = new FinalPass();
      [render, dof, bloom, output, final].forEach(p => c.addPass(p));
      this.composer = c; this.passes = { render, dof, bloom, output, final };
    }
  },

  /** builds (once per visit) the meshes for a map */
  loadMap(map: MapDef): MapScene {
    if (this.map?.id === map.id) return this.map;
    const previous = this.map;
    const d = Dio.get(map), group = new THREE.Group();
    const textures: THREE.CanvasTexture[] = [];
    const mapTexture = (canvas: HTMLCanvasElement, colour = true) => {
      const texture = canvasTexture(canvas, colour);
      textures.push(texture);
      return texture;
    };
    // The cached mask leaves holes for mirror water and the void.
    const groundMap = mapTexture(d.ground), emissiveMap = mapTexture(d.emis);
    const ground = new THREE.MeshLambertMaterial({ map: groundMap, alphaMap: mapTexture(d.groundMask, false), alphaTest: 0.5, emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.4 });
    patch(ground, { dim: true });
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(d.w, d.h), ground);
    gm.rotation.x = -Math.PI / 2; gm.position.set(d.ox + d.w / 2, 0, d.oz + d.h / 2); gm.receiveShadow = true; group.add(gm);
    // walls, roofs, ruins blocks and cliffs; standing cards
    const geo = (data: Float32Array) => {
      const n = data.length / 8, pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), nrm = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pos.set(data.subarray(i * 8, i * 8 + 3), i * 3); uv[i * 2] = data[i * 8 + 3]; uv[i * 2 + 1] = 1 - data[i * 8 + 4]; nrm.set(data.subarray(i * 8 + 5, i * 8 + 8), i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      return g;
    };
    const walls = new THREE.MeshLambertMaterial({ map: mapTexture(d.art), side: THREE.DoubleSide, emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.4 });
    patch(walls, { dim: true, see: true });
    const wm = new THREE.Mesh(geo(d.walls), walls); wm.castShadow = wm.receiveShadow = true; group.add(wm);
    const cards = new THREE.MeshLambertMaterial({ map: mapTexture(d.props), normalMap: mapTexture(d.propsN, false), normalScale: new THREE.Vector2(1, -1), alphaTest: 0.5, side: THREE.DoubleSide });
    patch(cards, { dim: true, sky: true, see: true });
    const cm = new THREE.Mesh(geo(d.cards), cards); cm.castShadow = cm.receiveShadow = true; group.add(cm);
    // water: a mirror under the holes in the ground, made of the water tiles
    let water: THREE.ShaderMaterial | null = null;
    if (d.water.length) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(d.water, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(d.water.length / 3 * 2), 2));
      const mirror = new Reflector(g, { color: 0xa8c4e8, textureWidth: 1024, textureHeight: 576, clipBias: 0.003, shader: WATER_SHADER });
      mirror.rotation.x = -Math.PI / 2; mirror.position.y = -0.05; group.add(mirror);
      // the reflection is rendered from another camera: no see-through holes in it
      const mirrorRender = mirror.onBeforeRender.bind(mirror);
      mirror.onBeforeRender = (...a: Parameters<THREE.Object3D['onBeforeRender']>) => { const z = SHARED.uSee.value.z; SHARED.uSee.value.z = 0; mirrorRender(...a); SHARED.uSee.value.z = z; };
      water = mirror.material as THREE.ShaderMaterial; water.uniforms.tGround.value = groundMap; water.uniforms.uRect.value.set(d.ox, d.oz, d.w, d.h);
    }
    this.scene.add(group);
    this.map = { id: map.id, group, ground, walls, water, textures };
    if (previous) { this.scene.remove(previous.group); disposeMap(previous); }
    return this.map;
  },

  /** a mesh from a pool, created on demand */
  pooled<T extends THREE.Object3D>(pool: T[], i: number, make: () => T): T { if (!pool[i]) { pool[i] = make(); this.scene.add(pool[i]); } pool[i].visible = true; return pool[i]; },
  /** a sprite's material (cached per image); glow makes it partly self-lit (wisps, the Hollow King) */
  spriteMaterial(img: HTMLCanvasElement, scale: number, glow = 0): THREE.MeshLambertMaterial {
    let m = this.spriteMats.get(img);
    if (!m) {
      const smooth = scale < 1, map = tex(img, true, smooth);
      const material = new THREE.MeshLambertMaterial({ map, normalMap: FLAT_NORMAL, normalScale: new THREE.Vector2(1, -1), alphaTest: 0.5, side: THREE.DoubleSide,
        ...(glow ? { emissiveMap: map, emissive: 0xffffff, emissiveIntensity: glow } : {}) });
      patch(material, { sky: true }); this.spriteMats.set(img, material);
      void prepareNormal(img, 3.5 / (smooth ? scale : 1)).then(normal => {
        material.normalMap = tex(normal, false, smooth);
      }).catch(err => console.warn('Sprite normal unavailable', err));
      m = material;
    }
    return m;
  },
  /** sets a pooled quad's corners: x0..x1 across, y0..y1 up, at depth z; v0..v1 the image rows it shows */
  quad(m: THREE.Mesh, x0: number, x1: number, y0: number, y1: number, z: number, vTop = 1, vBot = 0): void {
    const p = m.geometry.attributes.position as THREE.BufferAttribute, uv = m.geometry.attributes.uv as THREE.BufferAttribute;
    p.setXYZ(0, x0, y1, z); p.setXYZ(1, x1, y1, z); p.setXYZ(2, x0, y0, z); p.setXYZ(3, x1, y0, z); p.needsUpdate = true;
    uv.setXY(0, 0, vTop); uv.setXY(1, 1, vTop); uv.setXY(2, 0, vBot); uv.setXY(3, 1, vBot); uv.needsUpdate = true;
    // no bounding sphere: pooled quads are never frustum-culled or ray-picked, so it would be wasted work
  },

  /** draws a frame: the 3D world (when the game drew one) under the UI */
  render(): void {
    if (!this.ok) return;
    this.resize();
    const F = Frame, P = this.passes, world = F.world && !!F.map;
    P.render.enabled = P.dof.enabled = P.bloom.enabled = P.output.enabled = world;
    const fu = P.final.mat.uniforms; fu.uWorld.value = world ? 1 : 0; fu.uT.value = F.t;
    if (world) {
      this.updateScene();
      const G = F.grade; fu.uLift.value.set(...G.lift); fu.uGain.value.set(...G.gain); fu.uSat.value = G.sat; fu.uCon.value = G.con;
      P.dof.strength = F.dof; P.bloom.strength = 0.55 * F.bloom;
      this.renderer!.shadowMap.needsUpdate = true;
    }
    this.composer!.render();
  },

  /** brings the scene up to date with this frame's Frame data */
  updateScene(): void {
    const F = Frame, t = F.t; // every position in Frame is already in world space (space.ts)
    this.loadMap(F.map!);
    // camera: the same one diorama.ts projects the UI with
    Cam.update(F.focusX + F.shakeX, F.focusY + F.shakeY);
    this.camera.position.set(...Cam.eye); this.camera.lookAt(Cam.fx, 0, Cam.fz); this.camera.updateMatrixWorld();
    // sky, sun and haze
    setSrgb(this.sky, F.fog); this.fog.color.copy(this.sky);
    const amb = F.ambient, sunK = F.sun;
    setSrgb(this.hemi.color, amb); setSrgb(this.hemi.groundColor, amb, 0.45); this.hemi.intensity = Math.PI * (1 - 0.5 * sunK);
    setSrgb(this.sun.color, amb).multiply(SUN_TINT); this.sun.intensity = Math.PI * 0.8 * sunK; this.sun.visible = sunK > 0.05;
    this.sun.position.set(Cam.fx + SUN[0] * 900, SUN[1] * 900, Cam.fz - 40 + SUN[2] * 900); this.sun.target.position.set(Cam.fx, 0, Cam.fz - 40); this.sun.target.updateMatrixWorld();
    SHARED.uDim.value = F.dim; SHARED.uClouds.value = F.clouds; SHARED.uTime.value = t;
    const pulse = 1.4 * (0.6 + 0.4 * Math.sin(t * 2.5));
    this.map!.ground.emissiveIntensity = this.map!.walls.emissiveIntensity = pulse;
    if (this.map!.water) this.map!.water.uniforms.uT.value = t;
    // point lights: the strongest near the view (each sits a few px toward the camera, so a glowing creature lights
    // its own front, not just the floor)
    const L = F.lights.map(l => ({ l, w: l.k / (Math.hypot(l.x - Cam.fx, l.z - Cam.fz) + 80) })).sort((a, b) => b.w - a.w).slice(0, POINT_LIGHTS);
    this.points.forEach((p, i) => {
      // an unused light stays in the scene at zero intensity: hiding it would change the light count and recompile every shader
      const e = L[i]; if (!e) { p.intensity = 0; return; }
      p.position.set(e.l.x, e.l.y, e.l.z + 6); setSrgb(p.color, e.l.c); p.distance = e.l.r * 1.15; p.decay = 1; p.intensity = Math.PI * e.l.k * 1.35 * 18;
    });
    // characters, enemies and chests: upright cut-out billboards that catch the light and cast shadows
    this.sprites.forEach(m => m.visible = false);
    F.sprites.forEach((b, i) => {
      const m = this.pooled(this.sprites, i, () => { const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), undefined); q.castShadow = q.receiveShadow = true; q.frustumCulled = false; return q; });
      const k = b.scale, w = b.img.width * k, top = Space.up(b.foot * k);
      m.material = this.spriteMaterial(b.img, k, b.glow); this.quad(m, b.x, b.x + w, 0, top, b.z, 1, 1 - b.foot / b.img.height);
    });
    // see-through: where the player is in the frame and how far from the camera, for the walls' and props' dither
    SHARED.uEye.value.copy(this.camera.position);
    if (F.seeThrough) {
      const p = V_SEE.set(F.seeThrough.x, F.seeThrough.y, F.seeThrough.z), v = V_NDC.copy(p).project(this.camera);
      SHARED.uSee.value.set((v.x + 1) / 2 * SW, (v.y + 1) / 2 * H, 30 * H / AH); SHARED.uSeeDepth.value = p.distanceTo(this.camera.position);
    } else SHARED.uSee.value.z = 0;
    // drawn effect animations: unlit, blended, a little brighter than paint so they bloom
    this.effects.forEach(m => m.visible = false);
    F.effects.forEach((e, i) => {
      const m = this.pooled(this.effects, i, () => { const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), undefined); q.renderOrder = 10; q.frustumCulled = false; return fxOnly(q); });
      let mat = this.effectMats.get(e.img);
      if (!mat) { mat = new THREE.MeshBasicMaterial({ map: tex(e.img, true, e.scale < 1), transparent: true, depthWrite: false, color: new THREE.Color(1.35, 1.35, 1.35), side: THREE.DoubleSide }); this.effectMats.set(e.img, mat); }
      if (e.dynamic) mat.map!.needsUpdate = true;
      mat.opacity = e.alpha; m.material = mat;
      // the pivot sits at the effect's world position; drawn a few px toward the camera, over what it lands on
      const k = e.scale, x0 = e.x - e.px * k, top = e.y + Space.up(e.py * k), bot = top - Space.up(e.img.height * k);
      this.quad(m, x0, x0 + e.img.width * k, bot, top, e.z + 4);
    });
    // soft contact shadows under feet (most useful where the sun is weak)
    this.shadows.forEach(m => m.visible = false);
    F.shadows.slice(0, MAX_SHADOWS).forEach((s, i) => {
      const m = this.pooled(this.shadows, i, () => {
        const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.radialTex!, color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
        q.rotation.x = -Math.PI / 2; q.renderOrder = 1; return fxOnly(q);
      });
      (m.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.3 * (1 - sunK);
      m.position.set(s.x, 0.2, s.z); m.scale.set(s.w + 2, Math.max(5, s.w * 0.56), 1);
    });
    // glows around wisps, the Hollow King and rifts
    this.glows.forEach(g => g.visible = false);
    F.glows.forEach((gl, i) => {
      // drawn over everything near them (a camera-facing glow would otherwise tip back behind the creature's upright sprite)
      const g = this.pooled(this.glows, i, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.radialTex!, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false })); s.renderOrder = 20; return fxOnly(s); });
      const mat = g.material; setSrgb(mat.color, gl.c); mat.opacity = gl.a;
      g.position.set(gl.x, gl.y, gl.z + 3); g.scale.set(gl.r * 2, gl.r * 2, 1);
    });
    // particles: petals, pollen, ash and spell debris (dust) and fireflies, motes, embers (sparks)
    const fill = (pts: THREE.Points, add: boolean) => {
      const P = pts.geometry.attributes.position as THREE.BufferAttribute, C = pts.geometry.attributes.color as THREE.BufferAttribute, col = COL;
      let n = 0;
      for (const p of F.particles) {
        if (p.add !== add || n >= MAX_POINTS) continue;
        P.setXYZ(n, p.x, p.y, p.z); col.set(p.c).multiplyScalar(p.a * (add ? 1.4 : 1)); C.setXYZ(n, col.r, col.g, col.b); n++;
      }
      pts.geometry.setDrawRange(0, n); P.needsUpdate = C.needsUpdate = true;
    };
    fill(this.dust!, false); fill(this.sparks!, true);
    // the Hollow King's time shards: unlit crystals, bright enough to bloom, hidden by him when they swing behind
    const sm = this.shardMat ?? (this.shardMat = new THREE.SpriteMaterial({ map: tex(shardArt(), true, true), color: new THREE.Color(1.6, 1.5, 1.7), alphaTest: 0.4, depthWrite: false }));
    this.shardSprites.forEach(s => s.visible = false);
    F.shards.forEach((d, i) => { const s = this.pooled(this.shardSprites, i, () => { const q = new THREE.Sprite(sm); q.scale.set(5, 5, 1); q.renderOrder = 11; return fxOnly(q); }); s.position.set(d.x, d.y, d.z); });
    // light shafts in the forest and village: each runs along the sun's direction down to a spot on the ground in
    // view (drifting slowly), turned about that line to face the camera, and shimmers gently
    const up = SUN_DIR;
    this.shafts.forEach((m, i) => {
      m.visible = F.rays > 0;
      if (!m.visible) return;
      const [dx, dz] = SHAFTS[i], gx = Cam.fx + dx + Math.sin(t * 0.15 + i * 1.7) * 6, gz = Cam.fz + dz;
      const centre = V_CENTRE.set(gx, 0, gz).addScaledVector(up, SHAFT_LEN / 2 - 10);
      const toCam = V_TO_CAM.copy(this.camera.position).sub(centre); toCam.addScaledVector(up, -toCam.dot(up)).normalize();
      BASIS.makeBasis(V_SIDE.crossVectors(up, toCam), up, toCam); m.quaternion.setFromRotationMatrix(BASIS); m.position.copy(centre);
      (m.material as THREE.MeshBasicMaterial).opacity = (0.16 + 0.06 * Math.sin(t * 0.5 + i * 2.1)) * F.rays;
    });
  },
};
