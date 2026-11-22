export type ScenePalette = Record<string, string>;

export const TILE_W = 32;
export const TILE_H = 16;

export const SCENE_TOKENS = [
  'pavement',
  'asphalt',
  'lane',
  'glass',
  'reflection',
  'lit',
  'trim',
  'door',
  'foliage',
  'leaf',
  'shadow',
  'outline',
  'roof-shadow',
  'pool',
  'night',
  'twilight',
  'sky',
  'stone',
  'stone-shade',
  'lawn',
  'flower',
  'skin',
  'tile',
  'roof-blue',
  'home-sage',
  'home-rose',
  'vehicle-red',
  'vehicle-teal',
  'vehicle-gold',
  'led-pink',
  'led-cyan',
  'led-gold',
  'beam',
  'pearl',
  'gold-leaf',
  'gold-shade',
  'sandstone',
  'sandstone-shade',
  'porcelain',
  'river',
  'sand',
  'solar',
  'canvas',
  'thatch',
  'wood',
  'neon',
];

export function readScenePalette(el: Element): ScenePalette {
  const style = getComputedStyle(el);
  return Object.fromEntries(
    SCENE_TOKENS.map((token) => [token, style.getPropertyValue(`--scene-${token}`).trim()])
  );
}

export function shadeHex(hex: string, factor: number): string {
  const num = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + factor))));
  return `rgb(${clamp(num >> 16)},${clamp((num >> 8) & 255)},${clamp(num & 255)})`;
}

export interface IsoContext {
  point: (u: number, v: number, z?: number) => [number, number];
  poly: (pts: Array<[number, number]>, color: string | CanvasGradient) => void;
  slab: (u: number, v: number, w: number, d: number, z: number, color: string) => void;
  line: (a: [number, number], b: [number, number], color: string, width?: number) => void;
  frontFace: (u: number, v: number, w: number, d: number, z0: number, z1: number, color: string) => void;
  sideFace: (u: number, v: number, w: number, d: number, z0: number, z1: number, color: string) => void;
  block: (
    u: number,
    v: number,
    w: number,
    d: number,
    h: number,
    frontColor: string,
    sideColor: string,
    topColor: string,
    z0?: number,
    castShadow?: boolean
  ) => void;
  windows: (
    u: number,
    v: number,
    w: number,
    d: number,
    h: number,
    z0: number,
    isNight: boolean,
    step?: number,
    winH?: number,
    cols?: number
  ) => void;
  pitched: (
    u: number,
    v: number,
    w: number,
    d: number,
    z0: number,
    ridgeH: number,
    frontColor: string,
    sideColor: string
  ) => void;
  tree: (u: number, v: number, scale?: number, palm?: boolean) => void;
  shadow: (u: number, v: number, w: number, d: number, h: number) => void;
}

