import { MAP_H, MAP_W } from '../constants';
import { TILE_H, TILE_W, type ScenePalette } from './isoPrimitives';

export interface AmbientVehicle {
  axis: 'x' | 'y';
  lane: number;
  pos: number;
  dir: 1 | -1;
  speed: number;
  colorKey: 'vehicle-red' | 'vehicle-teal' | 'vehicle-gold' | 'trim' | 'porcelain';
  kind: 'car' | 'bus' | 'taxi';
}

export interface AmbientBoat {
  kind: 'river' | 'sea';
  gx: number;
  gy: number;
  dir: 1 | -1;
  speed: number;
  phase: number;
  yacht: boolean;
}

export interface AmbientCloud {
  wx: number;
  wy: number;
  rx: number;
  ry: number;
  speed: number;
  alpha: number;
}

export interface AutumnLeaf {
  x: number; // normalized 0..1 of viewport width
  y: number; // normalized 0..1 of viewport height
  size: number;
  vx: number;
  vy: number;
  phase: number;
  spin: number;
  color: string;
}

export interface AmbientSystem {
  vehicles: AmbientVehicle[];
  boats: AmbientBoat[];
  clouds: AmbientCloud[];
  leaves: AutumnLeaf[];
}

const ROAD_X = [0, 6, 12, 18, 24];
const ROAD_Y = [0, 6, 12, 18, 24, 30, 36, 42, 48];
const CAR_COLORS: AmbientVehicle['colorKey'][] = ['vehicle-red', 'vehicle-teal', 'vehicle-gold', 'trim', 'porcelain'];
const LEAF_COLORS = ['#f5b841', '#e88b35', '#d95f39', '#f2cf66', '#c94c38', '#e59f3c'];

export function createAmbientSystem(maxVehicles = 56, maxBoats = 12, maxClouds = 10, maxLeaves = 64): AmbientSystem {
  const vehicles: AmbientVehicle[] = [];
  for (let i = 0; i < maxVehicles; i++) {
    const axis: 'x' | 'y' = i % 2 === 0 ? 'x' : 'y';
    const lane = axis === 'x' ? ROAD_Y[i % ROAD_Y.length] : ROAD_X[i % ROAD_X.length];
    const dir: 1 | -1 = i % 3 === 0 ? -1 : 1;
    const maxLen = axis === 'x' ? MAP_W - 1 : MAP_H - 1;
    const kind: AmbientVehicle['kind'] = i % 7 === 0 ? 'bus' : i % 4 === 0 ? 'taxi' : 'car';
    vehicles.push({
      axis,
      lane,
      pos: (i * 7.37) % maxLen,
      dir,
      speed: kind === 'bus' ? 0.95 : 1.35 + (i % 5) * 0.22,
      colorKey: kind === 'taxi' ? 'vehicle-gold' : CAR_COLORS[i % CAR_COLORS.length],
      kind,
    });
  }

  const boats: AmbientBoat[] = [];
  for (let i = 0; i < maxBoats; i++) {
    const isRiver = i < Math.ceil(maxBoats * 0.6);
    if (isRiver) {
      boats.push({
        kind: 'river',
        gx: ((i * 4.3) % (MAP_W - 2)) + 1,
        gy: 28 + (i % 2 === 0 ? 0.35 : 0.68),
        dir: i % 2 === 0 ? 1 : -1,
        speed: 0.45 + (i % 3) * 0.14,
        phase: i * 1.1,
        yacht: i % 3 === 0,
      });
    } else {
      const k = i - Math.ceil(maxBoats * 0.6);
      boats.push({
        kind: 'sea',
        gx: 21.5 + (k % 5) * 1.2,
        gy: 24.5 + (k % 3) * 1.0,
        dir: k % 2 === 0 ? 1 : -1,
        speed: 0.26 + (k % 3) * 0.08,
        phase: k * 1.7,
        yacht: true,
      });
    }
  }

  const clouds: AmbientCloud[] = [];
  for (let i = 0; i < maxClouds; i++) {
    clouds.push({
      wx: -1500 + ((i * 340) % 2500),
      wy: -180 + ((i * 195) % 1400),
      rx: 75 + (i % 4) * 32,
      ry: 28 + (i % 3) * 12,
      speed: 9 + (i % 4) * 4,
      alpha: 0.075 + (i % 3) * 0.025,
    });
  }

  const leaves: AutumnLeaf[] = [];
  for (let i = 0; i < maxLeaves; i++) {
    leaves.push({
      x: ((i * 0.6180339) % 1),
      y: ((i * 0.381966) % 1),
      size: 2.6 + (i % 4) * 0.9,
      vx: 0.018 + (i % 5) * 0.005, // gentle autumn breeze drifting right
      vy: 0.032 + (i % 4) * 0.01, // soft floating descent
      phase: i * 1.37,
      spin: 1.4 + (i % 3) * 0.65,
      color: LEAF_COLORS[i % LEAF_COLORS.length],
    });
  }

  return { vehicles, boats, clouds, leaves };
}

