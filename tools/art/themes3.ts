// Chapter 3 parallax sets — one day in the waking city, morning to dusk:
//   sunroof  — 첫 햇살 옥상가: pale morning sky, rooftops, laundry, solar farms
//   drowned  — 물에 잠긴 하층: flooded streets, reflections
//   avenue   — 소란의 거리: noon, banners and vote screens, crowds
//   transit  — 환승선: afternoon viaducts and far trains
//   lab      — 중계 게이트 연구소: city through the lab's tall windows
//   harbor   — 크레인 항만: sunset sea, ships and cranes
//   clock    — 옛 시계탑: dusk panorama as the lights come on
//   vesper   — 합의: night falls with a storm gathering over the city
import { RAMPS } from '../../src/art/palette.ts';
import { PixelCanvas, RNG, bayer, fbm, hash2, rampDither } from './pixel.ts';
import type { ThemeLayers } from './themes.ts';
import { skyline } from './backgrounds.ts';
import { loadGalmuri, rasterText } from '../lib/bdf.ts';

type Ramp = readonly number[];
const SK = RAMPS.sky;
const SU = RAMPS.stucco;
const MA = RAMPS.marble;
const AM = RAMPS.amber;
const CR = RAMPS.crimson;
const MG = RAMPS.magenta;
const CY = RAMPS.cyan;
const DA = RAMPS.dawn;
const GO = RAMPS.gold;
const VI = RAMPS.violet;
const NI = RAMPS.night;
const wrap = (x: number, w: number) => ((x % w) + w) % w;

function sky(ramp: Ramp, o: { curve?: number; sun?: { x: number; y: number; r: number; core: number; halo: number }; clouds?: number; cloud?: Ramp; seed?: number; stars?: number }): PixelCanvas {
  const c = new PixelCanvas(480, 270);
  for (let y = 0; y < 270; y++) for (let x = 0; x < 480; x++) c.set(x, y, rampDither(ramp, Math.pow(y / 270, o.curve ?? 1), x, y));
  if (o.stars) {
    const r = new RNG(o.seed ?? 1);
    for (let i = 0; i < o.stars; i++) c.set(r.int(0, 479), r.int(0, 120), r.chance(0.3) ? NI[9] : NI[6]);
  }
  if (o.sun) {
    const s = o.sun;
    for (let y = s.y - s.r * 3; y < s.y + s.r * 3; y++)
      for (let x = s.x - s.r * 3; x < s.x + s.r * 3; x++) {
        const d = Math.hypot(x - s.x, y - s.y);
        if (d < s.r) c.set(x, y, s.core);
        else if (d < s.r * 3 && Math.pow(1 - (d - s.r) / (s.r * 2), 2) * 0.7 > bayer(x, y)) c.set(x, y, s.halo);
      }
  }
  if (o.clouds && o.cloud) {
    const cl = o.cloud;
    for (let y = 10; y < 200; y++)
      for (let x = 0; x < 480; x++) {
        const n = fbm(x / 70, y / 14, o.seed ?? 3, 4) - y / 900;
        if (n > 1 - o.clouds) {
          const t = Math.min(1, (n - (1 - o.clouds)) * 6);
          const lit = fbm(x / 40, (y - 3) / 10, (o.seed ?? 3) + 1, 2);
          c.set(x, y, rampDither(cl, 0.3 + t * 0.4 + (lit - 0.5) * 0.4, x, y));
        }
      }
  }
  return c;
}

function haze(c: PixelCanvas, start: number, ramp: Ramp): void {
  for (let y = start; y < c.h; y++) {
    const k = (y - start) / (c.h - start);
    for (let x = 0; x < c.w; x++) if (c.get(x, y) >= 0 && k > bayer(x, y) * 0.9 + 0.05) c.set(x, y, rampDither(ramp, k, x, y));
  }
}

function dayline(seed: number, body: number[], rimL: number, rimR: number, glass: number[], hazeRamp: number[], o: { base?: number; count?: number; w?: [number, number]; h?: [number, number]; height?: number; win?: number } = {}): PixelCanvas {
  const c = skyline({
    width: 960,
    height: o.height ?? 320,
    base: o.base ?? 150,
    seed,
    count: o.count ?? 50,
    wRange: o.w ?? [20, 50],
    hRange: o.h ?? [60, 150],
    body,
    rimL,
    rimR,
    windowP: o.win ?? 0.25,
    windowColors: glass,
    windowSize: [2, 1],
    haze: hazeRamp,
    hazeStart: (o.height ?? 320) - 110,
    neonStrips: 0,
  });
  return c;
}

