// Stage 3 — "레테 타워 외벽" (The LETHE Spire, outer wall)
//
// A vertical climb up the spire's maintenance face, above the smog sea.
// Footholds alternate sides roughly every 6–7 rows; every gap has a tether
// node placed so the swing *ends below* the next foothold (release on the
// upswing to land). Glass panels refuse the hook.
import { LevelBuilder, Mat, type LevelData } from '../LevelData.ts';

export function buildLevel3(): LevelData {
  const L = new LevelBuilder('lethe-wall', '레테 타워 외벽', 'THE LETHE SPIRE — OUTER WALL', 52, 112);
  L.setTheme('tower', 'tower', 0.35);

  // frame: neighbouring pillar on the left, the spire facade on the right
  L.fill(0, 10, 2, 111, Mat.Concrete);
  L.fill(38, 10, 51, 111, Mat.Steel);
  L.fill(38, 84, 39, 103, Mat.Glass);
  L.fill(38, 40, 39, 60, Mat.Glass);

  // --- base work platform ---------------------------------------------------------------
  L.building(3, 37, 104);
  L.spawn(6, 103);
  L.checkpoint(6, 103);
  L.trigger(3, 92, 8, 12, 't_intro');
  L.enemy('trooper', 24, 103);
  L.prop('crate', 12, 104).prop('crate', 13, 104).prop('barrel', 32, 104).prop('lamp', 17, 104);

  // F1 → F2 → F3: alternating ledges past the glass
  L.anchor(20, 92);
  L.fill(28, 97, 36, 98, Mat.Steel); // F1
  L.trigger(26, 88, 10, 9, 't_glass');
  L.anchor(25, 88);
  L.catwalk(10, 18, 90); // F2
  L.log(12, 88, 'log7');
  L.enemy('drone', 16, 95);
  L.anchor(14, 78);
  L.fill(20, 83, 28, 84, Mat.Steel); // F3

  // F4: gondola node rising beside the facade
  L.mover(35, 82, 35, 59, 5.5);
  L.trigger(20, 74, 10, 9, 't_gondola');

  // F5 (checkpoint) with an exhaust vent up to F6
  L.fill(24, 66, 33, 67, Mat.Steel);
  L.checkpoint(29, 65);
  L.vent(25, 65, 14, 1.7, 1.0);
  L.catwalk(16, 24, 52); // F6

  // sentry nest across the shaft
  L.fill(32, 50, 36, 51, Mat.Steel);
  L.enemy('sentry', 34, 49);
  L.enemy('drone', 28, 44);

  // crumbling scaffolds F8 (left) → F9 (right); anchors sit ~110px off each
  // ledge's near end and ≥80px above it, so the upswing clears the lip.
  L.anchor(20, 40);
  L.crumble(7, 13, 46); // F8
  L.anchor(12, 33);
  L.crumble(21, 27, 39); // F9
  L.log(24, 37, 'log8');
  L.anchor(22, 27);
  L.fill(28, 33, 36, 34, Mat.Steel); // F10
  L.checkpoint(33, 32);
  L.enemy('trooper', 30, 32);

  // vent F10 → catwalk F11 → final vent column beside the crown terrace
  L.vent(34, 32, 12, 1.6, 1.0);
  L.catwalk(18, 32, 21); // F11
  L.vent(19, 20, 16, 1.8, 1.0);
  L.enemy('drone', 12, 16);
  L.anchor(12, 12).anchor(26, 2);
  L.fill(22, 8, 51, 9, Mat.Steel); // crown terrace
  L.trigger(20, 0, 10, 8, 't_top');
  L.enemy('sentry', 40, 7).enemy('trooper', 31, 7);
  L.log(48, 6, 'log9');
  L.prop('antenna', 44, 8).prop('dish', 28, 8);
  L.exit(46, 7);

  L.clearText('레테 타워 외벽 등반 완료');
  return L.build();
}
