import { useEffect, useRef } from 'react';
import {
  BUILDINGS,
  FOREIGN_INFO,
  FOREIGN_REGIONS,
  isForeignRegion,
  isLandmarkType,
  isPalaceCoord,
  MAP_H,
  MAP_W,
  PALACE_BOUNDS,
  REGION_NAMES,
} from '../constants';
import { formatMoney, getLandPrice, getMapHeight, isTetNightActive } from '../engine';
import { getViewState, GRAPHICS_PRESETS, store } from '../store';
import type { GameState, Plot, RegionId } from '../types';
import {
  createAmbientSystem,
  drawAmbientBoats,
  drawAmbientClouds,
  drawAmbientVehicles,
  drawFallingAutumnLeaves,
  stepAmbientSystem,
} from './ambientEntities';
import {
  drawForeignLandmark,
  drawSpecialBuilding,
  drawStandardBuilding,
  drawVietnameseTower,
  FOREIGN_LANDMARK_TYPES,
  isSpecialBuilding,
} from './buildings';
import {
  drawFlag,
  drawIndependencePalace,
  drawTetFireworks,
  readScenePalette,
  shadeHex,
  TILE_H,
  TILE_W,
  type ScenePalette,
} from './isoPrimitives';

const GROUND_COLORS: Record<RegionId, [string, string]> = {
  city: ['#d1c6b4', '#c5b9a6'],
  country: ['#c2b454', '#b6a749'],
  sea: ['#edd8a3', '#e4cd94'],
  mountain: ['#828f4e', '#768345'],
  china: ['#d3c2ae', '#c8b6a1'],
  laos: ['#b5b459', '#a9a84f'],
  thailand: ['#dccaa4', '#d1be97'],
  cambodia: ['#cfa971', '#c39e66'],
};

// Dynamic world-space chunk grid (supports unlimited map expansion at 60+ FPS)
const CHUNK_W = 680;
const CHUNK_H = 800;
const MAX_CACHED_CHUNKS = 24;

interface WorldChunk {
  id: string;
  col: number;
  row: number;
  wx: number;
  wy: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  key: string;
  lastUsed: number;
}