export function createIsoHelpers(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  pal: ScenePalette
): IsoContext {
  const point = (u: number, v: number, z = 0): [number, number] => [
    ox + (u - v) * TILE_W,
    oy + (u + v) * TILE_H - z,
  ];

  const poly = (pts: Array<[number, number]>, color: string | CanvasGradient) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  };

  const slab = (u: number, v: number, w: number, d: number, z: number, color: string) =>
    poly([point(u, v, z), point(u + w, v, z), point(u + w, v + d, z), point(u, v + d, z)], color);

  const line = (a: [number, number], b: [number, number], color: string, width = 1) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  };

  const frontFace = (u: number, v: number, w: number, d: number, z0: number, z1: number, color: string) =>
    poly([point(u, v + d, z0), point(u + w, v + d, z0), point(u + w, v + d, z1), point(u, v + d, z1)], color);

  const sideFace = (u: number, v: number, w: number, d: number, z0: number, z1: number, color: string) =>
    poly([point(u + w, v, z0), point(u + w, v + d, z0), point(u + w, v + d, z1), point(u + w, v, z1)], color);

  const shadow = (u: number, v: number, w: number, d: number, h: number) => {
    const ext = Math.min(0.42, h / 145);
    // Soft directional ground shadow
    poly(
      [
        point(u + w, v, 0),
        point(u + w + ext, v - ext * 0.18, 0),
        point(u + w + ext, v + d + ext * 0.48, 0),
        point(u + ext * 0.25, v + d + ext * 0.48, 0),
        point(u, v + d, 0),
      ],
      'rgba(12, 20, 38, 0.22)'
    );
    // Tight base ambient occlusion rim
    poly(
      [
        point(u - 0.02, v + d + 0.02, 0),
        point(u + w + 0.02, v + d + 0.02, 0),
        point(u + w + 0.02, v - 0.02, 0),
        point(u + w, v, 0),
        point(u + w, v + d, 0),
        point(u, v + d, 0),
      ],
      'rgba(10, 18, 34, 0.26)'
    );
  };

  const block = (
    u: number,
    v: number,
    w: number,
    d: number,
    h: number,
    frontColor: string,
    sideColor: string,
    topColor: string,
    z0 = 0,
    castShadow = true
  ) => {
    if (castShadow && z0 === 0) shadow(u, v, w, d, h);

    // Front face + subtle bottom ambient occlusion gradient
    frontFace(u, v, w, d, z0, z0 + h, frontColor);
    const [, botY] = point(u + w * 0.5, v + d, z0);
    const [, topY] = point(u + w * 0.5, v + d, z0 + h);
    if (h >= 8) {
      const aoGrad = ctx.createLinearGradient(0, topY, 0, botY);
      aoGrad.addColorStop(0, 'rgba(255,255,255,0.08)');
      aoGrad.addColorStop(0.65, 'rgba(0,0,0,0)');
      aoGrad.addColorStop(1, 'rgba(10,16,32,0.16)');
      poly([point(u, v + d, z0), point(u + w, v + d, z0), point(u + w, v + d, z0 + h), point(u, v + d, z0 + h)], aoGrad);
    }

    // Side face + cooler shade gradient
    sideFace(u, v, w, d, z0, z0 + h, sideColor);
    if (h >= 8) {
      const sideGrad = ctx.createLinearGradient(0, topY, 0, botY);
      sideGrad.addColorStop(0, 'rgba(15,24,48,0.04)');
      sideGrad.addColorStop(1, 'rgba(10,16,36,0.22)');
      poly([point(u + w, v, z0), point(u + w, v + d, z0), point(u + w, v + d, z0 + h), point(u + w, v, z0 + h)], sideGrad);
    }

    // Top roof slab + subtle sunlit rim highlight
    slab(u, v, w, d, z0 + h, topColor);

    // Crisp architectural edge lines
    ctx.strokeStyle = pal.outline;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    const [x0, y0] = point(u, v + d, z0);
    const [x1, y1] = point(u, v + d, z0 + h);
    const [x2, y2] = point(u + w, v + d, z0 + h);
    const [x3, y3] = point(u + w, v, z0 + h);
    const [x4, y4] = point(u + w, v + d, z0);
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.moveTo(x2, y2);
    ctx.lineTo(x4, y4);
    ctx.stroke();

    // Sunlit bevel highlight on top front ridge
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  const windows = (
    u: number,
    v: number,
    w: number,
    d: number,
    h: number,
    z0: number,
    isNight: boolean,
    step = 9,
    winH = 4.5,
    cols = 3
  ) => {
    for (let z = 4; z < h - 3; z += step) {
      for (let c = 0; c < cols; c++) {
        const u0 = u + w * ((c + 0.24) / cols);
        const u1 = u0 + (0.52 / cols) * w;
        const litFront = isNight && (c + Math.floor(z / step)) % 3 !== 1;
        const fc = litFront ? pal.lit : pal.glass;
        poly(
          [
            point(u0, v + d + 0.004, z0 + z),
            point(u1, v + d + 0.004, z0 + z),
            point(u1, v + d + 0.004, z0 + z + winH),
            point(u0, v + d + 0.004, z0 + z + winH),
          ],
          fc
        );
        // Subtle diagonal sky reflection glint during daytime
        if (!litFront) {
          poly(
            [
              point(u0, v + d + 0.005, z0 + z + winH * 0.55),
              point(u1, v + d + 0.005, z0 + z + winH * 0.85),
              point(u1, v + d + 0.005, z0 + z + winH),
              point(u0, v + d + 0.005, z0 + z + winH),
            ],
            'rgba(255,255,255,0.24)'
          );
        }

        const v0 = v + d * ((c + 0.24) / cols);
        const v1 = v0 + (0.52 / cols) * d;
        const litSide = isNight && c % 2 === 0;
        poly(
          [
            point(u + w + 0.004, v0, z0 + z),
            point(u + w + 0.004, v1, z0 + z),
            point(u + w + 0.004, v1, z0 + z + winH),
            point(u + w + 0.004, v0, z0 + z + winH),
          ],
          litSide ? pal.lit : pal.reflection
        );
      }
    }
  };

  const pitched = (
    u: number,
    v: number,
    w: number,
    d: number,
    z0: number,
    ridgeH: number,
    frontColor: string,
    sideColor: string
  ) => {
    poly(
      [
        point(u - 0.035, v + d + 0.035, z0),
        point(u + w + 0.035, v + d + 0.035, z0),
        point(u + w + 0.035, v + d / 2, z0 + ridgeH),
        point(u - 0.035, v + d / 2, z0 + ridgeH),
      ],
      frontColor
    );
    // Subtle roof eaves highlight
    line(
      point(u - 0.035, v + d / 2, z0 + ridgeH),
      point(u + w + 0.035, v + d / 2, z0 + ridgeH),
      'rgba(255,255,255,0.32)',
      0.7
    );
    poly(
      [
        point(u + w + 0.035, v - 0.035, z0),
        point(u + w + 0.035, v + d + 0.035, z0),
        point(u + w + 0.035, v + d / 2, z0 + ridgeH),
      ],
      sideColor
    );
  };

  const tree = (u: number, v: number, scale = 1, palm = false) => {
    const [x, y] = point(u, v);
    ctx.fillStyle = 'rgba(12, 22, 32, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x + 3.2 * scale, y + 1.2 * scale, 5.4 * scale, 2.5 * scale, 0, 0, 7);
    ctx.fill();

    if (palm) {
      // Curved tropical coconut palm trunk
      ctx.strokeStyle = pal.wood ?? '#6f4e37';
      ctx.lineWidth = 1.8 * scale;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 2.2 * scale, y - 6.5 * scale, x + 0.4 * scale, y - 13.5 * scale);
      ctx.stroke();

      // Layered lush palm fronds
      const topX = x + 0.4 * scale;
      const topY = y - 13.5 * scale;
      ctx.lineWidth = 1.6 * scale;
      for (const [dx, dy, col] of [
        [-8.5, -2.5, pal.foliage],
        [-4.5, -5.5, pal.leaf],
        [4.5, -5.5, pal.leaf],
        [8.5, -2, pal.foliage],
        [-2.5, 3, pal.foliage],
        [3, 2.8, pal.leaf],
      ] as Array<[number, number, string]>) {
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.quadraticCurveTo(topX + dx * 0.55 * scale, topY + (dy - 4) * scale, topX + dx * scale, topY + (dy + 3) * scale);
        ctx.stroke();
      }
      return;
    }

    // Multi-layered autumn tropical canopy (golden yellow / burnt orange / maple red / sage)
    const autumnHues: Array<[string, string, string]> = [
      ['#9a5520', '#d98a2b', '#f2be54'], // golden yellow
      ['#8c3e1c', '#cf652b', '#ed964a'], // burnt orange
      ['#782a20', '#b84232', '#df6d50'], // autumn maple red
      ['#36522e', '#5d7c42', '#95a857'], // warm autumn sage
    ];
    const idx = Math.abs(Math.round(x * 7 + y * 13)) % autumnHues.length;
    const [deepCol, midCol, topCol] = autumnHues[idx];

    ctx.fillStyle = pal.wood ?? pal.door;
    ctx.fillRect(x - 0.8 * scale, y - 7.5 * scale, 1.6 * scale, 7.5 * scale);
    ctx.fillStyle = deepCol;
    ctx.beginPath();
    ctx.ellipse(x + 1.1 * scale, y - 8.2 * scale, 5.2 * scale, 5.8 * scale, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = midCol;
    ctx.beginPath();
    ctx.ellipse(x, y - 9.4 * scale, 5.2 * scale, 6.2 * scale, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = topCol;
    ctx.beginPath();
    ctx.ellipse(x - 1.8 * scale, y - 11.4 * scale, 3.2 * scale, 3.8 * scale, -0.3, 0, 7);
    ctx.fill();
    // Sunlit crown dot
    ctx.fillStyle = 'rgba(255, 240, 195, 0.42)';
    ctx.beginPath();
    ctx.ellipse(x - 2.3 * scale, y - 12.6 * scale, 1.5 * scale, 1.8 * scale, -0.3, 0, 7);
    ctx.fill();
  };

  return { point, poly, slab, line, frontFace, sideFace, block, windows, pitched, tree, shadow };
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, startAngle = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = startAngle + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.38 : r;
    const px = cx + Math.cos(angle) * rad;
    const py = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawStripes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  stripes: Array<[string, number]>
) {
  const total = stripes.reduce((acc, [, weight]) => acc + weight, 0);
  let curY = y;
  for (const [color, weight] of stripes) {
    const sh = (h * weight) / total;
    ctx.fillStyle = color;
    ctx.fillRect(x, curY, w, sh + 0.2);
    curY += sh;
  }
}

export function drawFlag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  country: string,
  time = 0,
  scale = 1
) {
  const poleH = 18 * scale;
  const flagW = 12 * scale;
  const flagH = 8 * scale;
  const fx = x + 0.8 * scale;
  const fy = y - poleH;

  ctx.fillStyle = '#d9d4c7';
  ctx.fillRect(x - 0.6 * scale, fy - 1, 1.3 * scale, poleH + 1);
  ctx.fillStyle = '#f3d36b';
  ctx.beginPath();
  ctx.arc(x, fy - 1, 1.1 * scale, 0, 7);
  ctx.fill();

  ctx.save();
  ctx.translate(fx, fy);
  ctx.transform(1, Math.sin(time * 2.6 + x * 0.05) * 0.08, 0, 1, 0, 0);

  if (country === 'vietnam') {
    ctx.fillStyle = '#da251d';
    ctx.fillRect(0, 0, flagW, flagH);
    ctx.fillStyle = '#ffff00';
    drawStar(ctx, flagW / 2, flagH / 2, flagH * 0.3);
  } else if (country === 'china') {
    ctx.fillStyle = '#ee1c25';
    ctx.fillRect(0, 0, flagW, flagH);
    ctx.fillStyle = '#ffff00';
    const unit = flagH / 20;
    drawStar(ctx, 5 * unit, 5 * unit, 3 * unit);
    for (const [sx, sy] of [
      [10, 2],
      [12, 4],
      [12, 7],
      [10, 9],
    ]) {
      drawStar(ctx, sx * unit, sy * unit, 1 * unit, Math.atan2(5 - sy, 5 - sx));
    }
  } else if (country === 'thailand') {
    drawStripes(ctx, 0, 0, flagW, flagH, [
      ['#a51931', 1],
      ['#f4f5f8', 1],
      ['#2d2a4a', 2],
      ['#f4f5f8', 1],
      ['#a51931', 1],
    ]);
  } else if (country === 'laos') {
    drawStripes(ctx, 0, 0, flagW, flagH, [
      ['#ce1126', 1],
      ['#002868', 2],
      ['#ce1126', 1],
    ]);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(flagW / 2, flagH / 2, flagH * 0.2, 0, 7);
    ctx.fill();
  } else {
    drawStripes(ctx, 0, 0, flagW, flagH, [
      ['#032ea1', 1],
      ['#e00025', 2],
      ['#032ea1', 1],
    ]);
    ctx.fillStyle = '#ffffff';
    const base = flagH * 0.68;
    const mid = flagW / 2;
    ctx.fillRect(mid - flagW * 0.22, base - flagH * 0.08, flagW * 0.44, flagH * 0.08);
    for (const [dx, dh] of [
      [-0.14, 0.2],
      [0, 0.3],
      [0.14, 0.2],
    ]) {
      ctx.beginPath();
      ctx.moveTo(mid + flagW * dx - flagW * 0.05, base - flagH * 0.08);
      ctx.lineTo(mid + flagW * dx, base - flagH * 0.08 - flagH * dh);
      ctx.lineTo(mid + flagW * dx + flagW * 0.05, base - flagH * 0.08);
      ctx.fill();
    }
  }

  // Subtle fabric fold highlight
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(flagW * 0.25, 0, flagW * 0.22, flagH);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.4;
  ctx.strokeRect(0, 0, flagW, flagH);
  ctx.restore();
}

