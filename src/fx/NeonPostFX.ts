import Phaser from 'phaser';

// Full-screen post pass at native 480×270:
//   pixel-aligned chromatic aberration → 3-ring bloom (bright-pass)
//   → ordered-dithered quantisation of the glow (keeps the pixel-art look)
//   → violet shadow grade → dithered vignette → flash / desaturation.
const FRAG = `
#define SHADER_NAME NEON_POST_FS
precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2 uResolution;
uniform float uTime;
uniform float uBloom;
uniform float uAberration;
uniform float uFlash;
uniform float uVignette;
uniform float uDesat;
uniform float uGrade;
uniform float uDanger;

varying vec2 outTexCoord;

float bayer2(vec2 p) {
  return mod(2.0 * p.x + 3.0 * p.y, 4.0);
}
float bayer4(vec2 p) {
  vec2 a = mod(p, 2.0);
  vec2 b = mod(floor(p / 2.0), 2.0);
  return (4.0 * bayer2(a) + bayer2(b) + 0.5) / 16.0;
}

vec3 bright(vec2 uv) {
  vec3 c = texture2D(uMainSampler, uv).rgb;
  float l = max(c.r, max(c.g, c.b));
  return c * smoothstep(0.52, 0.95, l);
}

void main() {
  vec2 uv = outTexCoord;
  vec2 px = 1.0 / uResolution;
  vec2 d = uv - 0.5;
  vec3 col;
  if (uAberration > 0.01) {
    vec2 off = floor(d * uAberration * 10.0 + 0.5) * px;
    col.r = texture2D(uMainSampler, uv + off).r;
    col.g = texture2D(uMainSampler, uv).g;
    col.b = texture2D(uMainSampler, uv - off).b;
  } else {
    col = texture2D(uMainSampler, uv).rgb;
  }

  vec3 glow = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7853982 + 0.3926991;
    vec2 dir = vec2(cos(a), sin(a)) * px;
    glow += bright(uv + dir * 1.5) * 0.55;
    glow += bright(uv + dir * 3.5) * 0.35;
    glow += bright(uv + dir * 7.0) * 0.18;
  }
  glow /= 8.0;
  float dth = bayer4(gl_FragCoord.xy);
  glow = floor(glow * 10.0 + dth) / 10.0;
  col = clamp(col + glow * uBloom, 0.0, 1.0);

  // grade: lift shadows toward violet, gentle S-curve
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 graded = col + vec3(0.025, 0.0, 0.05) * (1.0 - smoothstep(0.0, 0.35, lum));
  graded = mix(graded, graded * graded * (3.0 - 2.0 * graded), 0.25);
  col = mix(col, graded, uGrade);

  // dithered vignette
  float v = smoothstep(0.95, 0.35, length(d * vec2(1.0, 0.75)));
  v = floor(v * 6.0 + dth) / 6.0;
  col *= mix(1.0, v, uVignette);

  lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum) * vec3(0.9, 0.95, 1.1), uDesat);
  // low-health pulse: edges bleed red
  float edge = 1.0 - smoothstep(0.75, 0.2, length(d * vec2(1.0, 0.75)));
  edge = floor(edge * 5.0 + dth) / 5.0;
  col = mix(col, col * vec3(1.15, 0.3, 0.38) + vec3(0.12, 0.0, 0.02), uDanger * edge);
  col = mix(col, vec3(1.0), uFlash);
  gl_FragColor = vec4(col, 1.0);
}
`;

export class NeonPostFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  bloom = 0.9;
  aberration = 0;
  flash = 0;
  vignette = 0.55;
  desat = 0;
  grade = 1;
  danger = 0;

  constructor(game: Phaser.Game) {
    super({ game, name: 'NeonPostFX', fragShader: FRAG });
  }

  override onPreRender(): void {
    this.set2f('uResolution', this.renderer.width, this.renderer.height);
    this.set1f('uTime', this.game.loop.time / 1000);
    this.set1f('uBloom', this.bloom);
    this.set1f('uAberration', this.aberration);
    this.set1f('uFlash', this.flash);
    this.set1f('uVignette', this.vignette);
    this.set1f('uDesat', this.desat);
    this.set1f('uGrade', this.grade);
    this.set1f('uDanger', this.danger);
  }
}
