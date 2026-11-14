// VESPER — the Consensus. No body: a face assembled from thousands of city
// screens hanging in the sky. Variants: idle, speaking, hurt (glitch), calm.
import { RAMPS } from '../../src/art/palette.ts';
import { PixelCanvas, hash2 } from './pixel.ts';

type Item = { name: string; c: PixelCanvas };
const W = 224;
const H = 156;
const TW = 8;
const TH = 6;

/** Face luminance field (0 = no screen, 0.05..1 = brightness). */
function field(x: number, y: number, mood: 'idle' | 'speak' | 'hurt' | 'calm'): number {
  const cx = W / 2;
  const nx = (x - cx) / 96;
  const ny = (y - 74) / 76;
  const head = nx * nx + ny * ny * 1.15;
  if (head > 1) return 0;
  let v = 0.52 - nx * 0.3 - ny * 0.18; // light from the upper left
  if (ny > 0.55) v -= 0.18; // jaw shadow
  // brow ridge and cheekbones catch the light
  if (y > 38 && y < 46 && Math.abs(Math.abs(x - cx) - 38) < 26) v += 0.22;
  if (y > 80 && y < 90 && Math.abs(Math.abs(x - cx) - 46) < 14) v += 0.16;
  // eye sockets + eyes
  for (const side of [-1, 1]) {
    const ex = cx + side * 38;
    const ey = mood === 'calm' ? 62 : 58;
    const dx = (x - ex) / 22;
    const dy = (y - ey) / (mood === 'calm' ? 5 : mood === 'hurt' ? 9 : 11);
    const d = dx * dx + dy * dy;
    if (d < 2.6) v -= 0.5 * (1 - d / 2.6);
    if (d < 1) v = mood === 'calm' ? 0.85 : 0.98;
    if (d < 0.18 && mood !== 'calm') v = 0.06; // pupil
  }
  // nose shadow
  if (Math.abs(x - cx - 4) < 7 && y > 72 && y < 100) v -= 0.12;
  // mouth
  const my = mood === 'speak' ? 116 : 112;
  const mh = mood === 'speak' ? 12 : 3;
  if (Math.abs(x - cx) < 36 && Math.abs(y - my) < mh) v = mood === 'speak' ? 0.07 : 0.15;
  return Math.max(0.05, Math.min(1, v));
}

function face(mood: 'idle' | 'speak' | 'hurt' | 'calm'): PixelCanvas {
  const c = new PixelCanvas(W, H);
  const ramp = mood === 'calm' ? [0x2a1a10, 0x5a3a1a, 0x9a6a2a, 0xd8a050, 0xffd890, 0xfff4d0] : mood === 'hurt' ? [0x200810, 0x4a0e20, 0x8a1a32, 0xd42a42, 0xff8080, 0xffd0d0] : [0x06101a, 0x0e2a3a, 0x18506a, 0x3a90aa, 0x8ad8e8, 0xf0fffe];
  for (let ty = 0; ty < H; ty += TH) {
    for (let tx = 0; tx < W; tx += TW) {
      const glitch = mood === 'hurt' && hash2(tx, ty, 9) > 0.86 ? (hash2(ty, tx, 3) - 0.5) * 14 : 0;
      const v = field(tx + TW / 2 + glitch, ty + TH / 2, mood);
      if (v <= 0) continue;
      // a few screens are dark (broken) or show something else
      const h = hash2(tx, ty, 21);
      if (h > 0.97) continue;
      const idx = Math.min(ramp.length - 1, Math.floor(v * ramp.length));
      for (let y = 0; y < TH - 1; y++) {
        for (let x = 0; x < TW - 1; x++) {
          let col = ramp[idx];
          if (y === 0 && x < TW - 2) col = ramp[Math.min(ramp.length - 1, idx + 1)];
          if ((x + y + Math.floor(h * 7)) % 9 === 0) col = ramp[Math.max(0, idx - 1)];
          c.set(tx + x, ty + y, col);
        }
      }
      // bezel
      for (let x = 0; x < TW - 1; x++) c.set(tx + x, ty + TH - 1, 0x050308);
      for (let y = 0; y < TH; y++) c.set(tx + TW - 1, ty + y, 0x050308);
    }
  }
  return c;
}

function eye(open: boolean, hurt: boolean): PixelCanvas {
  const c = new PixelCanvas(40, 20);
  for (let y = 0; y < 20; y++)
    for (let x = 0; x < 40; x++) {
      const d = Math.pow((x - 19.5) / 19.5, 2) + Math.pow((y - 9.5) / (open ? 9.5 : 2.5), 2);
      if (d > 1) continue;
      let col = hurt ? RAMPS.crimson[5] : 0xf0fffe;
      if (d > 0.7) col = hurt ? RAMPS.crimson[3] : RAMPS.cyan[4];
      if (open && Math.hypot(x - 19.5, y - 9.5) < 4.5) col = 0x06101a;
      if (open && Math.hypot(x - 18, y - 8) < 1.5) col = 0xffffff;
      if (x % 8 === 7 || y % 6 === 5) col = 0x050308;
      c.set(x, y, col);
    }
  return c;
}

export function buildBoss3(): Item[] {
  const out: Item[] = [];
  for (const m of ['idle', 'speak', 'hurt', 'calm'] as const) out.push({ name: `face_${m}`, c: face(m) });
  out.push({ name: 'eye_open', c: eye(true, false) });
  out.push({ name: 'eye_hurt', c: eye(true, true) });
  out.push({ name: 'eye_shut', c: eye(false, false) });
  // loose screen tiles for dissolve / debris
  for (let i = 0; i < 3; i++) {
    const t = new PixelCanvas(TW - 1, TH - 1);
    const col = [0x8ad8e8, 0xffd890, 0xd42a42][i];
    t.fillRect(0, 0, TW - 1, TH - 1, col);
    t.fillRect(0, 0, TW - 2, 1, 0xffffff);
    out.push({ name: `tile_${i}`, c: t });
  }
  void RAMPS;
  return out;
}

export const FACE_GEOM = { w: W, h: H, eyeL: [W / 2 - 38, 58], eyeR: [W / 2 + 38, 58], mouth: [W / 2, 114] };
