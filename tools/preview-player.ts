// Dev tool: renders animation strips of the player sheet, upscaled, for review.
// Usage: node tools/preview-player.ts <outDir> [animFilter]
import { allAnims, FRAME } from './art/player.ts';
import { renderPose } from './art/rig.ts';
import { PixelCanvas, upscale } from './art/pixel.ts';
import { writePNG } from './lib/png.ts';
import { join } from 'node:path';

const out = process.argv[2] ?? 'preview';
const filter = process.argv[3] ? new RegExp(process.argv[3]) : null;
const scale = Number(process.argv[4] ?? 5);
const anims = allAnims().filter((a) => !filter || filter.test(a.name));
const maxN = Math.max(...anims.map((a) => a.poses.length));
const cols = Math.min(maxN, 16);
const rowsPer = anims.map((a) => Math.ceil(a.poses.length / cols));
const total = rowsPer.reduce((s, r) => s + r, 0);
const sheet = new PixelCanvas(cols * FRAME, total * FRAME);
sheet.fillRect(0, 0, sheet.w, sheet.h, 0x2b2336);
let row = 0;
anims.forEach((a, ai) => {
  a.poses.forEach((p, i) => {
    const { canvas } = renderPose(p, FRAME);
    const x = (i % cols) * FRAME;
    const y = (row + Math.floor(i / cols)) * FRAME;
    sheet.fillRect(x, y, FRAME, FRAME, (i + ai) % 2 ? 0x342a58 : 0x2e2650);
    sheet.hline(x, x + FRAME - 1, y + 45, 0x5d5888);
    sheet.blit(canvas, x, y);
  });
  row += rowsPer[ai];
});
writePNG(join(out, 'player_preview.png'), sheet.w * scale, sheet.h * scale, upscale(sheet, scale).data);
console.log('anims:', anims.map((a) => `${a.name}(${a.poses.length})`).join(' '));