/** Rooftop clutter: water towers, laundry lines, solar rows. */
function rooftops(seed: number, body: number[], light: number): PixelCanvas {
  const W = 960;
  const H = 340;
  const c = new PixelCanvas(W, H);
  const rng = new RNG(seed);
  let x = 0;
  const tops: { x: number; w: number; top: number }[] = [];
  while (x < W) {
    const w = rng.int(60, 130);
    const top = rng.int(120, 200);
    tops.push({ x, w, top });
    for (let lx = 0; lx < w; lx++) for (let y = top; y < H; y++) c.set(wrap(x + lx, W), y, lx === 0 ? light : lx < 3 ? body[2] : (y - top) % 18 === 0 ? body[0] : body[1]);
    // water tower
    if (rng.chance(0.5)) {
      const tx = x + rng.int(10, w - 26);
      for (let yy = top - 30; yy < top - 10; yy++) for (let xx = 0; xx < 16; xx++) c.set(wrap(tx + xx, W), yy, xx < 3 ? light : body[2]);
      for (let yy = top - 10; yy < top; yy++) {
        c.set(wrap(tx + 2, W), yy, body[2]);
        c.set(wrap(tx + 13, W), yy, body[2]);
      }
      for (let xx = -1; xx < 17; xx++) c.set(wrap(tx + xx, W), top - 31, body[3]);
    }
    // solar rows
    if (rng.chance(0.6)) for (let k = 0; k < 3; k++) {
      const sx = x + 6 + k * 18;
      if (sx + 14 > x + w) break;
      for (let xx = 0; xx < 14; xx++) for (let yy = 0; yy < 4; yy++) c.set(wrap(sx + xx, W), top - 4 + yy - Math.floor(xx / 5), yy === 0 ? SK[5] : SK[1]);
    }
    x += w + rng.int(4, 18);
  }
  // laundry lines between roofs
  for (let i = 0; i < tops.length - 1; i++) {
    const a = tops[i];
    const b = tops[i + 1];
    const y0 = a.top - 18;
    const y1 = b.top - 18;
    const x0 = a.x + a.w - 4;
    const x1 = b.x + 4;
    for (let xx = x0; xx <= x1; xx++) {
      const t = (xx - x0) / Math.max(1, x1 - x0);
      const y = Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * 6);
      c.set(wrap(xx, W), y, body[3]);
      if ((xx - x0) % 9 === 4) {
        const col = [CR[4], SK[4], AM[4], MA[6], MG[5]][Math.floor(hash2(xx, i, seed) * 5)];
        for (let d = 1; d < 6; d++) for (let k = 0; k < 4; k++) c.set(wrap(xx + k - 1, W), y + d, col);
      }
    }
  }
  return c;
}

export function sunroofTheme(): ThemeLayers {
  const s = sky([0x7aa4d4, 0x8cb4dc, 0xa4c4e2, 0xbcd2e6, 0xd4dce4, 0xeee2d4, 0xfae6c4], { sun: { x: 90, y: 200, r: 16, core: 0xfff6e0, halo: 0xffe8b8 }, clouds: 0.22, cloud: [0xb4c8dc, 0xd4dcec, 0xeef0f4, 0xffffff], seed: 1301 });
  const far = dayline(1302, [0x8aa0bc, 0x96acc6, 0xa2b8d0, 0xb4c8dc], 0xd4dce8, 0x8aa0bc, [0xc4d4e4], [0xb4c4d6, 0xc4d0de, 0xd4dce6], { win: 0.06 });
  const mid = rooftops(1303, [0x4a3a3a, 0x5c4844, 0x6e5650, 0x806258], SU[6]);
  haze(mid, 260, [0x7a6a68, 0x8a7a76]);
  const near = new PixelCanvas(960, 400);
  for (let k = 0; k < 6; k++) {
    const x = 60 + k * 170;
    for (let y = 150; y < 400; y++) near.set(x, y, 0x2a2024);
    for (let i = -10; i <= 10; i++) near.set(x + i, 170 + Math.abs(i), 0x2a2024);
    near.set(x, 149, CR[5]);
  }
  return { 'sunroof_sky.png': s, 'sunroof_far.png': far, 'sunroof_mid.png': mid, 'sunroof_near.png': near };
}

