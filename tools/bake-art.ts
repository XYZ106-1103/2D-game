// Bakes every procedural art generator into standard sprite sheets / atlases
// under public/assets. The game only ever loads these PNG + JSON files.
import { join } from 'node:path';
import { writePNG, writeJSON } from './lib/png.ts';
import { packAtlas, upscale, PixelCanvas } from './art/pixel.ts';
import { buildPlayerSheet } from './art/player.ts';
import { buildTileset } from './art/tiles.ts';
import { sky, spire, farLayer, midLayer, nearLayer, fogStrip } from './art/backgrounds.ts';
import { buildProps } from './art/props.ts';
import { buildFx } from './art/fx.ts';
import { buildUi } from './art/ui.ts';
import { trooperAnims, droneAnims, sentrySprites, combatFx } from './art/enemies.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'public/assets');
const previewDir = process.argv[2];

const t0 = Date.now();
const save = (rel: string, c: PixelCanvas) => {
  writePNG(join(OUT, rel), c.w, c.h, c.data);
  console.log(`  ${rel.padEnd(28)} ${c.w}x${c.h}`);
};

console.log('Baking art…');
const player = buildPlayerSheet();
save('sprites/player.png', player.canvas);
writeJSON(join(OUT, 'sprites/player.json'), player.json);

save('sprites/tiles.png', buildTileset());

save('bg/sky.png', sky());
save('bg/spire.png', spire());
save('bg/far.png', farLayer());
save('bg/mid.png', midLayer());
save('bg/near.png', nearLayer());
save('bg/fog.png', fogStrip());

// enemies: trooper sheet (48×48 frames + anim table) and an atlas for the rest
{
  const anims = trooperAnims();
  const frames = anims.flatMap((a) => a.frames);
  const cols = 8;
  const sheet = new PixelCanvas(cols * 48, Math.ceil(frames.length / cols) * 48);
  frames.forEach((f, i) => sheet.blit(f, (i % cols) * 48, Math.floor(i / cols) * 48));
  save('sprites/trooper.png', sheet);
  let k = 0;
  const table: Record<string, { frames: number[]; fps: number; loop: boolean }> = {};
  for (const a of anims) table[a.name] = { frames: a.frames.map(() => k++), fps: a.fps, loop: a.loop };
  writeJSON(join(OUT, 'sprites/trooper.json'), { frameWidth: 48, frameHeight: 48, origin: [24, 46], anims: table });
}
const enemyItems = [
  ...droneAnims().flatMap((a) => a.frames.map((c, i) => ({ name: `drone_${a.name}_${i}`, c }))),
  ...sentrySprites(),
  ...combatFx(),
];

for (const [name, items, width] of [
  ['enemies', enemyItems, 512],
  ['props', buildProps(), 256],
  ['fx', buildFx(), 256],
  ['ui', buildUi(), 256],
] as const) {
  const { canvas, json } = packAtlas([...items], width);
  save(`sprites/${name}.png`, canvas);
  writeJSON(join(OUT, `sprites/${name}.json`), json);
}
console.log(`Done in ${Date.now() - t0}ms.`);

if (previewDir) {
  for (const f of ['sprites/tiles.png', 'sprites/props.png', 'sprites/fx.png', 'sprites/ui.png']) void f;
  const show = (name: string, c: PixelCanvas, s: number) => writePNG(join(previewDir, name), c.w * s, c.h * s, upscale(c, s, 0x241a38).data);
  show('tiles.png', buildTileset(), 4);
  const p = packAtlas(buildProps(), 256).canvas;
  show('props.png', p, 3);
  show('fx.png', packAtlas(buildFx(), 256).canvas, 3);
  show('ui.png', packAtlas(buildUi(), 256).canvas, 3);
}