export function stepAmbientSystem(sys: AmbientSystem, dtSec: number, simSpeed: number, paused: boolean): void {
  const factor = paused ? 0.25 : Math.min(2.2, simSpeed);
  const dt = dtSec * factor;

  for (const v of sys.vehicles) {
    v.pos += v.dir * v.speed * dt;
    const limit = v.axis === 'x' ? MAP_W - 0.5 : MAP_H - 0.5;
    if (v.pos > limit) v.pos = 0.5;
    else if (v.pos < 0.5) v.pos = limit;
  }

  for (const b of sys.boats) {
    if (b.kind === 'river') {
      b.gx += b.dir * b.speed * dt;
      if (b.gx > MAP_W - 0.8) b.gx = 0.8;
      else if (b.gx < 0.8) b.gx = MAP_W - 0.8;
    } else {
      b.gx += b.dir * b.speed * dt * 0.65;
      b.gy -= b.dir * b.speed * dt * 0.65;
      if (b.gx > 27.2 || b.gy < 19.2) {
        b.gx = 20.5;
        b.gy = 26.2;
      } else if (b.gx < 19.8 || b.gy > 27.2) {
        b.gx = 26.2;
        b.gy = 20.5;
      }
    }
  }

  for (const c of sys.clouds) {
    c.wx += c.speed * dtSec;
    if (c.wx > 1150) c.wx = -1650;
  }

  // Autumn leaves always drift gently regardless of pause
  for (const lf of sys.leaves) {
    lf.phase += dtSec * lf.spin;
    lf.x += (lf.vx + Math.sin(lf.phase) * 0.014) * dtSec;
    lf.y += lf.vy * dtSec;
    if (lf.y > 1.04) {
      lf.y = -0.04;
      lf.x = (lf.x + 0.37) % 1;
    }
    if (lf.x > 1.04) lf.x = -0.04;
    if (lf.x < -0.04) lf.x = 1.04;
  }
}

export function drawAmbientVehicles(
  ctx: CanvasRenderingContext2D,
  sys: AmbientSystem,
  count: number,
  pal: ScenePalette,
  nightFactor: number,
  isVisible: (sx: number, sy: number) => boolean
): void {
  const limit = Math.min(count, sys.vehicles.length);
  for (let i = 0; i < limit; i++) {
    const v = sys.vehicles[i];
    const laneOff = v.dir > 0 ? 0.64 : 0.36;
    const gx = v.axis === 'x' ? v.pos : v.lane + laneOff;
    const gy = v.axis === 'y' ? v.pos : v.lane + laneOff;

    const sx = (gx - gy) * TILE_W;
    const sy = (gx + gy) * TILE_H;
    if (!isVisible(sx, sy)) continue;

    const dx = v.axis === 'x' ? v.dir * 0.894 : -v.dir * 0.894;
    const dy = v.axis === 'x' ? v.dir * 0.447 : v.dir * 0.447;
    const len = v.kind === 'bus' ? 8.5 : 5.2;
    const h = v.kind === 'bus' ? 4.2 : 2.8;

    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 1.5, len * 0.68, 2.4, dx * dy > 0 ? 0.42 : -0.42, 0, 7);
    ctx.fill();

    ctx.strokeStyle = pal[v.colorKey] ?? '#f59e0b';
    ctx.lineWidth = v.kind === 'bus' ? 4.2 : 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx - dx * len * 0.5, sy - dy * len * 0.5 - h * 0.35);
    ctx.lineTo(sx + dx * len * 0.5, sy + dy * len * 0.5 - h * 0.35);
    ctx.stroke();

    ctx.strokeStyle = v.kind === 'bus' ? pal.trim : 'rgba(255,255,255,0.65)';
    ctx.lineWidth = v.kind === 'bus' ? 2.4 : 1.7;
    ctx.beginPath();
    ctx.moveTo(sx - dx * len * 0.22, sy - dy * len * 0.22 - h * 0.85);
    ctx.lineTo(sx + dx * len * 0.22, sy + dy * len * 0.22 - h * 0.85);
    ctx.stroke();

    if (nightFactor > 0.15) {
      const hx = sx + dx * (len * 0.55);
      const hy = sy + dy * (len * 0.55) - 1;
      const beamX = hx + dx * 11;
      const beamY = hy + dy * 11;

      const grad = ctx.createLinearGradient(hx, hy, beamX, beamY);
      grad.addColorStop(0, `rgba(255, 240, 185, ${0.58 * nightFactor})`);
      grad.addColorStop(1, 'rgba(255, 240, 185, 0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(beamX, beamY);
      ctx.stroke();

      ctx.fillStyle = `rgba(255, 65, 65, ${0.85 * nightFactor})`;
      ctx.fillRect(sx - dx * len * 0.55 - 0.8, sy - dy * len * 0.55 - 1.6, 1.8, 1.8);
    }
  }
  ctx.lineCap = 'butt';
}