declare global {
  interface Window {
    __zoom?: (factor: number) => void;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(c1: [number, number, number], c2: [number, number, number], t: number): string {
  const k = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(lerp(c1[0], c2[0], k))},${Math.round(lerp(c1[1], c2[1], k))},${Math.round(
    lerp(c1[2], c2[2], k)
  )})`;
}

// Continuous 24h Autumn sky top/bottom colors + warm golden autumn haze
function getSkyAtmosphere(hour: number): {
  top: string;
  bottom: string;
  nightFactor: number;
  goldenFactor: number;
} {
  const NIGHT_T: [number, number, number] = [20, 26, 54];
  const NIGHT_B: [number, number, number] = [38, 46, 78];
  const DAWN_T: [number, number, number] = [132, 126, 168];
  const DAWN_B: [number, number, number] = [245, 192, 146];
  const DAY_T: [number, number, number] = [148, 186, 214];
  const DAY_B: [number, number, number] = [238, 222, 188];
  const DUSK_T: [number, number, number] = [118, 92, 138];
  const DUSK_B: [number, number, number] = [238, 148, 98];

  let top: string;
  let bottom: string;
  let nightFactor = 0;
  let goldenFactor = 0;

  if (hour < 5) {
    top = lerpRgb(NIGHT_T, NIGHT_T, 0);
    bottom = lerpRgb(NIGHT_B, NIGHT_B, 0);
    nightFactor = 1;
  } else if (hour < 6.5) {
    const t = (hour - 5) / 1.5;
    top = lerpRgb(NIGHT_T, DAWN_T, t);
    bottom = lerpRgb(NIGHT_B, DAWN_B, t);
    nightFactor = 1 - t * 0.72;
    goldenFactor = 0.25 + t * 0.65;
  } else if (hour < 9) {
    const t = (hour - 6.5) / 2.5;
    top = lerpRgb(DAWN_T, DAY_T, t);
    bottom = lerpRgb(DAWN_B, DAY_B, t);
    nightFactor = (1 - t) * 0.28;
    goldenFactor = 0.9 - t * 0.45;
  } else if (hour < 15.5) {
    top = lerpRgb(DAY_T, DAY_T, 0);
    bottom = lerpRgb(DAY_B, DAY_B, 0);
    nightFactor = 0;
    goldenFactor = 0.42; // crisp warm autumn sunlight all day
  } else if (hour < 18.5) {
    const t = (hour - 15.5) / 3;
    top = lerpRgb(DAY_T, DUSK_T, t);
    bottom = lerpRgb(DAY_B, DUSK_B, t);
    nightFactor = t * 0.35;
    goldenFactor = 0.45 + Math.sin(t * Math.PI) * 0.55;
  } else if (hour < 20.5) {
    const t = (hour - 18.5) / 2;
    top = lerpRgb(DUSK_T, NIGHT_T, t);
    bottom = lerpRgb(DUSK_B, NIGHT_B, t);
    nightFactor = 0.35 + t * 0.65;
    goldenFactor = (1 - t) * 0.35;
  } else {
    top = lerpRgb(NIGHT_T, NIGHT_T, 0);
    bottom = lerpRgb(NIGHT_B, NIGHT_B, 0);
    nightFactor = 1;
  }

  return { top, bottom, nightFactor, goldenFactor };
}

interface CityCanvasProps {
  onTap: (plotId: number | null) => void;
  onPalaceTap: () => void;
  fpsRef?: React.RefObject<HTMLSpanElement | null>;
}

export function CityCanvas({ onTap, onPalaceTap, fpsRef }: CityCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const camRef = useRef({
    x: 0,
    y: 0,
    z: 1,
    tx: 0,
    ty: 0,
    tz: 1,
    vx: 0,
    vy: 0,
    flyActive: false,
    init: false,
  });
  const hoverRef = useRef<{ plotId: number | null; palace: boolean; mx: number; my: number }>({
    plotId: null,
    palace: false,
    mx: 0,
    my: 0,
  });

  const onTapRef = useRef(onTap);
  const onPalaceTapRef = useRef(onPalaceTap);
  const fpsSpanRef = useRef(fpsRef);

  onTapRef.current = onTap;
  onPalaceTapRef.current = onPalaceTap;
  fpsSpanRef.current = fpsRef;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const screenCtx = canvas.getContext('2d', { alpha: false });
    if (!screenCtx) return;

    const pal = readScenePalette(canvas);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ambient = createAmbientSystem(56, 12, 10, 64);

    // Sparse dynamic chunk cache (grows seamlessly as new rows expand)
    const chunkMap = new Map<string, WorldChunk>();
    const getOrCreateChunk = (col: number, row: number): WorldChunk | null => {
      const id = `${col},${row}`;
      const existing = chunkMap.get(id);
      if (existing) return existing;

      // Evict least-recently-used chunk if cache exceeds cap
      if (chunkMap.size >= MAX_CACHED_CHUNKS) {
        let oldestId: string | null = null;
        let oldestTime = Infinity;
        for (const [cid, ch] of chunkMap) {
          if (ch.lastUsed < oldestTime) {
            oldestTime = ch.lastUsed;
            oldestId = cid;
          }
        }
        if (oldestId) chunkMap.delete(oldestId);
      }

      const c = document.createElement('canvas');
      const cctx = c.getContext('2d');
      if (!cctx) return null;
      const created: WorldChunk = {
        id,
        col,
        row,
        wx: col * CHUNK_W,
        wy: row * CHUNK_H,
        canvas: c,
        ctx: cctx,
        key: '',
        lastUsed: performance.now(),
      };
      chunkMap.set(id, created);
      return created;
    };

    // Precompute plot screen positions once (huge speedup during baking)
    const toScreen = (gx: number, gy: number): [number, number] => [(gx - gy) * TILE_W, (gx + gy) * TILE_H];

    const diamond = (ctx: CanvasRenderingContext2D, x: number, y: number, w = TILE_W, h = TILE_H) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + 2 * h);
      ctx.lineTo(x - w, y + h);
      ctx.closePath();
    };

    const drawSideDoor = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      baseY: number,
      w: number,
      h: number,
      t0: number,
      t1: number,
      z0: number,
      dh: number,
      rightSide: boolean
    ) => {
      const sign = rightSide ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(cx + sign * w * (1 - t0), baseY + h * t0 - z0);
      ctx.lineTo(cx + sign * w * (1 - t1), baseY + h * t1 - z0);
      ctx.lineTo(cx + sign * w * (1 - t1), baseY + h * t1 - z0 - dh);
      ctx.lineTo(cx + sign * w * (1 - t0), baseY + h * t0 - z0 - dh);
      ctx.closePath();
      ctx.fill();
    };

    const drawGovOrScaffoldBox = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      height: number,
      wallHex: string,
      roofHex: string,
      scale = 0.78
    ) => {
      const w = TILE_W * scale;
      const h = TILE_H * scale;
      const baseY = cy + TILE_H;
      const topY = baseY - height;

      ctx.fillStyle = 'rgba(10,18,34,0.24)';
      ctx.beginPath();
      ctx.ellipse(cx + 9, baseY + 8, w + 8, h + 2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = shadeHex(wallHex, -0.05);
      ctx.beginPath();
      ctx.moveTo(cx - w, topY);
      ctx.lineTo(cx, topY + h);
      ctx.lineTo(cx, baseY + h);
      ctx.lineTo(cx - w, baseY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = shadeHex(wallHex, -0.22);
      ctx.beginPath();
      ctx.moveTo(cx + w, topY);
      ctx.lineTo(cx, topY + h);
      ctx.lineTo(cx, baseY + h);
      ctx.lineTo(cx + w, baseY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = roofHex;
      diamond(ctx, cx, topY - h, w, h);
      ctx.fill();
      ctx.strokeStyle = pal.outline;
      ctx.lineWidth = 0.6;
      ctx.stroke();

      ctx.strokeStyle = pal.trim;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - w, topY);
      ctx.lineTo(cx, topY + h);
      ctx.lineTo(cx + w, topY);
      ctx.stroke();

      for (let z = 12; z < height; z += 12) {
        ctx.strokeStyle = pal.outline;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx - w, baseY - z);
        ctx.lineTo(cx, baseY + h - z);
        ctx.lineTo(cx + w, baseY - z);
        ctx.stroke();
      }

      ctx.fillStyle = pal.door;
      drawSideDoor(ctx, cx, baseY, w, h, 0.62, 0.84, 0, Math.min(9, height - 2), false);
      return topY;
    };

    const drawWildTree = (ctx: CanvasRenderingContext2D, cx: number, cy: number, sc = 1, pine = false) => {
      ctx.fillStyle = 'rgba(26,18,16,0.22)';
      ctx.beginPath();
      ctx.ellipse(cx + 3 * sc, cy + 2 * sc, 5.8 * sc, 2.8 * sc, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = pal.wood ?? pal.door;
      ctx.fillRect(cx - sc, cy - 7 * sc, 2 * sc, 8 * sc);

      const tone = Math.abs(Math.round(cx * 3 + cy * 5)) % 5;

      if (pine) {
        // Autumn highland trees: mix of evergreen pines, amber larch & maple crimson
        const sets: Array<[string, string, string]> = [
          ['#3a5433', '#5a7840', '#8fa34f'],
          ['#8a4c1f', '#cc7a29', '#edb24c'],
          ['#7a2f22', '#b84b34', '#df764e'],
          ['#485c34', '#728541', '#adb252'],
          ['#915722', '#d68f31', '#f3c65e'],
        ];
        const [c0, c1, c2] = sets[tone];
        ctx.fillStyle = c0;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 21 * sc);
        ctx.lineTo(cx + 6.5 * sc, cy - 5 * sc);
        ctx.lineTo(cx - 6.5 * sc, cy - 5 * sc);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 22 * sc);
        ctx.lineTo(cx + 5 * sc, cy - 10 * sc);
        ctx.lineTo(cx - 5 * sc, cy - 10 * sc);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 23 * sc);
        ctx.lineTo(cx + 3 * sc, cy - 15 * sc);
        ctx.lineTo(cx - 3 * sc, cy - 15 * sc);
        ctx.closePath();
        ctx.fill();
        return;
      }

      // Urban & countryside golden-red autumn foliage
      const canopySets: Array<[string, string, string]> = [
        ['#99541f', '#dd8e2e', '#f5c358'],
        ['#87371d', '#ca5f2b', '#eb8f48'],
        ['#782a20', '#ba4232', '#e06c50'],
        ['#4a6134', '#768c44', '#b0b858'],
        ['#9e6122', '#e3a137', '#f7d26a'],
      ];
      const [d0, d1, d2] = canopySets[tone];
      ctx.fillStyle = d0;
      ctx.beginPath();
      ctx.ellipse(cx + 1.2 * sc, cy - 9 * sc, 6 * sc, 7.2 * sc, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = d1;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 10 * sc, 6 * sc, 7.8 * sc, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = d2;
      ctx.beginPath();
      ctx.ellipse(cx - 2 * sc, cy - 13 * sc, 3.8 * sc, 4.6 * sc, -0.3, 0, 7);
      ctx.fill();
    };

    const drawBeachPalm = (ctx: CanvasRenderingContext2D, sx: number, sy: number) => {
      ctx.fillStyle = 'rgba(15,24,30,0.18)';
      ctx.beginPath();
      ctx.ellipse(sx + 3.5, sy + 15, 5.5, 2.2, 0, 0, 7);
      ctx.fill();
      ctx.strokeStyle = '#735331';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sx, sy + 15);
      ctx.quadraticCurveTo(sx + 2.5, sy + 9, sx + 0.5, sy + 4);
      ctx.stroke();
      ctx.strokeStyle = '#337a43';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (const [dx, dy] of [
        [-6.5, -1],
        [-3.5, -3.5],
        [3.5, -3.5],
        [6.5, -1],
        [0, 2.2],
      ]) {
        ctx.moveTo(sx + 0.5, sy + 4);
        ctx.quadraticCurveTo(sx + dx * 0.5, sy + 1.5 + dy, sx + dx, sy + 5.5 + dy);
      }
      ctx.stroke();
    };

    // Bake ONE world-space chunk at HiDPI resolution (only called when dirty)
    const bakeChunk = (
      chunk: WorldChunk,
      state: GameState,
      isNight: boolean,
      maxPricePerSqm: number,
      bakeScale: number,
      enableTextures: boolean,
      key: string
    ) => {
      const targetW = Math.round(CHUNK_W * bakeScale);
      const targetH = Math.round(CHUNK_H * bakeScale);
      if (chunk.canvas.width !== targetW || chunk.canvas.height !== targetH) {
        chunk.canvas.width = targetW;
        chunk.canvas.height = targetH;
      }

      const ctx = chunk.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, targetW, targetH);
      ctx.setTransform(bakeScale, 0, 0, bakeScale, -chunk.wx * bakeScale, -chunk.wy * bakeScale);

      const minX = chunk.wx - 70;
      const maxX = chunk.wx + CHUNK_W + 70;
      const minY = chunk.wy - 40;
      const maxY = chunk.wy + CHUNK_H + 240; // include tall landmarks whose bases sit below chunk bottom

      const inChunk = (sx: number, sy: number, extraH = 0) =>
        sx + TILE_W + 16 >= minX && sx - TILE_W - 16 <= maxX && sy + 40 >= minY && sy - extraH - 40 <= maxY;

      const mapH = getMapHeight(state);

      // Pass 1: Ground tiles, roads, rivers, terrain micro-textures
      for (let diag = 0; diag < MAP_W + mapH - 1; diag++) {
        const xMin = Math.max(0, diag - mapH + 1);
        const xMax = Math.min(diag, MAP_W - 1);
        for (let gx = xMin; gx <= xMax; gx++) {
          const gy = diag - gx;
          const [sx, sy] = toScreen(gx, gy);
          if (!inChunk(sx, sy)) continue;
          const plot = state.plots[gy * MAP_W + gx];
          if (!plot) continue;

          if (plot.kind === 'water') {
            const depth = gy === 28 ? 44 : Math.max(34, 48 - (gx + gy - 45) * 1.4);
            ctx.fillStyle = `hsl(201, 68%, ${depth}%)`;
            diamond(ctx, sx, sy);
            ctx.fill();
            // Subtle shallow foam near shore
            if (enableTextures && gy < 28 && gx + gy < 46.8) {
              ctx.strokeStyle = 'rgba(255,255,255,0.28)';
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.moveTo(sx - 18, sy + 9);
              ctx.lineTo(sx, sy + 1);
              ctx.lineTo(sx + 18, sy + 9);
              ctx.stroke();
            }
            continue;
          }

          if (plot.kind === 'road') {
            if (gy === 28) {
              ctx.fillStyle = pal.river;
              diamond(ctx, sx, sy);
              ctx.fill();
              // Bridge piers & concrete guardrails
              ctx.fillStyle = pal['stone-shade'];
              ctx.fillRect(sx - 4, sy + 18, 8, 11);
              ctx.fillStyle = pal.stone;
              ctx.fillRect(sx - 4, sy + 18, 3, 11);
              ctx.strokeStyle = pal.trim;
              ctx.lineWidth = 1.8;
              ctx.beginPath();
              ctx.moveTo(sx + 3, sy + 1.5);
              ctx.lineTo(sx - 29, sy + 17.5);
              ctx.moveTo(sx + 29, sy + 14.5);
              ctx.lineTo(sx - 3, sy + 30.5);
              ctx.stroke();
            } else {
              ctx.fillStyle = pal.pavement;
              diamond(ctx, sx, sy);
              ctx.fill();
            }

            const vert = gx % 6 === 0;
            const horiz = gy % 6 === 0;
            ctx.fillStyle = pal.asphalt;
            if (vert) {
              ctx.beginPath();
              ctx.moveTo(sx + 5, sy + 2.5);
              ctx.lineTo(sx + 27, sy + 13.5);
              ctx.lineTo(sx - 5, sy + 29.5);
              ctx.lineTo(sx - 27, sy + 18.5);
              ctx.closePath();
              ctx.fill();
            }
            if (horiz) {
              ctx.beginPath();
              ctx.moveTo(sx - 5, sy + 2.5);
              ctx.lineTo(sx + 27, sy + 18.5);
              ctx.lineTo(sx + 5, sy + 29.5);
              ctx.lineTo(sx - 27, sy + 13.5);
              ctx.closePath();
              ctx.fill();
            }

            ctx.strokeStyle = pal.lane;
            ctx.lineWidth = 0.85;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            if (vert && !horiz) {
              ctx.moveTo(sx + 16, sy + 8);
              ctx.lineTo(sx - 16, sy + 24);
            }
            if (horiz && !vert) {
              ctx.moveTo(sx - 16, sy + 8);
              ctx.lineTo(sx + 16, sy + 24);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            if (vert && horiz) {
              ctx.strokeStyle = pal.trim;
              ctx.lineWidth = 1.8;
              for (let s = 0; s < 4; s++) {
                ctx.beginPath();
                ctx.moveTo(sx - 19 + s * 4, sy + 8 + s * 2);
                ctx.lineTo(sx - 12 + s * 4, sy + 4.5 + s * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(sx + 12 + s * 4, sy + 20 - s * 2);
                ctx.lineTo(sx + 19 + s * 4, sy + 23.5 - s * 2);
                ctx.stroke();
              }
              // Intersection streetlamp pole
              if (enableTextures && gy !== 28) {
                ctx.fillStyle = '#555d68';
                ctx.fillRect(sx - 23, sy + 4, 1.3, 10);
                ctx.fillStyle = isNight ? pal['led-gold'] : '#d4dae0';
                ctx.beginPath();
                ctx.arc(sx - 22.4, sy + 4, 1.6, 0, 7);
                ctx.fill();
              }
            }
            continue;
          }

          ctx.fillStyle = GROUND_COLORS[plot.region][(gx + gy) % 2];
          diamond(ctx, sx, sy);
          ctx.fill();

          if (enableTextures && !plot.b) {
            if (plot.region === 'country') {
              // Terraced rice paddy stripes & water sheen
              ctx.strokeStyle = 'rgba(55, 98, 28, 0.32)';
              ctx.lineWidth = 0.9;
              ctx.beginPath();
              for (let f = -2; f <= 2; f++) {
                ctx.moveTo(sx - 5 + f * 5, sy + TILE_H - 6 + f * 2.5);
                ctx.lineTo(sx + 7 + f * 5, sy + TILE_H - 0.5 + f * 2.5);
              }
              ctx.stroke();
            } else if (plot.region === 'city') {
              // Subtle urban paving grid
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
              ctx.lineWidth = 0.6;
              ctx.beginPath();
              ctx.moveTo(sx - 15, sy + 8.5);
              ctx.lineTo(sx + 15, sy + 23.5);
              ctx.moveTo(sx + 15, sy + 8.5);
              ctx.lineTo(sx - 15, sy + 23.5);
              ctx.stroke();
            } else if (plot.region === 'sea') {
              // Warm sunlit sand ripples
              ctx.strokeStyle = 'rgba(184, 152, 92, 0.25)';
              ctx.lineWidth = 0.7;
              ctx.beginPath();
              ctx.moveTo(sx - 10, sy + 14);
              ctx.quadraticCurveTo(sx, sy + 12, sx + 10, sy + 15);
              ctx.moveTo(sx - 7, sy + 20);
              ctx.quadraticCurveTo(sx + 2, sy + 18, sx + 9, sy + 21);
              ctx.stroke();
            } else if (plot.region === 'mountain') {
              // Subtle highland contour dots
              ctx.fillStyle = 'rgba(40, 70, 32, 0.2)';
              ctx.beginPath();
              ctx.ellipse(sx - 6, sy + 17, 5, 2.2, 0.2, 0, 7);
              ctx.ellipse(sx + 8, sy + 13, 4, 1.8, -0.2, 0, 7);
              ctx.fill();
            }
          }

          if (state.heatmap && plot.kind === 'land') {
            const ratio = getLandPrice(state, plot) / plot.area / maxPricePerSqm;
            ctx.fillStyle = `hsla(${120 - ratio * 120},90%,50%,0.52)`;
            diamond(ctx, sx, sy);
            ctx.fill();
          }

          ctx.strokeStyle = 'rgba(0,0,0,0.075)';
          ctx.lineWidth = 0.7;
          diamond(ctx, sx, sy);
          ctx.stroke();

          if (isForeignRegion(plot.region) && gx % 7 === 0 && gx > 0) {
            ctx.strokeStyle = pal['vehicle-red'];
            ctx.lineWidth = 1.25;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx - TILE_W, sy + TILE_H);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }

      // Dinh Doc Lap & entrance road
      const [palX, palY] = toScreen(PALACE_BOUNDS.x, PALACE_BOUNDS.y);
      if (inChunk(palX, palY, 80)) {
        for (let py = -1; py <= 0; py++) {
          const [rx, ry] = toScreen(PALACE_BOUNDS.x, py);
          ctx.fillStyle = pal.pavement;
          diamond(ctx, rx, ry);
          ctx.fill();
          ctx.fillStyle = pal.asphalt;
          diamond(ctx, rx, ry + 3, 26, 13);
          ctx.fill();
        }
        drawIndependencePalace(ctx, palX, palY, pal, false);
      }

      // Pass 2: Buildings, ownership borders, trees, gov halls
      for (let diag = 0; diag < MAP_W + mapH - 1; diag++) {
        const xMin = Math.max(0, diag - mapH + 1);
        const xMax = Math.min(diag, MAP_W - 1);
        for (let gx = xMin; gx <= xMax; gx++) {
          const gy = diag - gx;
          const plot = state.plots[gy * MAP_W + gx];
          if (!plot) continue;
          const [sx, sy] = toScreen(gx, gy);
          const estH = plot.b ? BUILDINGS[plot.b.type].height * (1 + (plot.b.level - 1) * 0.35) : 60;
          if (!inChunk(sx, sy, estH)) continue;

          if (plot.owner === 'me' || plot.owner?.startsWith('r')) {
            ctx.lineWidth = 1.8;
            ctx.strokeStyle = plot.owner === 'me' ? '#ffc53d' : '#e5484d';
            diamond(ctx, sx, sy + 1, 30, 15);
            ctx.stroke();
          }

          if (plot.forSale && plot.owner !== 'me' && !plot.b) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(sx - 1, sy + 4, 1.5, 10);
            ctx.fillStyle = '#e5484d';
            ctx.fillRect(sx, sy + 4, 7.5, 5);
          }

          if (plot.kind === 'gov') {
            const isForeign = Boolean(plot.gov?.startsWith('gov_'));
            drawGovOrScaffoldBox(
              ctx,
              sx,
              sy,
              isForeign ? 40 : 30,
              isForeign ? '#f4efe6' : '#f6efe0',
              isForeign ? '#c9a227' : '#b23a2e',
              0.85
            );
            continue;
          }

          if (plot.b) {
            const def = BUILDINGS[plot.b.type];
            if (plot.b.buildLeft > 0) {
              const progress = 1 - plot.b.buildLeft / def.days;
              drawGovOrScaffoldBox(ctx, sx, sy, Math.max(4, def.height * progress), '#d6c7a1', '#c4a35a');
              ctx.strokeStyle = '#f2b705';
              ctx.lineWidth = 1;
              ctx.strokeRect(sx - 18, sy + TILE_H - def.height - 6, 36, def.height + 6);
            } else {
              const h = def.height * (1 + (plot.b.level - 1) * 0.35);
              if (FOREIGN_LANDMARK_TYPES.includes(plot.b.type)) {
                drawForeignLandmark(ctx, sx, sy, h, plot.b.type, isNight, pal);
                continue;
              }
              if (isSpecialBuilding(plot.b.type)) {
                drawSpecialBuilding(ctx, sx, sy, h, plot.b.type, plot.id, isNight, pal, plot.b.level, plot.b.paint);
                continue;
              }
              if (plot.b.type === 'thap_81' || plot.b.type === 'thap_sen') {
                drawVietnameseTower(ctx, sx, sy + TILE_H, h, plot.b.type === 'thap_81', isNight, pal);
                continue;
              }
              drawStandardBuilding(ctx, sx, sy, h, plot.b.type, plot.id, isNight, pal, plot.region, plot.b.level, plot.b.paint);
            }
          } else if (plot.kind === 'land') {
            if (plot.region === 'mountain') {
              drawWildTree(ctx, sx - 8, sy + 14, 0.72, true);
              drawWildTree(ctx, sx + 9, sy + 21, 0.72, true);
            }
            if (plot.region === 'sea' && (gx + gy) % 3 === 0) {
              drawBeachPalm(ctx, sx, sy);
            }
            if (plot.region === 'city' && (gx * 7 + gy) % 5 === 0) {
              drawWildTree(ctx, sx, sy + 17, 0.65, false);
            }
          }
        }
      }

      // Country banners & Mekong labels
      ctx.font = "bold 8px 'Be Vietnam Pro', sans-serif";
      ctx.textAlign = 'center';
      FOREIGN_REGIONS.forEach((reg, idx) => {
        const [bx, by] = toScreen(idx * 7 + 3.5, 29);
        if (!inChunk(bx, by)) return;
        const label = `${REGION_NAMES[reg]} · ${FOREIGN_INFO[reg].city}`;
        ctx.fillStyle = 'rgba(10, 15, 38, 0.76)';
        ctx.beginPath();
        ctx.roundRect(bx - 44, by + 5, 88, 13, 4);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 210, 100, 0.45)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
        ctx.fillStyle = pal['led-gold'];
        ctx.fillText(label, bx, by + 14.5);
      });
      for (const rx of [4, 15, 25]) {
        const [mx, my] = toScreen(rx, 28);
        if (!inChunk(mx, my)) continue;
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.fillText('SÔNG MÊ KÔNG', mx, my + 19);
      }
      ctx.textAlign = 'start';

      chunk.key = key;
    };

    const getDpr = () => Math.min(window.devicePixelRatio || 1, GRAPHICS_PRESETS[store.graphicsQuality].maxDpr);

    let lastDpr = getDpr();
    const resize = () => {
      lastDpr = getDpr();
      const prevW = canvas.width / lastDpr;
      const prevH = canvas.height / lastDpr;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * lastDpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * lastDpr));
      if (camRef.current.init) {
        camRef.current.x += (canvas.clientWidth - prevW) / 2;
        camRef.current.y += (canvas.clientHeight - prevH) / 2;
        camRef.current.tx = camRef.current.x;
        camRef.current.ty = camRef.current.y;
      } else {
        camRef.current.x = canvas.clientWidth / 2;
        camRef.current.y = canvas.clientHeight / 2 - 28 * TILE_H * camRef.current.z;
        camRef.current.tx = camRef.current.x;
        camRef.current.ty = camRef.current.y;
        camRef.current.tz = camRef.current.z;
        camRef.current.init = true;
      }
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    window.visualViewport?.addEventListener('resize', resize);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    // Pre-collect gov plots & road intersections for fast animated overlay
    let cachedGovPlots: Plot[] = [];
    let cachedIntersections: Array<[number, number]> = [];
    let cachedLandmarkPlots: Plot[] = [];
    let cachedPlotsRef: Plot[] | null = null;
    let cachedPlotsLen = 0;

    const rebuildFastLists = (state: GameState) => {
      const mapH = getMapHeight(state);
      cachedPlotsRef = state.plots;
      cachedPlotsLen = state.plots.length;
      cachedGovPlots = state.plots.filter((p) => p.kind === 'gov');
      cachedIntersections = [];
      for (let gy = 0; gy < mapH; gy += 6) {
        for (let gx = 0; gx < MAP_W; gx += 6) {
          if (gy !== 28) cachedIntersections.push(toScreen(gx, gy));
        }
      }
      cachedLandmarkPlots = state.plots.filter((p) => p.b && isLandmarkType(p.b.type));
    };

    // FPS tracking (zero React re-renders!)
    let rafId = 0;
    let prevNow = performance.now();
    let fpsFrames = 0;
    let fpsAccumMs = 0;
    let fpsLastFlush = prevNow;

    const renderFrame = (now: number) => {
      rafId = requestAnimationFrame(renderFrame);
      if (document.hidden) {
        prevNow = now;
        return;
      }

      const rawDtMs = now - prevNow;
      prevNow = now;
      const dtSec = Math.min(rawDtMs / 1000, 0.05);

      const state = getViewState();
      if (!state) return;

      const preset = GRAPHICS_PRESETS[store.graphicsQuality];
      const desiredDpr = Math.min(window.devicePixelRatio || 1, preset.maxDpr);
      const expectW = Math.max(1, Math.round(canvas.clientWidth * desiredDpr));
      const expectH = Math.max(1, Math.round(canvas.clientHeight * desiredDpr));
      if (desiredDpr !== lastDpr || canvas.width !== expectW || canvas.height !== expectH) {
        resize();
      }

      const mapH = getMapHeight(state);
      if (cachedPlotsRef !== state.plots || cachedPlotsLen !== state.plots.length) rebuildFastLists(state);

      // Smooth camera physics (fly-to, damped zoom, inertial pan)
      const cam = camRef.current;
      const lerpAlpha = 1 - Math.exp(-dtSec * 14);
      if (cam.flyActive) {
        cam.x += (cam.tx - cam.x) * lerpAlpha;
        cam.y += (cam.ty - cam.y) * lerpAlpha;
        cam.z += (cam.tz - cam.z) * lerpAlpha;
        if (
          Math.abs(cam.tx - cam.x) < 0.4 &&
          Math.abs(cam.ty - cam.y) < 0.4 &&
          Math.abs(cam.tz - cam.z) < 0.002
        ) {
          cam.x = cam.tx;
          cam.y = cam.ty;
          cam.z = cam.tz;
          cam.flyActive = false;
        }
      } else {
        if (Math.abs(cam.vx) > 0.05 || Math.abs(cam.vy) > 0.05) {
          cam.x += cam.vx * dtSec;
          cam.y += cam.vy * dtSec;
          const damp = Math.exp(-dtSec * 7.5);
          cam.vx *= damp;
          cam.vy *= damp;
        }
        if (Math.abs(cam.tz - cam.z) > 0.0008) {
          const prevZ = cam.z;
          cam.z += (cam.tz - cam.z) * lerpAlpha;
          const ratio = cam.z / prevZ;
          cam.x = cam.tx - (cam.tx - cam.x) * ratio;
          cam.y = cam.ty - (cam.ty - cam.y) * ratio;
        }
      }

      // Step living world entities
      if (!reducedMotion) {
        stepAmbientSystem(ambient, dtSec, state.speed, state.paused || !state.tutorialDone, mapH);
      }

      const dpr = lastDpr;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      const tSec = now / 1000;
      const isNight = state.hour < 6 || state.hour >= 18;
      const tetNight = isTetNightActive(state);
      const atmo = getSkyAtmosphere(state.hour);

      // 1. Continuous 24h Sky Gradient
      screenCtx.setTransform(1, 0, 0, 1, 0, 0);
      const skyGrad = screenCtx.createLinearGradient(0, 0, 0, canvas.height);
      skyGrad.addColorStop(0, atmo.top);
      skyGrad.addColorStop(1, atmo.bottom);
      screenCtx.fillStyle = skyGrad;
      screenCtx.fillRect(0, 0, canvas.width, canvas.height);

      // Viewport bounds in world space
      const viewMinX = -cam.x / cam.z;
      const viewMinY = -cam.y / cam.z;
      const viewMaxX = (cw - cam.x) / cam.z;
      const viewMaxY = (ch - cam.y) / cam.z;

      const isVisible = (sx: number, sy: number, pad = 48) =>
        sx + pad >= viewMinX && sx - pad <= viewMaxX && sy + pad >= viewMinY && sy - pad <= viewMaxY;

      // 2. Blit visible HiDPI cached world chunks (bake lazily only if dirty!)
      const viewId = store.visiting?.userId ?? 'self';
      const chunkKey = `${viewId}:${store.version}:${state.plots.length}:${isNight ? 1 : 0}:${state.heatmap ? 1 : 0}:${store.graphicsQuality}`;
      let maxPricePerSqm = -1;

      screenCtx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * cam.x, dpr * cam.y);
      screenCtx.imageSmoothingEnabled = true;
      screenCtx.imageSmoothingQuality = 'high';

      const worldMinX = -mapH * TILE_W - 120;
      const worldMaxX = MAP_W * TILE_W + 140;
      const worldMinY = -260;
      const worldMaxY = (MAP_W + mapH) * TILE_H + 80;

      const colStart = Math.floor(Math.max(viewMinX, worldMinX) / CHUNK_W);
      const colEnd = Math.floor(Math.min(viewMaxX, worldMaxX) / CHUNK_W);
      const rowStart = Math.floor(Math.max(viewMinY, worldMinY) / CHUNK_H);
      const rowEnd = Math.floor(Math.min(viewMaxY, worldMaxY) / CHUNK_H);

      for (let row = rowStart; row <= rowEnd; row++) {
        for (let col = colStart; col <= colEnd; col++) {
          const chunk = getOrCreateChunk(col, row);
          if (!chunk) continue;
          chunk.lastUsed = now;
          if (chunk.key !== chunkKey) {
            if (maxPricePerSqm < 0) {
              maxPricePerSqm = 1;
              if (state.heatmap) {
                for (const p of state.plots) {
                  if (p.kind === 'land') maxPricePerSqm = Math.max(maxPricePerSqm, getLandPrice(state, p) / p.area);
                }
              }
            }
            bakeChunk(chunk, state, isNight, maxPricePerSqm, preset.bakeScale, preset.textures, chunkKey);
          }
          screenCtx.drawImage(chunk.canvas, chunk.wx, chunk.wy, CHUNK_W, CHUNK_H);
        }
      }

      // 3. Dynamic animated layer (water glints, waving flags, cranes, vehicles, boats, selection/hover)
      if (preset.waterSparkles) {
        screenCtx.fillStyle = `rgba(255, 255, 255, ${0.26 * (1 - atmo.nightFactor * 0.55)})`;
        for (let i = 0; i < 24; i++) {
          const isRiver = i < 14;
          const gx = isRiver ? (i * 2.1 + Math.sin(tSec * 0.8 + i) * 0.4) % MAP_W : 20.5 + (i % 7) * 0.95;
          const gy = isRiver ? 28.45 : 21.5 + ((i * 3) % 6) * 0.9;
          if (!isRiver && gx + gy <= 45.8) continue;
          const [sx, sy] = toScreen(gx, gy);
          if (!isVisible(sx, sy)) continue;
          const w = 3 + Math.sin(tSec * 2.8 + i * 1.7) * 2.5;
          if (w > 1.2) screenCtx.fillRect(sx - w, sy, w * 2, 1.1);
        }
      }

      // Waving flags on gov buildings
      for (const g of cachedGovPlots) {
        const [sx, sy] = toScreen(g.x, g.y);
        if (!isVisible(sx, sy, 60)) continue;
        const isForeign = Boolean(g.gov?.startsWith('gov_'));
        const topY = sy + TILE_H - (isForeign ? 40 : 30);
        drawFlag(screenCtx, sx, topY - 2, isForeign ? g.region : 'vietnam', tSec);
      }

      // Active construction cranes + progress bars
      for (const p of state.plots) {
        if (!p.b || p.b.buildLeft <= 0) continue;
        const [sx, sy] = toScreen(p.x, p.y);
        const def = BUILDINGS[p.b.type];
        if (!isVisible(sx, sy, def.height + 40)) continue;

        const bob = Math.sin(tSec * 3.5 + p.id) * 2.2;
        screenCtx.fillStyle = '#f2b705';
        screenCtx.fillRect(sx + 10, sy + TILE_H - def.height - 14 + bob, 2, 10);
        // Crane jib arm
        screenCtx.strokeStyle = '#facc15';
        screenCtx.lineWidth = 1.2;
        screenCtx.beginPath();
        screenCtx.moveTo(sx + 11, sy + TILE_H - def.height - 13 + bob);
        screenCtx.lineTo(sx - 6 + Math.cos(tSec + p.id) * 4, sy + TILE_H - def.height - 10 + bob);
        screenCtx.stroke();

        // Compact build progress bar
        const pct = Math.max(0.05, Math.min(1, 1 - p.b.buildLeft / def.days));
        const barY = sy + TILE_H - def.height - 19;
        screenCtx.fillStyle = 'rgba(15, 20, 32, 0.78)';
        screenCtx.fillRect(sx - 13, barY, 26, 4);
        screenCtx.fillStyle = '#facc15';
        screenCtx.fillRect(sx - 12, barY + 1, 24 * pct, 2);
      }

      // Vehicles & boats
      drawAmbientBoats(screenCtx, ambient, preset.boats, tSec, pal, isVisible);
      drawAmbientVehicles(screenCtx, ambient, preset.vehicles, pal, atmo.nightFactor, isVisible);

      // Hover diamond highlight (desktop)
      const hov = hoverRef.current;
      if (hov.plotId !== null && hov.plotId !== store.selected) {
        const hp = state.plots[hov.plotId];
        if (hp && hp.kind !== 'road' && hp.kind !== 'water') {
          const [hx, hy] = toScreen(hp.x, hp.y);
          screenCtx.fillStyle = 'rgba(255, 255, 255, 0.14)';
          diamond(screenCtx, hx, hy, TILE_W - 1, TILE_H - 0.5);
          screenCtx.fill();
          screenCtx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
          screenCtx.lineWidth = 1.2;
          screenCtx.stroke();
        }
      }

      // Pulsing selected plot border
      if (store.selected !== null) {
        const sp = state.plots[store.selected];
        if (sp) {
          const [sx, sy] = toScreen(sp.x, sp.y);
          const pulse = 0.75 + Math.sin(tSec * 5) * 0.25;
          screenCtx.lineWidth = 2.6;
          screenCtx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
          diamond(screenCtx, sx, sy + 1, 30, 15);
          screenCtx.stroke();
        }
      }

      // Soft drifting clouds & shadows
      if (preset.clouds > 0) {
        drawAmbientClouds(screenCtx, ambient, preset.clouds, atmo.nightFactor);
      }

      // Floating FX (+money, Hoàn thành!, Trúng đấu giá!)
      store.fx = store.fx.filter((fx) => now - fx.t < 1800);
      for (const fx of store.fx) {
        const p = (now - fx.t) / 1800;
        const [sx, sy] = toScreen(fx.x, fx.y);
        screenCtx.globalAlpha = 1 - p;
        screenCtx.font = "bold 9.5px 'Be Vietnam Pro', sans-serif";
        screenCtx.textAlign = 'center';
        screenCtx.lineWidth = 3;
        screenCtx.strokeStyle = 'rgba(0,0,0,0.65)';
        screenCtx.strokeText(fx.text, sx, sy - 20 - p * 32);
        screenCtx.fillStyle = fx.color;
        screenCtx.fillText(fx.text, sx, sy - 20 - p * 32);
        if (p < 0.4) {
          for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2;
            screenCtx.fillStyle = fx.color;
            screenCtx.fillRect(sx + Math.cos(ang) * p * 52, sy + TILE_H + Math.sin(ang) * p * 26, 2.2, 2.2);
          }
        }
        screenCtx.globalAlpha = 1;
        screenCtx.textAlign = 'start';
      }

      // 4. Atmospheric autumn sunlight & night lighting + radial night blooms
      screenCtx.setTransform(1, 0, 0, 1, 0, 0);
      if (atmo.goldenFactor > 0.02) {
        const sunGrad = screenCtx.createLinearGradient(0, 0, canvas.width, canvas.height);
        sunGrad.addColorStop(0, `rgba(255, 205, 118, ${atmo.goldenFactor * 0.17})`);
        sunGrad.addColorStop(0.55, `rgba(255, 178, 92, ${atmo.goldenFactor * 0.09})`);
        sunGrad.addColorStop(1, `rgba(215, 128, 72, ${atmo.goldenFactor * 0.05})`);
        screenCtx.fillStyle = sunGrad;
        screenCtx.fillRect(0, 0, canvas.width, canvas.height);
      }
      if (atmo.nightFactor > 0.02) {
        screenCtx.fillStyle = `rgba(14, 18, 44, ${atmo.nightFactor * 0.45})`;
        screenCtx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Drifting falling autumn leaves across the screen
      if (!reducedMotion && preset.leaves > 0) {
        screenCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawFallingAutumnLeaves(screenCtx, ambient, preset.leaves, cw, ch, atmo.nightFactor);
      }

      // Additive warm streetlamp & landmark glow blooms at night
      if (preset.nightGlow && atmo.nightFactor > 0.25) {
        screenCtx.save();
        screenCtx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * cam.x, dpr * cam.y);
        screenCtx.globalCompositeOperation = 'lighter';

        const glowA = atmo.nightFactor * 0.28;
        for (const [ix, iy] of cachedIntersections) {
          if (!isVisible(ix, iy, 30)) continue;
          const g = screenCtx.createRadialGradient(ix - 22, iy + 5, 0, ix - 22, iy + 5, 22);
          g.addColorStop(0, `rgba(255, 220, 130, ${glowA})`);
          g.addColorStop(1, 'rgba(255, 200, 90, 0)');
          screenCtx.fillStyle = g;
          screenCtx.beginPath();
          screenCtx.arc(ix - 22, iy + 5, 22, 0, 7);
          screenCtx.fill();
        }

        for (const lm of cachedLandmarkPlots) {
          const [lx, ly] = toScreen(lm.x, lm.y);
          const lh = lm.b ? BUILDINGS[lm.b.type].height : 80;
          if (!isVisible(lx, ly, lh + 40)) continue;
          const g = screenCtx.createRadialGradient(lx, ly - lh * 0.45, 4, lx, ly - lh * 0.45, 58);
          g.addColorStop(0, `rgba(120, 215, 255, ${atmo.nightFactor * 0.22})`);
          g.addColorStop(1, 'rgba(120, 215, 255, 0)');
          screenCtx.fillStyle = g;
          screenCtx.beginPath();
          screenCtx.arc(lx, ly - lh * 0.45, 58, 0, 7);
          screenCtx.fill();
        }

        screenCtx.restore();
      }

      // 5. Tet festival LED outlines & fireworks
      if (tetNight) {
        screenCtx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * cam.x, dpr * cam.y);
        const leds = [pal['led-pink'], pal['led-cyan'], pal['led-gold']];
        for (const plot of state.plots) {
          const [sx, sy] = toScreen(plot.x, plot.y);
          const h = plot.b ? BUILDINGS[plot.b.type].height * (1 + (plot.b.level - 1) * 0.35) : 0;
          if (!isVisible(sx, sy, h + 30)) continue;
          if (plot.b && plot.b.buildLeft === 0) {
            screenCtx.strokeStyle = leds[plot.id % 3];
            screenCtx.lineWidth = 1.25;
            screenCtx.beginPath();
            screenCtx.moveTo(sx - 18, sy + TILE_H - h * 0.7);
            screenCtx.lineTo(sx, sy + TILE_H + 8 - h * 0.7);
            screenCtx.lineTo(sx + 18, sy + TILE_H - h * 0.7);
            screenCtx.stroke();
            if (isLandmarkType(plot.b.type)) {
              for (let lz = 12; lz < h; lz += 16) {
                screenCtx.strokeStyle = leds[Math.floor(lz / 16) % 3];
                screenCtx.beginPath();
                screenCtx.moveTo(sx - 12, sy + TILE_H - lz);
                screenCtx.lineTo(sx + 12, sy + TILE_H - lz);
                screenCtx.stroke();
              }
            }
          }
          if (plot.kind === 'road' && (plot.x + plot.y) % 3 === 0) {
            for (let i = 0; i < 5; i++) {
              screenCtx.fillStyle = leds[i % 3];
              screenCtx.fillRect(sx - 14 + i * 7, sy + 12 + Math.sin(i) * 2, 2.1, 2.1);
            }
          }
        }
        screenCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawTetFireworks(screenCtx, cw, ch, tSec, pal, reducedMotion);
      }

      // 6. Crisp desktop hover micro-tooltip (drawn in screen space, zero React state!)
      if (hov.plotId !== null && pointers.size === 0) {
        const hp = state.plots[hov.plotId];
        if (hp && hp.kind !== 'road' && hp.kind !== 'water') {
          screenCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const label =
            hp.kind === 'gov'
              ? `🏛 Cơ quan hành chính · ${REGION_NAMES[hp.region]}`
              : hp.b
                ? `#${hp.id} · ${BUILDINGS[hp.b.type].name} c${hp.b.level}`
                : `#${hp.id} · ${REGION_NAMES[hp.region]} · ${formatMoney(getLandPrice(state, hp))}`;
          screenCtx.font = "600 11px 'Be Vietnam Pro', sans-serif";
          const tw = screenCtx.measureText(label).width + 16;
          const bx = Math.min(cw - tw - 10, Math.max(10, hov.mx + 14));
          const by = Math.max(96, hov.my - 28);
          screenCtx.fillStyle = 'rgba(20, 25, 32, 0.88)';
          screenCtx.beginPath();
          screenCtx.roundRect(bx, by, tw, 22, 7);
          screenCtx.fill();
          screenCtx.strokeStyle = 'rgba(234, 179, 8, 0.45)';
          screenCtx.lineWidth = 1;
          screenCtx.stroke();
          screenCtx.fillStyle = '#f8fafc';
          screenCtx.fillText(label, bx + 8, by + 14.5);
        }
      }

      // 7. FPS & Frame-Time telemetry update every 300ms
      fpsFrames += 1;
      fpsAccumMs += rawDtMs;
      if (now - fpsLastFlush >= 300) {
        const el = fpsSpanRef.current?.current;
        if (el) {
          const fps = Math.round((fpsFrames * 1000) / Math.max(1, now - fpsLastFlush));
          const avgMs = (fpsAccumMs / Math.max(1, fpsFrames)).toFixed(1);
          el.textContent = `${fps} FPS · ${avgMs}ms`;
        }
        fpsFrames = 0;
        fpsAccumMs = 0;
        fpsLastFlush = now;
      }
    };

    // Pointer pan with inertia, pinch-zoom, smooth damped wheel zoom, hover & tap hit-test
    const pointers = new Map<number, { x: number; y: number }>();
    let dragDist = 0;
    let pinchStartDist = 0;
    let pinchStartZoom = 1;
    let lastMoveTime = 0;

    const smoothZoomAt = (screenX: number, screenY: number, nextZ: number) => {
      const clamped = Math.min(4, Math.max(0.5, nextZ));
      camRef.current.flyActive = false;
      camRef.current.tx = screenX;
      camRef.current.ty = screenY;
      camRef.current.tz = clamped;
    };

    const instantZoomAt = (screenX: number, screenY: number, nextZ: number) => {
      const clamped = Math.min(4, Math.max(0.5, nextZ));
      const ratio = clamped / camRef.current.z;
      camRef.current.x = screenX - (screenX - camRef.current.x) * ratio;
      camRef.current.y = screenY - (screenY - camRef.current.y) * ratio;
      camRef.current.z = clamped;
      camRef.current.tz = clamped;
    };

    const pickTileAt = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const wx = (mx - camRef.current.x) / camRef.current.z;
      const wy = (my - camRef.current.y) / camRef.current.z;
      const gx = Math.floor((wx / TILE_W + wy / TILE_H) / 2);
      const gy = Math.floor((wy / TILE_H - wx / TILE_W) / 2);
      return { gx, gy, mx, my };
    };

    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      dragDist = 0;
      camRef.current.flyActive = false;
      camRef.current.vx = 0;
      camRef.current.vy = 0;
      lastMoveTime = performance.now();
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y);
        pinchStartZoom = camRef.current.z;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) {
        if (e.pointerType === 'mouse') {
          const { gx, gy, mx, my } = pickTileAt(e.clientX, e.clientY);
          const vs = getViewState();
          const curMapH = vs ? getMapHeight(vs) : MAP_H;
          hoverRef.current = {
            plotId: gx >= 0 && gy >= 0 && gx < MAP_W && gy < curMapH ? gy * MAP_W + gx : null,
            palace: isPalaceCoord(gx, gy),
            mx,
            my,
          };
        }
        return;
      }

      const now = performance.now();
      const dt = Math.max(0.008, (now - lastMoveTime) / 1000);
      lastMoveTime = now;

      if (pointers.size === 1) {
        const dx = e.clientX - p.x;
        const dy = e.clientY - p.y;
        camRef.current.x += dx;
        camRef.current.y += dy;
        camRef.current.vx = dx / dt;
        camRef.current.vy = dy / dt;
        dragDist += Math.abs(dx) + Math.abs(dy);
      }
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 2 && pinchStartDist > 0) {
        const [a, b] = [...pointers.values()];
        const rect = canvas.getBoundingClientRect();
        dragDist = 99;
        camRef.current.vx = 0;
        camRef.current.vy = 0;
        instantZoomAt(
          (a.x + b.x)/2 - rect.left,
          (a.y + b.y)/2 - rect.top,
          (pinchStartZoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinchStartDist
        );
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const prevCount = pointers.size;
      pointers.delete(e.pointerId);
      if (prevCount === 1 && dragDist < 8) {
        camRef.current.vx = 0;
        camRef.current.vy = 0;
        const { gx, gy } = pickTileAt(e.clientX, e.clientY);
        if (isPalaceCoord(gx, gy)) {
          onPalaceTapRef.current();
          return;
        }
        const vs = getViewState();
        const curMapH = vs ? getMapHeight(vs) : MAP_H;
        onTapRef.current(gx >= 0 && gy >= 0 && gx < MAP_W && gy < curMapH ? gy * MAP_W + gx : null);
      } else {
        // Clamp inertia speed so flicking feels crisp, not chaotic
        camRef.current.vx = Math.max(-1800, Math.min(1800, camRef.current.vx * 0.65));
        camRef.current.vy = Math.max(-1800, Math.min(1800, camRef.current.vy * 0.65));
      }
    };

    const onPointerLeave = () => {
      hoverRef.current.plotId = null;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      smoothZoomAt(e.clientX - rect.left, e.clientY - rect.top, camRef.current.tz * Math.exp(-delta * 0.0014));
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const onCityFocus = (e: Event) => {
      const plotId = (e as CustomEvent<number>).detail;
      const plot = getViewState()?.plots[plotId];
      if (!plot) return;
      const [sx, sy] = toScreen(plot.x, plot.y);
      const tz = 1.25;
      camRef.current.tz = tz;
      camRef.current.tx = canvas.clientWidth / 2 - sx * tz;
      camRef.current.ty =
        canvas.clientHeight * 0.54 - (sy - (plot.b ? BUILDINGS[plot.b.type].height * 0.35 : 0)) * tz;
      camRef.current.vx = 0;
      camRef.current.vy = 0;
      camRef.current.flyActive = true;
    };

    const onPalaceFocus = () => {
      const [sx, sy] = toScreen(PALACE_BOUNDS.x + 1, PALACE_BOUNDS.y + 1);
      const tz = 2;
      camRef.current.tz = tz;
      camRef.current.tx = canvas.clientWidth / 2 - sx * tz;
      camRef.current.ty = canvas.clientHeight * 0.52 - (sy - 18) * tz;
      camRef.current.vx = 0;
      camRef.current.vy = 0;
      camRef.current.flyActive = true;
    };

    window.addEventListener('city-focus', onCityFocus);
    window.addEventListener('palace-focus', onPalaceFocus);
    window.__zoom = (factor: number) =>
      smoothZoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, camRef.current.tz * factor);

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(rafId);
      ro?.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.removeEventListener('city-focus', onCityFocus);
      window.removeEventListener('palace-focus', onPalaceFocus);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none cursor-grab active:cursor-grabbing" />;
}
