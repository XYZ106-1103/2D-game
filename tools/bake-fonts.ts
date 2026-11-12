// Bakes Galmuri BDF bitmap fonts into BMFont (XML + PNG) atlases that Phaser
// can render with zero browser anti-aliasing.
//
// Glyph set: printable ASCII, KS X 1001 Hangul (2,350 common syllables),
// compatibility jamo, a few typographic symbols, plus every character found
// in src/data/*.ts (so story text never renders a missing glyph).
import { readFileSync, readdirSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { writePNG } from './lib/png.ts';
import { parseBDF, type Glyph } from './lib/bdf.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'node_modules/galmuri/dist');
const OUT = join(ROOT, 'public/assets/fonts');

function charset(): Set<number> {
  const set = new Set<number>();
  for (let c = 32; c < 127; c++) set.add(c);
  const dec = new TextDecoder('euc-kr');
  for (let hi = 0xb0; hi <= 0xc8; hi++) {
    for (let lo = 0xa1; lo <= 0xfe; lo++) {
      const s = dec.decode(new Uint8Array([hi, lo]));
      const cp = s.codePointAt(0)!;
      if (cp >= 0xac00 && cp <= 0xd7a3) set.add(cp);
    }
  }
  for (let c = 0x3131; c <= 0x3163; c++) set.add(c);
  for (const ch of '…·—–“”‘’«»■□▶◀▲▼●○◆◇★☆※→←↑↓×°♪%「」『』【】〈〉《》') set.add(ch.codePointAt(0)!);
  // Every character used anywhere in game source (story, UI, level titles).
  const walk = (dir: string) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith('.ts')) {
        for (const ch of readFileSync(p, 'utf8')) {
          const cp = ch.codePointAt(0)!;
          if (cp >= 0xa0 && cp !== 0xfeff) set.add(cp);
        }
      }
    }
  };
  walk(join(ROOT, 'src'));
  return set;
}

function bake(file: string, name: string, codes: Set<number>): void {
  const bdf = parseBDF(readFileSync(join(SRC, file), 'utf8'));
  const lineHeight = bdf.ascent + bdf.descent;
  const list: Glyph[] = [];
  const missing: number[] = [];
  for (const c of [...codes].sort((a, b) => a - b)) {
    const g = bdf.glyphs.get(c);
    if (g) list.push(g);
    else missing.push(c);
  }
  // Shelf packing.
  const W = 1024;
  let x = 1;
  let y = 1;
  let shelf = 0;
  const pos = new Map<number, [number, number]>();
  for (const g of list) {
    const gw = Math.max(g.w, 1);
    const gh = Math.max(g.h, 1);
    if (x + gw + 1 > W) {
      x = 1;
      y += shelf + 1;
      shelf = 0;
    }
    pos.set(g.code, [x, y]);
    x += gw + 1;
    shelf = Math.max(shelf, gh);
  }
  let H = y + shelf + 1;
  H = 1 << Math.ceil(Math.log2(H));
  const px = new Uint8Array(W * H * 4);
  for (const g of list) {
    const [gx, gy] = pos.get(g.code)!;
    for (let r = 0; r < g.h; r++) {
      for (let c = 0; c < g.w; c++) {
        if (!g.rows[r][c]) continue;
        const o = ((gy + r) * W + gx + c) * 4;
        px[o] = px[o + 1] = px[o + 2] = px[o + 3] = 255;
      }
    }
  }
  writePNG(join(OUT, `${name}.png`), W, H, px);
  const chars = list
    .map((g) => {
      const [gx, gy] = pos.get(g.code)!;
      const yoff = bdf.ascent - (g.yo + g.h);
      return `<char id="${g.code}" x="${gx}" y="${gy}" width="${g.w}" height="${g.h}" xoffset="${g.xo}" yoffset="${yoff}" xadvance="${g.dw}" page="0" chnl="15"/>`;
    })
    .join('\n');
  const xml = `<?xml version="1.0"?>
<font>
<info face="${name}" size="${lineHeight}" bold="0" italic="0" charset="" unicode="1" stretchH="100" smooth="0" aa="0" padding="0,0,0,0" spacing="1,1"/>
<common lineHeight="${lineHeight}" base="${bdf.ascent}" scaleW="${W}" scaleH="${H}" pages="1" packed="0"/>
<pages><page id="0" file="${name}.png"/></pages>
<chars count="${list.length}">
${chars}
</chars>
</font>
`;
  writeFileSync(join(OUT, `${name}.xml`), xml);
  console.log(`  ${name}: ${list.length} glyphs, ${W}x${H}, line ${lineHeight}px` + (missing.length ? `, missing ${missing.length}: ${missing.slice(0, 12).map((c) => String.fromCodePoint(c)).join('')}` : ''));
}

mkdirSync(OUT, { recursive: true });
const codes = charset();
console.log(`Baking fonts (${codes.size} code points requested)…`);
bake('Galmuri11.bdf', 'galmuri11', codes);
bake('Galmuri11-Bold.bdf', 'galmuri11b', codes);
bake('Galmuri9.bdf', 'galmuri9', codes);
bake('Galmuri7.bdf', 'galmuri7', codes);
copyFileSync(join(SRC, 'LICENSE.txt'), join(OUT, 'GALMURI_LICENSE.txt'));
console.log('Done.');
