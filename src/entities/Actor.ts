import type { Body } from '../physics/TileWorld.ts';
import type { HitKind, HitResult } from './enemies/Enemy.ts';

/**
 * Anyone the world can target or hurt: the local player, and in online co-op
 * the partner (a puppet of the other player's character, whose damage is sent
 * over the network). Enemies and bosses only ever talk to actors.
 */
export interface Actor {
  readonly body: Body;
  readonly x: number;
  readonly y: number;
  readonly feetY: number;
  readonly dead: boolean;
  /** Co-op: down but revivable (enemies leave them be). */
  readonly downed: boolean;
  readonly hp: number;
  readonly invulnT: number;
  readonly isDashing: boolean;
  readonly facing: number;
  hurt(dmg: number, fromX: number, hazard?: boolean): void;
  /** Shove (boss wing snaps): cut the rope and set a velocity. */
  push(vx: number, vy: number): void;
  /** The anchor this player's rope is attached to (lanterns light when tethered). */
  tetheredTo(): unknown;
  /** Live attack hitbox (slashes cut boss projectiles), or null. */
  attackHitbox(): { x: number; y: number; w: number; h: number; id: number; kind: HitKind } | null;
}

/** Someone whose attacks resolve against enemies (a hitbox or a zip strike). */
export interface Attacker {
  readonly x: number;
  readonly y: number;
  readonly facing: number;
  onAttackLanded(r: HitResult, dirX: number, kind: HitKind): void;
}

/** Nearest living actor to a point (falls back to the first one). */
export function nearestActor(list: readonly Actor[], x: number, y: number): Actor {
  let best = list[0];
  let bd = Infinity;
  for (const a of list) {
    if (a.dead || a.downed) continue;
    const d = (a.x - x) ** 2 + (a.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = a;
    }
  }
  return best;
}
