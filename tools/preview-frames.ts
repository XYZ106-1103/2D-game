// Dev tool: render selected frames large. Usage: node tools/preview-frames.ts out.png scale anim:idx ...
import { allAnims, FRAME } from './art/player.ts';
import { renderPose } from './art/rig.ts';
import { PixelCanvas, upscale } from './art/pixel.ts';
import { writePNG } from './lib/png.ts';
const [out, sc, ...sel] = process.argv.slice(2);
const anims = Object.fromEntries(allAnims().map((a) => [a.name, a]));
const sheet = new PixelCanvas(sel.length * FRAME, FRAME);
sheet.fillRect(0, 0, sheet.w, sheet.h, 0x342a58);
sel.forEach((s, i) => {
  const [n, k] = s.split(':');
  const { canvas } = renderPose(anims[n].poses[Number(k ?? 0)], FRAME);
  sheet.blit(canvas, i * FRAME, 0);
});
writePNG(out, sheet.w * Number(sc), sheet.h * Number(sc), upscale(sheet, Number(sc)).data);