export function drawAmbientBoats(
  ctx: CanvasRenderingContext2D,
  sys: AmbientSystem,
  count: number,
  tSec: number,
  pal: ScenePalette,
  isVisible: (sx: number, sy: number) => boolean
): void {
  const limit = Math.min(count, sys.boats.length);
  for (let i = 0; i < limit; i++) {
    const b = sys.boats[i];
    const bob = Math.sin(tSec * 2.2 + b.phase) * 0.8;
    const sx = (b.gx - b.gy) * TILE_W;
    const sy = (b.gx + b.gy) * TILE_H + bob;
    if (!isVisible(sx, sy)) continue;

    if (b.kind === 'river' && Math.abs(b.gx - Math.round(b.gx / 6) * 6) < 0.75) continue;

    const dx = b.kind === 'river' ? b.dir * 0.894 : b.dir * 0.95;
    const dy = b.kind === 'river' ? b.dir * 0.447 : 0;

    ctx.strokeStyle = 'rgba(255, 248, 232, 0.34)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(sx - dx * 5, sy - dy * 5 + 1);
    ctx.lineTo(sx - dx * 15 - dy * 4, sy - dy * 15 + dx * 2 + 1);
    ctx.moveTo(sx - dx * 5, sy - dy * 5 + 1);
    ctx.lineTo(sx - dx * 15 + dy * 4, sy - dy * 15 - dx * 2 + 1);
    ctx.stroke();

    ctx.fillStyle = b.yacht ? pal.trim : pal.wood;
    ctx.beginPath();
    ctx.moveTo(sx + dx * 6.5, sy + dy * 6.5);
    ctx.lineTo(sx - dx * 5 + dy * 2.5, sy - dy * 5 - dx * 1.4 + 2);
    ctx.lineTo(sx - dx * 6, sy - dy * 6 + 2.5);
    ctx.lineTo(sx - dx * 5 - dy * 2.5, sy - dy * 5 + dx * 1.4 + 2);
    ctx.closePath();
    ctx.fill();

    if (b.yacht) {
      ctx.fillStyle = 'rgba(255,252,244,0.92)';
      ctx.beginPath();
      ctx.moveTo(sx, sy - 1);
      ctx.lineTo(sx, sy - 11);
      ctx.lineTo(sx - dx * 4.5, sy - 2);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = pal.thatch;
      ctx.fillRect(sx - 2.5, sy - 2.2, 5, 2.5);
    }
  }
}

export function drawAmbientClouds(
  ctx: CanvasRenderingContext2D,
  sys: AmbientSystem,
  count: number,
  nightFactor: number
): void {
  const limit = Math.min(count, sys.clouds.length);
  if (limit <= 0) return;

  for (let i = 0; i < limit; i++) {
    const c = sys.clouds[i];
    // Warm autumn cloud shadow
    ctx.fillStyle = `rgba(34, 24, 20, ${c.alpha * 0.85 * (1 - nightFactor * 0.6)})`;
    ctx.beginPath();
    ctx.ellipse(c.wx + 40, c.wy + 55, c.rx * 0.9, c.ry * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    // Soft warm ivory-apricot autumn cloud puff
    const cloudCol =
      nightFactor > 0.5
        ? `rgba(175, 185, 222, ${c.alpha * 0.65})`
        : `rgba(255, 246, 230, ${c.alpha * 1.75})`;
    ctx.fillStyle = cloudCol;
    ctx.beginPath();
    ctx.ellipse(c.wx, c.wy, c.rx, c.ry, 0, 0, Math.PI * 2);
    ctx.ellipse(c.wx - c.rx * 0.42, c.wy + 4, c.rx * 0.62, c.ry * 0.78, 0, 0, Math.PI * 2);
    ctx.ellipse(c.wx + c.rx * 0.45, c.wy + 3, c.rx * 0.58, c.ry * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawFallingAutumnLeaves(
  ctx: CanvasRenderingContext2D,
  sys: AmbientSystem,
  count: number,
  viewW: number,
  viewH: number,
  nightFactor: number
): void {
  const limit = Math.min(count, sys.leaves.length);
  if (limit <= 0) return;

  const alpha = 0.88 - nightFactor * 0.35;
  ctx.save();
  for (let i = 0; i < limit; i++) {
    const lf = sys.leaves[i];
    const px = lf.x * viewW;
    const py = lf.y * viewH;
    const tilt = Math.sin(lf.phase) * 0.9;
    const flutter = 0.45 + Math.abs(Math.cos(lf.phase * 1.3)) * 0.55;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(tilt);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = lf.color;

    // Tapered autumn leaf silhouette
    ctx.beginPath();
    ctx.ellipse(0, 0, lf.size, lf.size * 0.48 * flutter, 0, 0, Math.PI * 2);
    ctx.fill();

    // Delicate center vein highlight
    ctx.strokeStyle = 'rgba(255, 248, 220, 0.45)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-lf.size * 0.7, 0);
    ctx.lineTo(lf.size * 0.7, 0);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
