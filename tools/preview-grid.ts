// Dev tool: all frames of matching anims in a grid. Usage: node tools/preview-grid.ts out.png scale cols regex
import { allAnims, FRAME } from './art/player.ts';
import { renderPose } from './art/rig.ts';
import { PixelCanvas, upscale } from './art/pixel.ts';
import { writePNG } from './lib/png.ts';
const [out, sc, colsS, re] = process.argv.slice(2);
const filter = new RegExp(re ?? '.');
const poses = allAnims().filter((a) => filter.test(a.name)).flatMap((a) => a.poses);
const cols = Number(colsS);
const rows = Math.ceil(poses.length / cols);
const sheet = new PixelCanvas(cols * FRAME, rows * FRAME);
poses.forEach((p, i) => {
  const x = (i % cols) * FRAME, y = Math.floor(i / cols) * FRAME;
  sheet.fillRect(x, y, FRAME, FRAME, i % 2 ? 0x342a58 : 0x2e2650);
  sheet.blit(renderPose(p, FRAME).canvas, x, y);
});
writePNG(out, sheet.w * Number(sc), sheet.h * Number(sc), upscale(sheet, Number(sc)).data);
