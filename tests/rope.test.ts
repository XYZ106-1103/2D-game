// Deterministic checks for rope wrapping / unwrapping (run: node tests/rope.test.ts)
import { TileWorld, Cell } from '../src/physics/TileWorld.ts';
import { Rope } from '../src/physics/Rope.ts';

let failed = 0;
function check(name: string, cond: boolean, info = ''): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`);
  if (!cond) failed++;
}

// 20×20 world with a solid 4×4 block at tiles (8..11, 8..11) => pixels 128..192
const W = 20;
const cells = new Uint8Array(W * W);
for (let y = 8; y <= 11; y++) for (let x = 8; x <= 11; x++) cells[y * W + x] = Cell.Solid;
const world = new TileWorld(W, W, cells);

// Anchor on top of the block, player hanging to the right of the block.
const rope = new Rope(world);
const ax = 150;
const ay = 127; // just above the block top (y=128)
let px = 210;
let py = 110;
rope.attach(ax, ay, px, py);
const L0 = rope.length;
check('attached with one pivot', rope.pivots.length === 1);

// Swing the player down and under the block's right side: rope must wrap
// around the top-right corner (192,128).
const path: [number, number][] = [];
for (let t = 0; t <= 1.0001; t += 0.05) path.push([210 - 10 * t, 110 + 60 * t]);
for (const [nx, ny] of path) {
  rope.updateWrapping(px, py, nx, ny);
  px = nx;
  py = ny;
}
check('wrapped around the top-right corner', rope.pivots.length === 2, JSON.stringify(rope.pivots.map((p) => [Math.round(p.x), Math.round(p.y)])));
const c = rope.pivots[1];
check('pivot sits on the corner', c && Math.abs(c.x - 192.6) < 1 && Math.abs(c.y - 127.4) < 1);
check('free length shortened by wrapped segment', rope.length < L0, `${L0.toFixed(1)} -> ${rope.length.toFixed(1)}`);
check('total length conserved', Math.abs(rope.totalLength() - L0) < 0.01, rope.totalLength().toFixed(2));

// Swing back out: rope must unwrap.
for (let i = path.length - 1; i >= 0; i--) {
  const [nx, ny] = path[i];
  rope.updateWrapping(px, py, nx, ny);
  px = nx;
  py = ny;
}
rope.updateWrapping(px, py, 230, 100);
check('unwrapped after swinging back', rope.pivots.length === 1);
check('free length restored', Math.abs(rope.length - L0) < 0.01, rope.length.toFixed(2));

// Raycast sanity
const hit = world.raycast(100, 150, 300, 150);
check('raycast hits block face', !!hit && Math.abs(hit.x - 128) < 0.01 && hit.nx === -1);
check('line of sight clear above block', world.clear(100, 100, 300, 100));

if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log('All rope checks passed.');