export function drownedTheme(): ThemeLayers {
  const s = sky([0x5a84ac, 0x6a94b8, 0x84a8c4, 0x9cb8cc, 0xb4c8d4, 0xc8d4d8], { clouds: 0.3, cloud: [0x8aa0b4, 0xa4b4c4, 0xc4ccd8, 0xdce2ea], seed: 1311 });
  const far = dayline(1312, [0x5a6e84, 0x667a90, 0x72869c, 0x8094a8], 0x9cb0c4, 0x5a6e84, [0x9cb4c8], [0x6a8094, 0x7a90a4, 0x8aa0b0], { win: 0.05 });
  // half-drowned blocks with a mirrored waterline
  const mid = dayline(1313, [0x2a3a44, 0x34464e, 0x3e525a, 0x4a6068], 0x7a9aa4, 0x2a3a44, [0x6a8a94, 0xa4864a], [0x2a3a44, 0x34464e, 0x3e525a], { base: 140, height: 340, h: [80, 170], win: 0.2 });
  const wl = 260;
  for (let y = wl; y < 340; y++)
    for (let x = 0; x < 960; x++) {
      const src = mid.get(wrap(x + Math.round(Math.sin(y * 0.6) * 2), 960), wl - (y - wl) * 2);
      const base = (y - wl) % 6 === 0 ? 0x5a8a94 : 0x2a5a66;
      mid.set(x, y, src >= 0 && (x + y) % 2 === 0 ? 0x3a6a76 : base);
    }
  for (let x = 0; x < 960; x++) mid.set(x, wl, 0xbcf0f4);
  const near = new PixelCanvas(960, 400);
  for (let k = 0; k < 5; k++) {
    const x0 = k * 200 + 40;
    for (let xx = 0; xx < 160; xx++) {
      const y = 60 + Math.round(Math.sin((xx / 160) * Math.PI) * 30);
      near.set(wrap(x0 + xx, 960), y, 0x141c22);
    }
    for (let y = 70; y < 104; y++) for (let xx = 0; xx < 18; xx++) near.set(wrap(x0 + 70 + xx, 960), y, xx === 0 || y === 70 ? 0x2a3a44 : 0x1c262c);
  }
  return { 'drowned_sky.png': s, 'drowned_far.png': far, 'drowned_mid.png': mid, 'drowned_near.png': near };
}

export function avenueTheme(): ThemeLayers {
  const s = sky([0x2a6ab4, 0x3a7ec0, 0x4e92cc, 0x68a6d6, 0x84bade, 0xa4cce4], { sun: { x: 380, y: 30, r: 12, core: 0xffffff, halo: 0xd4ecfa }, clouds: 0.16, cloud: [0xa4c4dc, 0xccdcec, 0xeef4fa, 0xffffff], seed: 1321 });
  const far = dayline(1322, [0x6a88aa, 0x7894b4, 0x86a2c0, 0x96b2cc], 0xbcd0e2, 0x6a88aa, [0xbcd0e2], [0x8aa4c0, 0x9ab2cc, 0xaac0d6], { win: 0.05 });
  const mid = dayline(1323, [0x4a4458, 0x564e64, 0x625a70, 0x706880], MA[5], 0x4a4458, [0x9ab8d0, 0xd0b48a], [0x5a5468, 0x665e74, 0x726a80], { base: 150, height: 340, w: [40, 80], h: [100, 180], win: 0.3 });
  // banners + vote screens
  const font = loadGalmuri('Galmuri11-Bold');
  const rng = new RNG(1324);
  for (let k = 0; k < 5; k++) {
    const x = 60 + k * 190 + rng.int(-20, 20);
    const y = 90 + rng.int(0, 40);
    const yes = k % 2 === 0;
    for (let yy = 0; yy < 26; yy++) for (let xx = 0; xx < 64; xx++) mid.set(wrap(x + xx, 960), y + yy, xx === 0 || xx === 63 || yy === 0 || yy === 25 ? NI[1] : NI[2]);
    rasterText(font, yes ? '잊을 권리' : '기억할 권리', x + 4, y + 7, (px, py) => mid.set(wrap(px, 960), py, yes ? CY[5] : AM[4]));
    // hanging banner
    for (let yy = 0; yy < 40; yy++) for (let xx = 0; xx < 10; xx++) mid.set(wrap(x + 80 + xx, 960), y - 10 + yy, yy % 10 === 9 ? MA[2] : yes ? SK[3] : CR[4]);
  }
  // crowd silhouettes at street level
  for (let x = 0; x < 960; x++) {
    const h = 10 + Math.round(fbm(x / 6, 0, 1325, 2) * 10);
    for (let y = 340 - h; y < 340; y++) mid.set(x, y, (x * 7) % 11 === 0 && y < 340 - h + 3 ? 0x3a3446 : 0x2a2434);
    if (hash2(x, 1, 1326) > 0.985) for (let y = 340 - h - 10; y < 340 - h; y++) mid.set(x, y, 0x2a2434);
  }
  const near = new PixelCanvas(960, 400);
  for (let k = 0; k < 6; k++) {
    const x = 80 + k * 160;
    for (let y = 120; y < 400; y++) {
      near.set(x, y, 0x1a1622);
      near.set(x + 1, y, 0x2a2434);
    }
    for (let i = 0; i < 14; i++) near.set(x - i, 120 + Math.floor(i / 3), 0x1a1622);
    near.set(x - 14, 125, 0xfff4c8);
  }
  return { 'avenue_sky.png': s, 'avenue_far.png': far, 'avenue_mid.png': mid, 'avenue_near.png': near };
}