export function drawIndependencePalace(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  pal: ScenePalette,
  selected: boolean
) {
  const pt = (u: number, v: number, z = 0): [number, number] => [ox + (u - v) * TILE_W, oy + (u + v) * TILE_H - z];
  const poly = (pts: Array<[number, number]>, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  };
  const slab = (u: number, v: number, w: number, d: number, color: string, z = 0) =>
    poly([pt(u, v, z), pt(u + w, v, z), pt(u + w, v + d, z), pt(u, v + d, z)], color);
  const box = (u: number, v: number, w: number, d: number, h: number, z = 0) => {
    poly([pt(u, v + d, z), pt(u + w, v + d, z), pt(u + w, v + d, z + h), pt(u, v + d, z + h)], pal.stone);
    poly([pt(u + w, v, z), pt(u + w, v + d, z), pt(u + w, v + d, z + h), pt(u + w, v, z + h)], pal['stone-shade']);
    slab(u, v, w, d, pal.trim, z + h);
  };

  slab(0, 0, 2, 2, pal.pavement);
  slab(0.05, 0.05, 1.9, 1.9, pal.lawn);

  ctx.strokeStyle = selected ? pal.lit : pal.trim;
  ctx.lineWidth = selected ? 2 : 1;
  ctx.beginPath();
  [pt(0, 0), pt(2, 0), pt(2, 2), pt(0, 2)].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.stroke();

  slab(0.84, 0.6, 0.32, 1.35, pal.stone);
  for (const bx of [0.24, 1.43]) {
    slab(bx, 1.18, 0.33, 0.45, pal.foliage);
    for (let i = 0; i < 3; i++) {
      slab(bx + 0.04 + i * 0.09, 1.22, 0.04, 0.3, pal.flower);
    }
  }

  // Fountain
  const [fx, fy] = pt(1, 1.55);
  ctx.fillStyle = pal.trim;
  ctx.beginPath();
  ctx.ellipse(fx, fy, 9.5, 4.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.pool;
  ctx.beginPath();
  ctx.ellipse(fx, fy - 1, 7.2, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = pal.reflection;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.quadraticCurveTo(fx - 4, fy - 11, fx - 6, fy - 2);
  ctx.moveTo(fx, fy);
  ctx.quadraticCurveTo(fx + 4, fy - 11, fx + 6, fy - 2);
  ctx.stroke();

  // Soft building ground shadow
  poly([pt(0.16, 0.78), pt(1.98, 0.78), pt(1.98, 0.25), pt(1.88, 0.14)], 'rgba(10,18,34,0.2)');

  // Main building & iconic bamboo louver facade
  box(0.13, 0.12, 1.74, 0.65, 29);
  poly([pt(0.19, 0.778, 5), pt(1.8, 0.778, 5), pt(1.8, 0.778, 25), pt(0.19, 0.778, 25)], pal.glass);
  poly([pt(1.878, 0.2, 5), pt(1.878, 0.73, 5), pt(1.878, 0.73, 25), pt(1.878, 0.2, 25)], pal.door);

  for (let i = 0; i <= 16; i++) {
    const u = 0.18 + i * 0.102;
    poly([pt(u, 0.79, 4), pt(u + 0.025, 0.79, 4), pt(u + 0.025, 0.79, 27), pt(u, 0.79, 27)], pal.trim);
  }
  for (const h of [4, 12, 20, 27]) {
    poly([pt(0.12, 0.8, h), pt(1.88, 0.8, h), pt(1.88, 0.8, h + 1.5), pt(0.12, 0.8, h + 1.5)], pal.stone);
  }

  // Upper block + helipad + flag
  box(0.7, 0.27, 0.6, 0.32, 7, 29);
  const [hx, hy] = pt(1, 0.43, 36.5);
  ctx.strokeStyle = pal['stone-shade'];
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.ellipse(hx, hy, 7, 3.4, 0, 0, 7);
  ctx.stroke();
  ctx.font = 'bold 5px sans-serif';
  ctx.fillStyle = pal.door;
  ctx.textAlign = 'center';
  ctx.fillText('H', hx, hy + 1.5);

  const [flx, fly] = pt(1, 0.2, 36);
  drawFlag(ctx, flx, fly, 'vietnam');

  // Entrance steps & fence
  for (let i = 0; i < 3; i++) {
    slab(0.68, 0.81 + i * 0.06, 0.65, 0.07, pal.stone, 3 - i);
  }
  for (let i = 0; i <= 18; i++) {
    const [px, py] = pt(i / 9, 2);
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py - 4);
    ctx.stroke();
  }

  const [lx, ly] = pt(1, 2.1);
  ctx.fillStyle = pal.door;
  ctx.font = "bold 6px 'Be Vietnam Pro', sans-serif";
  ctx.fillText('DINH ĐỘC LẬP', lx, ly + 5);
  ctx.textAlign = 'start';
}

export function drawTetFireworks(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeSec: number,
  pal: ScenePalette,
  reducedMotion: boolean
) {
  ctx.save();
  const colors = [pal['led-pink'], pal['led-cyan'], pal['led-gold']];

  // Sweeping sky beams
  for (let i = 0; i < 6; i++) {
    const bx = w * (0.12 + i * 0.15);
    const by = h * 0.78;
    const sway = reducedMotion ? 0 : Math.sin(timeSec * 0.65 + i) * w * 0.18;
    const beamGrad = ctx.createLinearGradient(bx, by, bx + sway, h * 0.08);
    beamGrad.addColorStop(0, 'rgba(130, 235, 255, 0.22)');
    beamGrad.addColorStop(1, 'rgba(130, 235, 255, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + sway - w * 0.065, h * 0.08);
    ctx.lineTo(bx + sway + w * 0.065, h * 0.08);
    ctx.closePath();
    ctx.fill();
  }

  // Multi-ring festive fireworks with soft radial glow
  for (let i = 0; i < 5; i++) {
    const phase = reducedMotion ? 0.6 : (timeSec * 0.34 + i * 0.21) % 1;
    const fx = w * (0.14 + i * 0.18);
    const fy = h * (0.24 + (i % 2) * 0.14);
    const col = colors[i % 3];
    if (phase < 0.18) {
      ctx.strokeStyle = pal.lit;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(fx, h * 0.72);
      ctx.lineTo(fx, fy + (h * 0.72 - fy) * (1 - phase / 0.18));
      ctx.stroke();
      continue;
    }
    const burst = (phase - 0.18) / 0.82;
    const rad = Math.min(w * 0.15, 82) * burst;
    const alpha = Math.min(1, (1 - burst) * 1.65);

    // Glow halo
    const halo = ctx.createRadialGradient(fx, fy + burst * burst * 24, 0, fx, fy + burst * burst * 24, rad * 1.15);
    halo.addColorStop(0, `rgba(255, 235, 160, ${alpha * 0.28})`);
    halo.addColorStop(1, 'rgba(255, 235, 160, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(fx, fy + burst * burst * 24, rad * 1.15, 0, 7);
    ctx.fill();

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let s = 0; s < 24; s++) {
      const ang = (s / 24) * Math.PI * 2;
      const drop = burst * burst * 28;
      ctx.moveTo(fx + Math.cos(ang) * rad * 0.75, fy + Math.sin(ang) * rad * 0.75 + drop);
      ctx.lineTo(fx + Math.cos(ang) * rad, fy + Math.sin(ang) * rad + drop);
    }
    ctx.stroke();

    // Inner gold shimmer sparks
    ctx.fillStyle = pal['led-gold'];
    for (let s = 0; s < 12; s++) {
      const ang = (s / 12) * Math.PI * 2 + 0.25;
      const drop = burst * burst * 22;
      ctx.fillRect(fx + Math.cos(ang) * rad * 0.5 - 1, fy + Math.sin(ang) * rad * 0.5 + drop - 1, 2, 2);
    }
  }
  ctx.restore();
}
