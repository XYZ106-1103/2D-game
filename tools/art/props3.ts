// Chapter 3 device, enemy and boss-part sprites (atlas "ch3").
import { RAMPS } from '../../src/art/palette.ts';
import { PixelCanvas, forEachPolyPixel } from './pixel.ts';
import { loadGalmuri, rasterText } from '../lib/bdf.ts';

type Item = { name: string; c: PixelCanvas };
const ST = RAMPS.steel;
const MA = RAMPS.marble;
const GO = RAMPS.gold;
const CR = RAMPS.crimson;
const SK = RAMPS.sky;
const AM = RAMPS.amber;
const CY = RAMPS.cyan;
const OX = RAMPS.oxide;
const NI = RAMPS.night;
const YE = RAMPS.yellow;
const BR = RAMPS.brick;
const INK = 0x0a0612;

function disc(c: PixelCanvas, cx: number, cy: number, r: number, col: number): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) c.set(x, y, col);
}
function item(name: string, w: number, h: number, draw: (c: PixelCanvas) => void, outline = true): Item {
  const c = new PixelCanvas(w, h);
  draw(c);
  if (outline) c.outline(INK);
  return { name, c };
}

export function buildProps3(): Item[] {
  const out: Item[] = [];
  out.push(
    item('pulley', 12, 12, (c) => {
      disc(c, 6, 6, 5, ST[2]);
      disc(c, 6, 6, 3, ST[4]);
      c.set(6, 6, ST[6]);
    }),
  );
  out.push(
    item('trolley', 12, 8, (c) => {
      c.fillRect(1, 0, 10, 4, ST[3]);
      c.fillRect(1, 0, 10, 1, ST[5]);
      disc(c, 3, 2, 1.5, ST[6]);
      disc(c, 9, 2, 1.5, ST[6]);
      c.fillRect(5, 4, 2, 4, ST[2]);
    }),
  );
  out.push(
    item('lamp', 14, 12, (c) => {
      c.fillRect(2, 0, 10, 8, ST[2]);
      c.fillRect(2, 0, 10, 1, ST[4]);
      c.fillRect(3, 8, 8, 3, 0xfff4c8);
      c.fillRect(4, 9, 6, 1, 0xffffff);
      c.fillRect(6, 0, 2, 2, ST[1]);
    }),
  );
  // trains: car + head (96×28, roof on top)
  for (const head of [false, true]) {
    out.push(
      item(head ? 'train_head' : 'train_car', 96, 28, (c) => {
        for (let y = 0; y < 28; y++)
          for (let x = 0; x < 96; x++) {
            if (head && x > 80 && y < (x - 80) * 1.2) continue;
            let col = y < 2 ? MA[6] : y < 4 ? MA[4] : y < 20 ? MA[5] : y < 23 ? CR[4] : ST[2];
            if (y > 7 && y < 15 && x % 14 > 2 && x % 14 < 12 && x > 4 && x < (head ? 78 : 92)) col = y < 9 ? SK[5] : SK[2];
            if (x === 0 || x === 95) col = ST[2];
            c.set(x, y, col);
          }
        for (const wx of [14, 30, 66, 82]) disc(c, wx, 26, 2.5, ST[1]);
        if (head) {
          c.fillRect(86, 14, 4, 3, 0xfff4c8);
          c.fillRect(84, 9, 6, 4, SK[3]);
        }
      }),
    );
  }
  out.push(
    item('gantry', 16, 16, (c) => {
      c.fillRect(0, 0, 16, 16, ST[2]);
      for (let x = 0; x < 16; x++) c.set(x, 13, (x >> 1) % 2 ? YE[3] : INK);
      c.fillRect(5, 3, 6, 6, NI[1]);
      disc(c, 8, 6, 2, CR[5]);
    }),
  );
  for (const [name, col] of [
    ['portal_a', [AM[2], AM[3], AM[4], 0xfff0c0]],
    ['portal_b', [CY[2], CY[3], CY[5], 0xf0fffe]],
  ] as const) {
    out.push(
      item(
        name,
        12,
        36,
        (c) => {
          for (let y = 0; y < 36; y++)
            for (let x = 0; x < 12; x++) {
              const d = Math.hypot((x - 5.5) / 5.5, (y - 17.5) / 17.5);
              if (d > 1) continue;
              c.set(x, y, d > 0.85 ? col[3] : d > 0.7 ? col[2] : d > 0.5 ? col[1] : col[0], d > 0.5 ? 255 : 150);
            }
        },
        false,
      ),
    );
  }
  out.push(
    item('crate', 28, 28, (c) => {
      c.fillRect(0, 0, 28, 28, OX[4]);
      for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) if (y % 7 === 6) c.set(x, y, OX[2]);
      c.fillRect(0, 0, 28, 2, OX[6]);
      c.fillRect(0, 0, 2, 28, OX[5]);
      c.fillRect(26, 0, 2, 28, OX[2]);
      for (let i = 0; i < 28; i++) {
        c.set(i, i, OX[3]);
        c.set(27 - i, i, OX[3]);
      }
      c.fillRect(10, 11, 8, 6, YE[3]);
      c.fillRect(12, 13, 4, 2, INK);
    }),
  );
  out.push(
    item('axle', 24, 24, (c) => {
      disc(c, 12, 12, 10, GO[2]);
      for (let k = 0; k < 12; k++) disc(c, 12 + Math.cos((k / 12) * Math.PI * 2) * 10, 12 + Math.sin((k / 12) * Math.PI * 2) * 10, 1.5, GO[3]);
      disc(c, 12, 12, 6, GO[4]);
      disc(c, 12, 12, 2.5, GO[1]);
    }),
  );
  for (const [name, w] of [
    ['plank2', 32],
    ['plank3', 48],
  ] as const) {
    out.push(
      item(name, w, 7, (c) => {
        c.fillRect(0, 0, w, 6, OX[4]);
        c.fillRect(0, 0, w, 1, OX[6]);
        c.fillRect(0, 5, w, 1, OX[2]);
        for (let x = 6; x < w; x += 8) c.set(x, 2, GO[5]);
      }),
    );
  }
  out.push(
    item('bob', 16, 16, (c) => {
      disc(c, 8, 9, 6.5, GO[3]);
      disc(c, 7, 8, 4, GO[5]);
      c.set(6, 6, GO[6]);
      c.fillRect(7, 0, 2, 4, GO[2]);
    }),
  );
  out.push(
    item(
      'shutter',
      16,
      16,
      (c) => {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) c.set(x, y, y % 4 === 3 ? ST[1] : y % 4 === 0 ? ST[5] : ST[3]);
        c.fillRect(0, 7, 16, 1, CR[4]);
      },
      false,
    ),
  );
  for (let f = 0; f < 2; f++) {
    out.push(
      item('watcher_' + f, 18, 12, (c) => {
        c.fillRect(4, 3, 10, 6, ST[3]);
        c.fillRect(4, 3, 10, 1, ST[5]);
        c.fillRect(7, 9, 4, 2, 0xfff4c8);
        const w = f ? 2 : 4;
        c.fillRect(0, 2 - (f ? 0 : 1), w, 1, ST[4]);
        c.fillRect(18 - w, 2 - (f ? 0 : 1), w, 1, ST[4]);
        c.set(11, 5, CR[5]);
      }),
    );
  }
  out.push(
    item('talk', 14, 12, (c) => {
      c.fillRect(1, 0, 12, 9, MA[6]);
      c.set(4, 9, MA[6]);
      c.set(4, 10, MA[6]);
      c.set(5, 9, MA[6]);
      // "W"
      for (const [x, y] of [
        [3, 2],
        [3, 3],
        [4, 4],
        [4, 5],
        [5, 6],
        [6, 5],
        [7, 4],
        [8, 5],
        [9, 6],
        [10, 5],
        [10, 4],
        [11, 3],
        [11, 2],
      ])
        c.set(x, y, NI[1]);
    }),
  );
  for (let f = 0; f < 2; f++) {
    const c = new PixelCanvas(9, 5);
    if (f) {
      c.set(0, 2, 1);
      c.set(1, 1, 1);
      c.set(2, 1, 1);
      c.set(3, 2, 1);
      c.set(4, 2, 1);
      c.set(5, 2, 1);
      c.set(6, 1, 1);
      c.set(7, 1, 1);
      c.set(8, 2, 1);
    } else {
      c.set(0, 0, 1);
      c.set(1, 1, 1);
      c.set(2, 2, 1);
      c.set(3, 3, 1);
      c.set(4, 3, 1);
      c.set(5, 3, 1);
      c.set(6, 2, 1);
      c.set(7, 1, 1);
      c.set(8, 0, 1);
    }
    for (let y = 0; y < 5; y++) for (let x = 0; x < 9; x++) if (c.get(x, y) === 1) c.set(x, y, 0xffffff);
    out.push({ name: 'gull_' + f, c });
  }
  for (let f = 0; f < 2; f++) {
    const c = new PixelCanvas(5, 4);
    const col = f ? AM[3] : CR[4];
    c.fillRect(1, 0, 3, 1, col);
    c.fillRect(0, 1, 5, 2, col);
    c.set(2, 3, OX[3]);
    out.push({ name: 'leaf_' + f, c });
  }
  for (const on of [false, true]) {
    out.push(
      item(on ? 'lantern_on' : 'lantern_off', 14, 22, (c) => {
        c.fillRect(6, 0, 2, 3, ST[3]);
        c.fillRect(3, 3, 8, 2, BR[2]);
        for (let y = 5; y < 18; y++) {
          const w = y < 8 || y > 15 ? 4 : 5;
          for (let x = 7 - w; x < 7 + w; x++) c.set(x, y, x === 7 - w || x === 6 + w ? BR[2] : on ? (y < 11 ? 0xfff0c0 : AM[4]) : NI[2]);
        }
        c.fillRect(3, 18, 8, 2, BR[2]);
        if (on) {
          c.set(6, 9, 0xffffff);
          c.set(7, 10, 0xffffff);
        }
      }),
    );
  }
  // boss parts
  for (let f = 0; f < 3; f++) {
    out.push(
      item('screen_' + f, 30, 24, (c) => {
        c.fillRect(0, 0, 30, 20, ST[1]);
        c.fillRect(2, 2, 26, 16, f === 2 ? CR[2] : NI[2]);
        for (let y = 3; y < 17; y++) for (let x = 3; x < 27; x++) if ((x + y + f * 3) % 5 === 0) c.set(x, y, f === 2 ? CR[4] : CY[3]);
        // the city's eye on every screen
        disc(c, 15, 10, 4, f === 2 ? CR[5] : MA[6]);
        disc(c, 15, 10, 2, f === 1 ? CR[5] : NI[0]);
        c.fillRect(13, 20, 4, 4, ST[2]);
      }),
    );
  }
  out.push(
    item('pylon', 22, 48, (c) => {
      for (let y = 0; y < 48; y++) {
        const w = 4 + Math.floor((y / 48) * 7);
        for (let x = 11 - w; x <= 10 + w; x++) c.set(x, y, x < 11 - w + 2 ? ST[4] : (y % 8 === 0 ? ST[1] : ST[2]));
      }
      disc(c, 11, 6, 4, AM[4]);
      disc(c, 11, 6, 2, 0xfff0c0);
    }),
  );
  out.push(
    item('missile', 6, 12, (c) => {
      c.fillRect(1, 0, 4, 9, MA[5]);
      c.fillRect(1, 0, 4, 2, CR[4]);
      c.set(0, 7, ST[3]);
      c.set(5, 7, ST[3]);
      c.fillRect(2, 9, 2, 3, AM[4]);
    }),
  );
  out.push(
    item(
      'reticle',
      18,
      18,
      (c) => {
        for (let a = 0; a < Math.PI * 2; a += 0.05) c.set(Math.round(9 + Math.cos(a) * 7), Math.round(9 + Math.sin(a) * 7), CR[5]);
        for (let i = 0; i < 4; i++) {
          c.set(9, i, CR[5]);
          c.set(9, 17 - i, CR[5]);
          c.set(i, 9, CR[5]);
          c.set(17 - i, 9, CR[5]);
        }
      },
      false,
    ),
  );
  out.push(
    item('crane_load', 40, 26, (c) => {
      c.fillRect(0, 4, 40, 22, SK[1]);
      for (let x = 0; x < 40; x += 3) for (let y = 4; y < 26; y++) c.set(x, y, SK[0]);
      c.fillRect(0, 4, 40, 1, SK[3]);
      c.fillRect(18, 0, 4, 4, ST[3]);
    }),
  );
  void loadGalmuri;
  void rasterText;
  void forEachPolyPixel;
  return out;
}