export function transitTheme(): ThemeLayers {
  const s = sky([0x4a7ab4, 0x5a8abc, 0x72a0c6, 0x8eb2cc, 0xb4c4cc, 0xd6ccbc, 0xe8c8a4], { sun: { x: 420, y: 150, r: 14, core: 0xfff0d0, halo: 0xffd8a0 }, clouds: 0.2, cloud: [0xc4b4b4, 0xdcccc4, 0xf4e4d4, 0xffffff], seed: 1331 });
  const far = dayline(1332, [0x7a7c98, 0x8688a2, 0x9294ac, 0xa2a4b8], 0xdcc8b8, 0x7a7c98, [0xd8c4a8], [0x9a98aa, 0xaaa6b6, 0xbab4c0], { win: 0.06 });
  // elevated viaduct with arches and a distant train
  const mid = new PixelCanvas(960, 340);
  const deck = 150;
  for (let x = 0; x < 960; x++) {
    for (let y = deck; y < deck + 14; y++) mid.set(x, y, y === deck ? MA[4] : y < deck + 3 ? MA[3] : MA[2]);
    const ax = x % 120;
    const archTop = deck + 14 + Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((ax - 60) / 46, 2))) * -0) ;
    for (let y = deck + 14; y < 340; y++) {
      const inArch = Math.abs(ax - 60) < 46 && y > deck + 14 + 46 - Math.sqrt(Math.max(0, 46 * 46 - (ax - 60) * (ax - 60)));
      if (!inArch) mid.set(x, y, ax < 14 || ax > 106 ? MA[2] : MA[1]);
    }
    void archTop;
  }
  for (let x = 300; x < 560; x++) for (let y = deck - 22; y < deck; y++) {
    const car = Math.floor((x - 300) / 65);
    const cx = (x - 300) % 65;
    if (cx > 62) continue;
    mid.set(x, y, y === deck - 22 ? MA[5] : y > deck - 16 && y < deck - 10 && cx % 8 < 5 ? SK[2] : car % 2 ? MA[4] : MA[3]);
  }
  haze(mid, 260, [0x8a8698, 0x9a96a6]);
  const near = new PixelCanvas(960, 400);
  for (let k = 0; k < 8; k++) {
    const x = 50 + k * 120;
    for (let y = 40; y < 400; y++) near.set(x, y, 0x1c1c26);
    for (let i = -16; i <= 16; i++) near.set(x + i, 46, 0x1c1c26);
  }
  for (let x = 0; x < 960; x++) near.set(x, 52 + Math.round(Math.sin((x % 120) / 120 * Math.PI) * 6), 0x2a2a36);
  return { 'transit_sky.png': s, 'transit_far.png': far, 'transit_mid.png': mid, 'transit_near.png': near };
}

export function labTheme(): ThemeLayers {
  const s = sky([0x6a94c4, 0x7aa2cc, 0x90b2d4, 0xaac2d8, 0xc8d0d8], { clouds: 0.22, cloud: [0xb4c4d8, 0xd0dae6, 0xecf0f6, 0xffffff], seed: 1341 });
  // the city seen through tall lab windows
  const far = dayline(1342, [0x7a90ac, 0x869cb6, 0x92a8c0, 0xa2b6cc], 0xc4d4e4, 0x7a90ac, [0xc4d4e4], [0x92a6bc, 0xa2b4c8, 0xb2c2d4], { win: 0.06 });
  for (let y = 0; y < far.h; y++) for (let x = 0; x < 960; x++) if (x % 120 < 10 || y % 90 < 6) far.set(x, y, x % 120 < 2 || y % 90 < 1 ? MA[5] : MA[3]);
  const mid = new PixelCanvas(960, 340);
  // machinery: relay dish, tanks, pipes
  for (let k = 0; k < 4; k++) {
    const x0 = k * 240 + 40;
    for (let yy = 0; yy < 60; yy++) for (let xx = -40; xx <= 40; xx++) {
      if (Math.pow(xx / 40, 2) + Math.pow((yy - 60) / 60, 2) > 1 || yy > 40) continue;
      mid.set(wrap(x0 + xx, 960), 150 + yy, yy < 3 ? MA[6] : xx < -20 ? MA[4] : MA[3]);
    }
    for (let y = 190; y < 340; y++) for (let xx = -4; xx <= 4; xx++) mid.set(wrap(x0 + xx, 960), y, xx < -2 ? MA[4] : MA[2]);
    for (let y = 230; y < 340; y++) for (let xx = 0; xx < 34; xx++) mid.set(wrap(x0 + 80 + xx, 960), y, xx < 4 ? MA[5] : (y - 230) % 30 === 0 ? AM[3] : MA[3]);
  }
  for (let x = 0; x < 960; x++) {
    mid.set(x, 120, MA[2]);
    mid.set(x, 121, SK[3]);
  }
  return { 'lab_sky.png': s, 'lab_far.png': far, 'lab_mid.png': mid };
}

export function harborTheme(): ThemeLayers {
  const s = sky([0x3a2a5a, 0x5a3a66, 0x84466a, 0xb4586a, 0xd8745e, 0xf09a5a, 0xffc06a], { curve: 1.1, sun: { x: 300, y: 210, r: 22, core: 0xfff0c0, halo: 0xffd080 }, clouds: 0.22, cloud: [0x8a4a6a, 0xc0606a, 0xe88a6a, 0xffb478], seed: 1351 });
  // the sea with the sun's road, ships and far cranes
  const far = new PixelCanvas(960, 300);
  const sea = 170;
  for (let y = sea; y < 300; y++)
    for (let x = 0; x < 960; x++) {
      const road = Math.abs(x - 540 + ((y * 7) % 13)) < 8 + (y - sea) * 0.5 && (x + y) % 3 !== 0;
      far.set(x, y, road ? (y % 3 ? 0xffd080 : 0xf0a060) : (y - sea) % 5 === 0 ? 0x6a3a5a : 0x4a2a4a);
    }
  for (let x = 0; x < 960; x++) far.set(x, sea, 0xffb478);
  for (const [sx, w] of [
    [120, 70],
    [700, 110],
  ]) {
    for (let xx = 0; xx < w; xx++) for (let yy = 0; yy < 10; yy++) far.set(sx + xx, sea - 10 + yy, 0x2a1a2a);
    for (let xx = w * 0.6; xx < w * 0.85; xx++) for (let yy = 0; yy < 12; yy++) far.set(sx + Math.round(xx), sea - 22 + yy, 0x2a1a2a);
  }
  for (const cx of [260, 420, 880]) {
    for (let y = 70; y < sea; y++) far.set(cx, y, 0x3a2236);
    for (let x = cx - 50; x < cx + 30; x++) far.set(x, 70, 0x3a2236);
    for (let y = 70; y < 110; y++) far.set(cx - 44, y, 0x3a2236);
  }
  const mid = new PixelCanvas(960, 340);
  const rng = new RNG(1352);
  for (let x = 0; x < 960; ) {
    const w = rng.int(40, 70);
    const stack = rng.int(2, 5);
    for (let k = 0; k < stack; k++) {
      const col = [0x5a1a1e, 0x1a2a4a, 0x1a3a2a, 0x5a3a1a][rng.int(0, 3)];
      for (let xx = 0; xx < w; xx++) for (let yy = 0; yy < 18; yy++) mid.set(wrap(x + xx, 960), 340 - (k + 1) * 18 + yy, xx % 3 === 0 || yy === 0 ? 0x1a0e14 : col);
    }
    x += w + rng.int(0, 10);
  }
  for (const cx of [150, 600]) {
    for (let y = 60; y < 340; y++) for (let xx = 0; xx < 8; xx++) mid.set(cx + xx, y, (y + xx) % 10 === 0 ? 0x2a1a26 : 0x1a0e18);
    for (let x = cx - 120; x < cx + 60; x++) for (let yy = 0; yy < 6; yy++) mid.set(wrap(x, 960), 60 + yy, (x + yy) % 8 === 0 ? 0x2a1a26 : 0x1a0e18);
    for (let y = 66; y < 160; y++) mid.set(cx - 90, y, 0x1a0e18);
  }
  return { 'harbor_sky.png': s, 'harbor_far.png': far, 'harbor_mid.png': mid };
}

export function clockTheme(): ThemeLayers {
  const s = sky([0x1a1636, 0x2a1e48, 0x3e2a5a, 0x5a3466, 0x7e406a, 0xa44e6a, 0xcc6a6a], { curve: 1.2, clouds: 0.18, cloud: [0x3a2a5a, 0x5a3a6a, 0x8a4a6a, 0xc06a6a], seed: 1361, stars: 50 });
  // dusk panorama: windows lighting up
  const far = dayline(1362, [0x2a2244, 0x302650, 0x382c5a, 0x423466], 0x8a5a7a, 0x2a2244, [0xffc870, 0xffe0a0, 0x70c8ff], [0x3a2a5a, 0x46305e, 0x543866], { win: 0.22 });
  const mid = new PixelCanvas(960, 340);
  for (const [cx, w, top] of [
    [180, 60, 40],
    [640, 44, 90],
  ] as const) {
    for (let y = top; y < 340; y++) for (let xx = 0; xx < w; xx++) mid.set(cx + xx, y, xx < 3 ? 0x5a3a4a : (y - top) % 12 === 0 ? 0x1a1020 : 0x2a1a2a);
    // clock face
    const fx = cx + w / 2;
    const fy = top + 34;
    for (let yy = -16; yy <= 16; yy++) for (let xx = -16; xx <= 16; xx++) {
      const d = Math.hypot(xx, yy);
      if (d < 15) mid.set(Math.round(fx + xx), fy + yy, d > 13 ? GO[3] : 0xf4e2b0);
    }
    for (let i = 0; i < 9; i++) mid.set(Math.round(fx), fy - i, NI[1]);
    for (let i = 0; i < 7; i++) mid.set(Math.round(fx + i), fy, NI[1]);
    for (let yy = 0; yy < 20; yy++) for (let xx = -yy; xx <= yy; xx++) mid.set(Math.round(fx + xx * (w / 40)), top - 20 + yy, 0x2a1a2a);
  }
  return { 'clock_sky.png': s, 'clock_far.png': far, 'clock_mid.png': mid };
}

export function vesperTheme(): ThemeLayers {
  const s = sky([0x07061a, 0x0e0a26, 0x181034, 0x241640, 0x341c4a, 0x4a2252, 0x6a2a56], { curve: 1.3, stars: 90, seed: 1371 });
  // storm gathering over the city
  for (let y = 0; y < 150; y++)
    for (let x = 0; x < 480; x++) {
      const n = fbm(x / 80, y / 18, 1372, 4);
      if (n > 0.55) s.set(x, y, rampDither([0x1a1430, 0x261c40, 0x382a54, 0x4a3866], (n - 0.55) * 3, x, y));
    }
  const far = dayline(1373, [0x140e26, 0x1a1230, 0x22183a, 0x2a1e44], 0x6a3a6a, 0x140e26, [0xffc870, 0xffe0a0, 0x70c8ff, 0xff8ab0], [0x2a1a3a, 0x341e44, 0x40244e], { win: 0.32, count: 70, h: [70, 170] });
  const mid = dayline(1374, [0x0c0818, 0x100c20, 0x161028, 0x1c1430], 0x4a2a5a, 0x0c0818, [0xffc870, 0x70c8ff], [0x140e22, 0x18102a, 0x1e1432], { win: 0.18, base: 170, height: 340, count: 40, w: [40, 90], h: [80, 150] });
  void VI;
  void DA;
  return { 'vesper_sky.png': s, 'vesper_far.png': far, 'vesper_mid.png': mid };
}

export const CHAPTER3_BG = () => ({ ...sunroofTheme(), ...drownedTheme(), ...avenueTheme(), ...transitTheme(), ...labTheme(), ...harborTheme(), ...clockTheme(), ...vesperTheme() });
