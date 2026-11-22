import type { BuildingType, RegionId } from '../types';
import { createIsoHelpers, type ScenePalette } from './isoPrimitives';

const SPECIAL_STYLES: Partial<Record<BuildingType, [string, string]>> = {
  quan_cafe: ['kiosk', 'tile'],
  tiem_banh_mi: ['kiosk', 'vehicle-gold'],
  spa: ['boutique', 'home-rose'],
  phong_gym: ['boutique', 'vehicle-teal'],
  karaoke: ['boutique', 'neon'],
  rap_phim: ['cinema', 'vehicle-red'],
  khu_vui_choi: ['park', 'led-cyan'],
  trung_tam_tm: ['mall', 'vehicle-gold'],
  van_phong: ['office', 'glass'],
  data_center: ['datacenter', 'roof-blue'],
  phong_kham: ['clinic', 'vehicle-red'],
  benh_vien: ['hospital', 'vehicle-red'],
  truong_hoc: ['campus', 'tile'],
  cay_xang: ['station', 'vehicle-red'],
  kho_logistics: ['warehouse', 'vehicle-teal'],
  dien_mat_troi: ['solar', 'solar'],
  resort: ['resort', 'thatch'],
  homestay: ['stilt', 'thatch'],
  glamping: ['tents', 'canvas'],
  ben_du_thuyen: ['marina', 'river'],
  dam_tom: ['ponds', 'river'],
  doi_che: ['tea', 'foliage'],
  nha_kinh: ['greenhouse', 'glass'],
  cho_truyen_thong: ['market', 'tile'],
  san_golf: ['golf', 'lawn'],
};

export const FOREIGN_LANDMARK_TYPES: BuildingType[] = ['minh_chau', 'that_luang', 'wat_arun', 'angkor'];

export function isSpecialBuilding(type: BuildingType): boolean {
  return Boolean(SPECIAL_STYLES[type]);
}

function drawCross(ctx: CanvasRenderingContext2D, [x, y]: [number, number], color: string, size: number) {
  ctx.fillStyle = color;
  ctx.fillRect(x - size / 3, y - size, (size * 2) / 3, size * 2);
  ctx.fillRect(x - size, y - size / 3, size * 2, (size * 2) / 3);
}

export function drawSpecialBuilding(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  height: number,
  type: BuildingType,
  plotId: number,
  isNight: boolean,
  pal: ScenePalette,
  level = 1
) {
  const entry = SPECIAL_STYLES[type];
  if (!entry) return;
  const [kind, accentKey] = entry;
  const accent = pal[accentKey];
  const { point, poly, slab, line, block, windows, pitched, tree, frontFace } = createIsoHelpers(ctx, ox, oy, pal);

  const variant = ((plotId * 2654435761) >>> 0) % 8;
  const wallColor = [pal.stone, pal['home-sage'], pal['home-rose'], pal.trim][variant % 4];
  const greenGround = ['solar', 'resort', 'tents', 'ponds', 'tea', 'golf', 'park', 'stilt'].includes(kind);
  slab(0.05, 0.05, 0.9, 0.9, 0, greenGround ? pal.lawn : pal.pavement);

  // Subtle paved sidewalk border
  if (!greenGround) {
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    [point(0.06, 0.06), point(0.94, 0.06), point(0.94, 0.94), point(0.06, 0.94)].forEach(([x, y], i) =>
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    );
    ctx.closePath();
    ctx.stroke();
  }

  const pole = (u: number, v: number, h: number, color = pal.trim) => line(point(u, v), point(u, v, h), color, 1);

  switch (kind) {
    case 'kiosk': {
      block(0.2, 0.14, 0.56, 0.44, height, wallColor, pal['stone-shade'], pal.trim);
      frontFace(0.24, 0.14, 0.48, 0.44, 1, height * 0.6, isNight ? pal.lit : pal.glass);
      for (let i = 0; i < 6; i++) {
        const u = 0.2 + i * 0.0933;
        poly(
          [
            point(u, 0.58, height * 0.72),
            point(u + 0.0933, 0.58, height * 0.72),
            point(u + 0.0933, 0.72, height * 0.5),
            point(u, 0.72, height * 0.5),
          ],
          i % 2 ? pal.trim : accent
        );
      }
      // Roof signboard & AC box
      block(0.28, 0.16, 0.4, 0.08, 3.2, accent, pal['stone-shade'], pal.trim, height, false);
      block(0.64, 0.36, 0.1, 0.1, 2.2, pal['stone-shade'], pal.door, pal.trim, height, false);
      for (const u of [0.3, 0.62]) {
        pole(u, 0.84, 8);
        const [ux, uy] = point(u, 0.84, 8);
        ctx.fillStyle = variant % 2 ? accent : pal.trim;
        ctx.beginPath();
        ctx.ellipse(ux, uy, 6.2, 2.7, 0, Math.PI, 0);
        ctx.fill();
      }
      break;
    }
    case 'boutique': {
      block(0.16, 0.14, 0.64, 0.5, height, wallColor, pal['stone-shade'], pal.trim);
      frontFace(0.2, 0.14, 0.56, 0.5, 1, height * 0.45, isNight ? pal.lit : pal.glass);
      frontFace(0.16, 0.15, 0.64, 0.5, height * 0.62, height * 0.8, accent);
      windows(0.16, 0.14, 0.64, 0.5, height * 0.4, height * 0.45, isNight, 8, 4, 3);
      block(0.22, 0.22, 0.16, 0.14, 2.5, pal['stone-shade'], pal.door, pal.trim, height, false);
      if (type === 'karaoke' && isNight) {
        ctx.shadowColor = accent;
        ctx.shadowBlur = 8;
        frontFace(0.16, 0.16, 0.64, 0.5, height * 0.8, height * 0.84, pal['led-cyan']);
        ctx.shadowBlur = 0;
      }
      if (type === 'spa') {
        tree(0.2, 0.82, 0.55);
        tree(0.74, 0.82, 0.55);
      }
      if (type === 'phong_gym') {
        slab(0.56, 0.2, 0.18, 0.32, height + 0.8, pal.glass);
      }
      break;
    }
    case 'cinema': {
      block(0.12, 0.12, 0.74, 0.58, height, pal.door, pal['roof-blue'], pal['stone-shade']);
      for (let i = 0; i < 3; i++) {
        frontFace(0.18 + i * 0.22, 0.12, 0.16, 0.58, 6, height - 5, i === 1 ? accent : pal['vehicle-gold']);
      }
      poly([point(0.28, 0.8, 7.5), point(0.72, 0.8, 7.5), point(0.72, 0.88, 5), point(0.28, 0.88, 5)], pal.trim);
      if (isNight) {
        for (let i = 0; i < 9; i++) {
          const [lx, ly] = point(0.29 + i * 0.05, 0.8, 8);
          ctx.fillStyle = i % 2 ? pal['led-gold'] : pal.lit;
          ctx.fillRect(lx, ly, 1.4, 1.4);
        }
      }
      break;
    }
    case 'park': {
      const [cx, cy] = point(0.45, 0.4, height * 0.55);
      const r = height * 0.42;
      line(point(0.35, 0.45), [cx, cy], pal.trim, 1.5);
      line(point(0.55, 0.35), [cx, cy], pal.trim, 1.5);
      ctx.strokeStyle = isNight ? pal['led-cyan'] : pal.trim;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 7);
      ctx.stroke();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        line([cx, cy], [cx + Math.cos(a) * r, cy + Math.sin(a) * r], pal.outline, 0.5);
        ctx.fillStyle = [accent, pal['led-pink'], pal['vehicle-gold']][i % 3];
        ctx.fillRect(cx + Math.cos(a) * r - 2.2, cy + Math.sin(a) * r - 1.2, 4.4, 3.8);
      }
      const [tx, ty] = point(0.72, 0.72, 0);
      ctx.fillStyle = pal.trim;
      ctx.fillRect(tx - 7, ty - 7, 14, 7);
      poly([[tx - 9, ty - 7], [tx + 9, ty - 7], [tx, ty - 15]], pal['led-pink']);
      tree(0.2, 0.8, 0.65);
      break;
    }
    case 'mall': {
      block(0.08, 0.1, 0.84, 0.66, height * 0.55, pal.stone, pal['stone-shade'], pal.trim);
      for (const band of [height * 0.18, height * 0.36]) {
        frontFace(0.08, 0.1, 0.84, 0.66, band, band + 2.6, accent);
      }
      frontFace(0.12, 0.1, 0.76, 0.66, 1, height * 0.16, isNight ? pal.lit : pal.glass);
      block(0.28, 0.2, 0.46, 0.38, height * 0.45, pal.glass, pal.door, pal.reflection, height * 0.55);
      windows(0.28, 0.2, 0.46, 0.38, height * 0.45, height * 0.55, isNight, 6, 3, 4);
      slab(0.32, 0.24, 0.38, 0.3, height + 0.6, pal.reflection);
      break;
    }
    case 'office': {
      block(0.1, 0.1, 0.8, 0.66, 8, pal.stone, pal['stone-shade'], pal.trim);
      const twin = variant % 2 === 0;
      const towers: Array<[number, number, number]> = twin
        ? [
            [0.16, 0.16, 0.3],
            [0.52, 0.2, 0.3],
          ]
        : [[0.22, 0.16, 0.5]];
      towers.forEach(([u, v, w], idx) => {
        const th = (height - 8) * (idx ? 0.82 : 1);
        block(u, v, w, 0.42, th, pal.glass, pal.door, pal.reflection, 8);
        windows(u, v, w, 0.42, th, 8, isNight, 5, 2.6, 4);
        block(u + 0.05, v + 0.05, w - 0.1, 0.32, 3.2, pal.trim, pal['stone-shade'], pal.trim, 8 + th, false);
        if (!twin) {
          line(point(u + w / 2, v + 0.21, 11 + th), point(u + w / 2, v + 0.21, 11 + th + 16), pal.trim, 1.1);
        }
      });
      break;
    }
    case 'datacenter': {
      block(0.1, 0.14, 0.78, 0.56, height, pal['stone-shade'], pal['roof-blue'], pal.stone);
      frontFace(0.1, 0.14, 0.78, 0.56, height * 0.4, height * 0.48, accent);
      for (let i = 0; i < 4; i++) {
        const [cx, cy] = point(0.2 + i * 0.17, 0.4, height + 1);
        ctx.fillStyle = pal.door;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 4.2, 2.1, 0, 0, 7);
        ctx.fill();
        ctx.strokeStyle = pal.reflection;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
      if (isNight) {
        for (let i = 0; i < 6; i++) {
          const [lx, ly] = point(0.15 + i * 0.12, 0.7, 4);
          ctx.fillStyle = i % 2 ? pal['led-cyan'] : pal.lit;
          ctx.fillRect(lx, ly, 1.6, 1.6);
        }
      }
      break;
    }
    case 'clinic': {
      block(0.15, 0.14, 0.66, 0.5, height, pal.trim, pal.stone, pal.stone);
      frontFace(0.15, 0.14, 0.66, 0.5, height * 0.48, height * 0.55, pal['roof-blue']);
      windows(0.15, 0.14, 0.66, 0.5, height, 0, isNight, 9, 4, 3);
      drawCross(ctx, point(0.48, 0.64, height * 0.75), accent, 3.2);
      break;
    }
    case 'hospital': {
      block(0.08, 0.1, 0.84, 0.66, 12, pal.trim, pal.stone, pal.stone);
      block(0.2, 0.2, 0.56, 0.36, height - 12, pal.trim, pal.stone, pal['stone-shade'], 12);
      windows(0.2, 0.2, 0.56, 0.36, height - 12, 12, isNight, 7, 3.5, 4);
      const [hx, hy] = point(0.48, 0.38, height + 0.5);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(hx, hy, 9, 4.5, 0, 0, 7);
      ctx.stroke();
      drawCross(ctx, point(0.46, 0.56, height * 0.82), accent, 4.2);
      break;
    }
    case 'campus': {
      block(0.1, 0.1, 0.78, 0.26, height, pal['home-rose'], pal['stone-shade'], pal.trim);
      pitched(0.1, 0.1, 0.78, 0.26, height, 7, accent, pal['roof-blue']);
      block(0.1, 0.36, 0.24, 0.48, height * 0.8, pal['home-rose'], pal['stone-shade'], pal.trim);
      windows(0.1, 0.1, 0.78, 0.26, height, 0, isNight, 9, 4, 5);
      slab(0.42, 0.44, 0.44, 0.4, 0.2, pal.lawn);
      ctx.strokeStyle = pal.trim;
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      [point(0.46, 0.48), point(0.82, 0.48), point(0.82, 0.8), point(0.46, 0.8)].forEach(([x, y], i) =>
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
      );
      ctx.closePath();
      ctx.stroke();
      pole(0.9, 0.9, 16);
      poly([point(0.9, 0.9, 16), point(0.98, 0.9, 15), point(0.98, 0.9, 11), point(0.9, 0.9, 12)], pal['vehicle-red']);
      break;
    }
    case 'station': {
      block(0.12, 0.1, 0.4, 0.26, 9, pal.trim, pal.stone, pal.stone);
      frontFace(0.14, 0.1, 0.36, 0.26, 1, 6, isNight ? pal.lit : pal.glass);
      for (const [pu, pv] of [
        [0.3, 0.5],
        [0.7, 0.5],
        [0.3, 0.82],
        [0.7, 0.82],
      ]) {
        pole(pu, pv, height + 4, pal['stone-shade']);
      }
      block(0.24, 0.44, 0.52, 0.44, 2.8, accent, pal['vehicle-red'], pal.trim, height + 2, false);
      for (const u of [0.42, 0.56]) {
        block(u, 0.62, 0.06, 0.06, 6, accent, pal.door, pal.trim, 0, false);
      }
      pole(0.9, 0.12, 22, pal.door);
      slab(0.84, 0.08, 0.1, 0.06, 22, accent);
      break;
    }
    case 'warehouse': {
      block(0.08, 0.12, 0.84, 0.5, height, pal.stone, pal['stone-shade'], pal['stone-shade']);
      for (let i = 0; i < 5; i++) {
        const u = 0.08 + i * 0.168;
        poly(
          [point(u, 0.62, height), point(u + 0.168, 0.62, height), point(u + 0.168, 0.12, height), point(u, 0.12, height + 6)],
          i % 2 ? pal.reflection : pal['roof-blue']
        );
      }
      for (let i = 0; i < 4; i++) {
        frontFace(0.14 + i * 0.2, 0.12, 0.12, 0.5, 0, height * 0.6, pal.door);
      }
      for (let i = 0; i < 3; i++) {
        block(
          0.15 + i * 0.25,
          0.74,
          0.2,
          0.1,
          5,
          [accent, pal['vehicle-red'], pal['vehicle-gold']][i],
          pal.outline,
          pal.trim,
          0,
          false
        );
      }
      break;
    }
    case 'solar': {
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 2; col++) {
          const u = 0.1 + col * 0.42;
          const v = 0.12 + row * 0.2;
          poly(
            [point(u, v + 0.12, 1), point(u + 0.36, v + 0.12, 1), point(u + 0.36, v, 6.2), point(u, v, 6.2)],
            accent
          );
          line(point(u, v + 0.06, 3.6), point(u + 0.36, v + 0.06, 3.6), pal.reflection, 0.45);
          line(point(u + 0.18, v + 0.12, 1), point(u + 0.18, v, 6.2), pal.reflection, 0.35);
        }
      }
      block(0.82, 0.82, 0.08, 0.08, 5, pal.trim, pal.stone, pal.stone, 0, false);
      break;
    }
    case 'resort': {
      slab(0.28, 0.48, 0.44, 0.28, 0.2, pal.pool);
      slab(0.31, 0.51, 0.38, 0.06, 0.4, pal.reflection);
      for (const [u, v] of [
        [0.1, 0.12],
        [0.42, 0.1],
        [0.72, 0.18],
      ]) {
        block(u, v, 0.2, 0.2, height * 0.6, pal.canvas ?? pal.trim, pal['stone-shade'], pal.trim);
        pitched(u, v, 0.2, 0.2, height * 0.6, 9, accent, pal.wood ?? pal.door);
      }
      tree(0.12, 0.8, 0.82, true);
      tree(0.85, 0.6, 0.82, true);
      tree(0.8, 0.88, 0.64, true);
      break;
    }
    case 'stilt': {
      for (const [u, v] of [
        [0.22, 0.2],
        [0.72, 0.2],
        [0.22, 0.66],
        [0.72, 0.66],
      ]) {
        pole(u, v, 6, pal.wood);
      }
      block(0.2, 0.18, 0.54, 0.5, height - 6, pal.wood, pal.door, pal.wood, 6, false);
      frontFace(0.28, 0.18, 0.12, 0.5, 9, height - 4, isNight ? pal.lit : pal.door);
      pitched(0.18, 0.16, 0.58, 0.54, height, 14, accent, pal.wood);
      line(point(0.5, 0.86), point(0.5, 0.68, 6), pal.wood, 1.5);
      tree(0.86, 0.3, 0.72);
      tree(0.12, 0.84, 0.62);
      break;
    }
    case 'tents': {
      for (const [u, v] of [
        [0.25, 0.25],
        [0.65, 0.3],
        [0.4, 0.68],
      ]) {
        const [x, y] = point(u, v);
        ctx.fillStyle = pal.shadow;
        ctx.beginPath();
        ctx.ellipse(x + 2, y, 10, 4, 0, 0, 7);
        ctx.fill();
        poly([[x - 9, y], [x, y + 3], [x, y - height - 4]], accent);
        poly([[x, y + 3], [x + 9, y], [x, y - height - 4]], pal['stone-shade']);
        poly([[x - 2, y + 2], [x + 1, y + 2.5], [x, y - 4]], isNight ? pal.lit : pal.door);
      }
      const [fx, fy] = point(0.7, 0.75);
      ctx.fillStyle = isNight ? pal.lit : pal.flower;
      ctx.beginPath();
      ctx.ellipse(fx, fy, 2.8, 1.5, 0, 0, 7);
      ctx.fill();
      tree(0.88, 0.12, 0.72);
      tree(0.1, 0.55, 0.72);
      break;
    }
    case 'marina': {
      slab(0.05, 0.45, 0.9, 0.5, 0, accent);
      slab(0.08, 0.47, 0.84, 0.03, 0.1, pal.reflection);
      for (const u of [0.2, 0.5, 0.8]) {
        slab(u, 0.45, 0.05, 0.42, 1, pal.wood);
      }
      for (const [u, v] of [
        [0.3, 0.6],
        [0.6, 0.72],
        [0.36, 0.84],
      ]) {
        const [x, y] = point(u, v);
        poly([[x - 7, y], [x + 7, y - 1], [x + 5, y + 3], [x - 5, y + 3]], pal.trim);
        line([x, y], [x, y - 14], pal.trim, 0.8);
        poly([[x, y - 13], [x + 6, y - 2], [x, y - 2]], pal.canvas ?? pal.trim);
      }
      block(0.15, 0.1, 0.5, 0.25, height, pal.trim, pal.stone, pal['roof-blue']);
      frontFace(0.17, 0.1, 0.46, 0.25, 2, height - 3, isNight ? pal.lit : pal.glass);
      break;
    }
    case 'ponds': {
      for (const [u, v] of [
        [0.08, 0.08],
        [0.5, 0.08],
        [0.08, 0.5],
        [0.5, 0.5],
      ]) {
        slab(u, v, 0.4, 0.4, 0.3, pal.sand ?? pal.stone);
        slab(u + 0.03, v + 0.03, 0.34, 0.34, 0.1, accent);
        const [px, py] = point(u + 0.2, v + 0.2, 1);
        line([px - 4, py], [px + 4, py], pal.trim, 1);
        line([px, py - 2], [px, py + 2], pal.trim, 1);
      }
      break;
    }
    case 'tea': {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 6; c++) {
          const [tx, ty] = point(0.12 + c * 0.14, 0.1 + r * 0.12 + Math.sin(c) * 0.02, 1.5);
          ctx.fillStyle = (r + c) % 2 ? accent : pal.leaf;
          ctx.beginPath();
          ctx.ellipse(tx, ty, 4.6, 2.3, 0.45, 0, 7);
          ctx.fill();
        }
      }
      tree(0.9, 0.5, 0.82);
      break;
    }
    case 'greenhouse': {
      for (const v of [0.1, 0.4, 0.68]) {
        block(0.1, v, 0.78, 0.22, height * 0.6, pal.reflection, pal.glass, pal.reflection);
        pitched(0.1, v, 0.78, 0.22, height * 0.6, 6, pal.reflection, pal.glass);
        for (let i = 1; i < 6; i++) {
          line(point(0.1 + i * 0.13, v + 0.22, 0), point(0.1 + i * 0.13, v + 0.22, height * 0.6), pal.trim, 0.4);
        }
        frontFace(0.12, v, 0.74, 0.22, 0.5, 2.5, pal.foliage);
      }
      break;
    }
    case 'market': {
      block(0.25, 0.18, 0.5, 0.4, height, pal.stone, pal['stone-shade'], pal.trim);
      pitched(0.25, 0.18, 0.5, 0.4, height, 10, accent, pal['roof-blue']);
      const canopies = [pal['vehicle-red'], pal['vehicle-gold'], pal['vehicle-teal'], pal['home-rose']];
      (
        [
          [0.08, 0.7],
          [0.3, 0.76],
          [0.54, 0.76],
          [0.78, 0.7],
          [0.82, 0.3],
        ] as Array<[number, number]>
      ).forEach(([u, v], idx) => {
        block(u, v, 0.12, 0.1, 4, pal.wood, pal.door, pal.wood, 0, false);
        slab(u - 0.02, v - 0.02, 0.16, 0.14, 7, canopies[idx % 4]);
      });
      break;
    }
    case 'golf': {
      ctx.fillStyle = pal.leaf;
      ctx.beginPath();
      const [gx, gy] = point(0.5, 0.5);
      ctx.ellipse(gx, gy, 22, 9, -0.3, 0, 7);
      ctx.fill();
      const [bx, by] = point(0.3, 0.7);
      ctx.fillStyle = pal.sand ?? pal.stone;
      ctx.beginPath();
      ctx.ellipse(bx, by, 6, 2.5, 0, 0, 7);
      ctx.fill();
      const [wx, wy] = point(0.75, 0.3);
      ctx.fillStyle = pal.pool;
      ctx.beginPath();
      ctx.ellipse(wx, wy, 7, 3, 0, 0, 7);
      ctx.fill();
      pole(0.58, 0.46, 12);
      poly([point(0.58, 0.46, 12), point(0.66, 0.46, 11), point(0.58, 0.46, 9)], pal['vehicle-red']);
      block(0.1, 0.1, 0.22, 0.18, 8, pal.trim, pal.stone, pal['roof-blue']);
      tree(0.88, 0.85, 0.72);
      tree(0.15, 0.45, 0.62);
      break;
    }
  }

  // Level star plaque for upgraded special buildings
  if (level > 1) {
    drawStarBadge(ctx, ox, oy + 16 - height - 10, level);
  }
}

export function drawStarBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number, level: number) {
  const stars = '★'.repeat(level - 1);
  const w = stars.length * 7 + 8;
  ctx.fillStyle = 'rgba(18, 22, 32, 0.78)';
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - 8, w, 10, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 197, 61, 0.75)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.fillStyle = '#ffc53d';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(stars, cx, cy - 0.5);
  ctx.textAlign = 'start';
}

export function drawForeignLandmark(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  height: number,
  type: BuildingType,
  isNight: boolean,
  pal: ScenePalette
) {
  const { point, slab, block, line, poly } = createIsoHelpers(ctx, ox, oy, pal);
  const [cx, cy] = point(0.5, 0.5);

  const drawSpire = (
    sx: number,
    sy: number,
    baseW: number,
    h: number,
    profile: (t: number) => number,
    leftCol: string,
    rightCol: string,
    bandCol?: string
  ) => {
    const leftPts: Array<[number, number]> = [];
    const rightPts: Array<[number, number]> = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const w = baseW * profile(t);
      leftPts.push([sx - w, sy - t * h]);
      rightPts.push([sx + w, sy - t * h]);
    }
    poly([[sx, sy + baseW * 0.3], ...leftPts, [sx, sy - h]], leftCol);
    poly([[sx, sy + baseW * 0.3], ...rightPts, [sx, sy - h]], rightCol);
    if (bandCol) {
      for (let i = 2; i < 16; i += 3) {
        const t = i / 16;
        const w = baseW * profile(t);
        line([sx - w, sy - t * h], [sx + w, sy - t * h], bandCol, 0.8);
      }
    }
  };

  if (type === 'minh_chau') {
    slab(0.04, 0.04, 0.92, 0.92, 0.3, pal.pavement);
    for (const [u, v] of [
      [0.14, 0.14],
      [0.86, 0.14],
      [0.14, 0.86],
      [0.86, 0.86],
    ]) {
      slab(u - 0.04, v - 0.04, 0.08, 0.08, 0.6, pal.lawn);
    }
    block(0.3, 0.3, 0.4, 0.4, 6, pal.porcelain, pal['stone-shade'], pal.stone);
    const legs: Array<[number, number]> = [
      [0.18, 0.62],
      [0.62, 0.18],
      [0.72, 0.72],
    ];
    const lowerSphereY = cy - height * 0.3;
    const drawLeg = ([u, v]: [number, number]) => {
      const [lx, ly] = point(u, v);
      poly([[lx - 2.6, ly], [lx + 2.6, ly], [cx + 2, lowerSphereY], [cx - 2, lowerSphereY]], pal.porcelain);
      line([lx + 2.6, ly], [cx + 2, lowerSphereY], pal['stone-shade'], 1);
    };
    drawLeg(legs[1]);

    const drawColumn = (dx: number, hw: number) => {
      poly(
        [
          [cx + dx - hw, cy - 6],
          [cx + dx + hw, cy - 6],
          [cx + dx + hw * 0.7, cy - height * 0.86],
          [cx + dx - hw * 0.7, cy - height * 0.86],
        ],
        pal.porcelain
      );
      poly(
        [
          [cx + dx, cy - 6],
          [cx + dx + hw, cy - 6],
          [cx + dx + hw * 0.7, cy - height * 0.86],
          [cx + dx, cy - height * 0.86],
        ],
        pal['stone-shade']
      );
    };
    drawColumn(-3.2, 1.6);
    drawColumn(3.2, 1.6);
    drawColumn(0, 1.9);
    drawLeg(legs[0]);
    drawLeg(legs[2]);

    const drawPearl = (py: number, rad: number) => {
      const grad = ctx.createRadialGradient(cx - rad * 0.4, py - rad * 0.4, rad * 0.1, cx, py, rad);
      grad.addColorStop(0, pal.pearl);
      grad.addColorStop(0.45, pal['led-pink']);
      grad.addColorStop(1, pal['vehicle-red']);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, py, rad, 0, 7);
      ctx.fill();
      ctx.strokeStyle = isNight ? pal['led-cyan'] : pal.trim;
      ctx.lineWidth = 0.65;
      ctx.beginPath();
      ctx.ellipse(cx, py, rad, rad * 0.28, 0, 0, Math.PI);
      ctx.stroke();
      if (isNight) {
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = pal['led-pink'];
        ctx.beginPath();
        ctx.arc(cx, py, rad * 1.6, 0, 7);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    };
    drawPearl(lowerSphereY, 15);
    for (let i = 0; i < 5; i++) drawPearl(cy - height * (0.44 + i * 0.035), 2.4);
    poly(
      [
        [cx - 6, cy - height * 0.62],
        [cx + 6, cy - height * 0.62],
        [cx + 5, cy - height * 0.6],
        [cx - 5, cy - height * 0.6],
      ],
      pal.trim
    );
    drawPearl(cy - height * 0.68, 10);
    drawPearl(cy - height * 0.86, 4.2);
    poly(
      [
        [cx - 1.6, cy - height * 0.86],
        [cx + 1.6, cy - height * 0.86],
        [cx + 0.5, cy - height - 12],
        [cx - 0.5, cy - height - 12],
      ],
      pal.porcelain
    );
    for (const frac of [0.92, 0.97]) {
      line([cx - 2, cy - height * frac], [cx + 2, cy - height * frac], pal.trim, 0.8);
    }
    if (isNight) {
      ctx.fillStyle = pal['led-gold'];
      ctx.beginPath();
      ctx.arc(cx, cy - height - 12, 1.8, 0, 7);
      ctx.fill();
    }
  } else if (type === 'wat_arun') {
    block(0.08, 0.08, 0.84, 0.84, 5, pal.porcelain, pal['stone-shade'], pal.stone);
    block(0.2, 0.2, 0.6, 0.6, 5, pal.porcelain, pal['stone-shade'], pal.stone, 5, false);
    const prang = (u: number, v: number, bw: number, ph: number) => {
      const [px, py] = point(u, v, 10);
      drawSpire(px, py, bw, ph, (t) => (1 - t) ** 0.75 * (1 - 0.1 * Math.sin(t * 18)), pal.porcelain, pal['stone-shade'], pal.pearl);
      line([px, py - ph], [px, py - ph - 6], pal['gold-leaf'], 1.1);
    };
    prang(0.2, 0.2, 5, height * 0.35);
    prang(0.8, 0.2, 5, height * 0.35);
    prang(0.5, 0.5, 13, height * 0.95);
    prang(0.2, 0.8, 5, height * 0.35);
    prang(0.8, 0.8, 5, height * 0.35);
  } else if (type === 'angkor') {
    slab(0.03, 0.03, 0.94, 0.94, 0, pal.river);
    slab(0.1, 0.1, 0.8, 0.8, 0.3, pal.lawn);
    block(0.14, 0.14, 0.72, 0.72, 6, pal.sandstone, pal['sandstone-shade'], pal.sandstone);
    block(0.24, 0.24, 0.52, 0.52, 6, pal.sandstone, pal['sandstone-shade'], pal.sandstone, 6, false);
    block(0.33, 0.33, 0.34, 0.34, 6, pal.sandstone, pal['sandstone-shade'], pal.sandstone, 12, false);
    slab(0.46, 0.75, 0.08, 0.2, 0.6, pal.sandstone);
    const tower = (u: number, v: number, bw: number, th: number) => {
      const [tx, ty] = point(u, v, 18);
      drawSpire(tx, ty, bw, th, (t) => (1 - t ** 1.6) * (0.8 + 0.35 * Math.sin(Math.PI * t)), pal.sandstone, pal['sandstone-shade'], pal['stone-shade']);
    };
    tower(0.36, 0.36, 4, height * 0.45);
    tower(0.64, 0.36, 4, height * 0.45);
    tower(0.5, 0.5, 6.5, height * 0.7);
    tower(0.36, 0.64, 4, height * 0.45);
    tower(0.64, 0.64, 4, height * 0.45);
  } else {
    block(0.08, 0.08, 0.84, 0.84, 6, pal['gold-shade'], pal['sandstone-shade'], pal['gold-leaf']);
    block(0.2, 0.2, 0.6, 0.6, 6, pal['gold-leaf'], pal['gold-shade'], pal['gold-leaf'], 6, false);
    for (let i = 0; i <= 6; i++) {
      for (const [u, v] of [
        [0.2 + i * 0.1, 0.8],
        [0.8, 0.2 + i * 0.1],
      ]) {
        const [sx, sy] = point(u, v, 12);
        poly([[sx - 1.6, sy], [sx + 1.6, sy], [sx, sy - 8]], pal['gold-leaf']);
      }
    }
    const [sx, sy] = point(0.5, 0.5, 12);
    drawSpire(sx, sy, 16, height * 0.42, (t) => 1 - t * 0.6, pal['gold-leaf'], pal['gold-shade'], pal.trim);
    drawSpire(
      sx,
      sy - height * 0.42,
      9.6,
      height * 0.58,
      (t) => (1 - t) ** 1.4,
      pal['gold-leaf'],
      pal['gold-shade'],
      pal['gold-shade']
    );
  }
}

export function drawVietnameseTower(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  height: number,
  isLandmark81: boolean,
  isNight: boolean,
  pal: ScenePalette
) {
  const drawGlassBox = (bx: number, by: number, rx: number, ry: number, h: number) => {
    const leftGrad = ctx.createLinearGradient(bx - rx, by - h, bx, by);
    leftGrad.addColorStop(0, isNight ? '#3c6e91' : '#7ec2e8');
    leftGrad.addColorStop(0.5, pal.glass);
    leftGrad.addColorStop(1, '#2a4c66');

    ctx.fillStyle = leftGrad;
    ctx.beginPath();
    ctx.moveTo(bx - rx, by - ry - h);
    ctx.lineTo(bx, by - h);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx - rx, by - ry);
    ctx.closePath();
    ctx.fill();

    const rightGrad = ctx.createLinearGradient(bx, by - h, bx + rx, by);
    rightGrad.addColorStop(0, '#3a5875');
    rightGrad.addColorStop(1, pal.door);

    ctx.fillStyle = rightGrad;
    ctx.beginPath();
    ctx.moveTo(bx + rx, by - ry - h);
    ctx.lineTo(bx, by - h);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + rx, by - ry);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.reflection;
    ctx.beginPath();
    ctx.moveTo(bx, by - 2 * ry - h);
    ctx.lineTo(bx + rx, by - ry - h);
    ctx.lineTo(bx, by - h);
    ctx.lineTo(bx - rx, by - ry - h);
    ctx.closePath();
    ctx.fill();

    for (let z = 4; z < h - 2; z += 5) {
      ctx.strokeStyle = isNight ? 'rgba(130, 225, 255, 0.32)' : pal.reflection;
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      ctx.moveTo(bx - rx, by - ry - z);
      ctx.lineTo(bx, by - z);
      ctx.lineTo(bx + rx, by - ry - z);
      ctx.stroke();

      for (let s = 1; s < 6; s++) {
        const frac = s / 6;
        ctx.strokeStyle = isNight && (s + Math.floor(z)) % 3 === 0 ? pal.lit : pal.glass;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bx - rx + rx * frac, by - ry + ry * frac - z);
        ctx.lineTo(bx - rx + rx * frac, by - ry + ry * frac - z - 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx + rx - rx * frac, by - ry + ry * frac - z);
        ctx.lineTo(bx + rx - rx * frac, by - ry + ry * frac - z - 3);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 0.8;
    for (let i = 0; i <= 6; i++) {
      const frac = i / 6;
      ctx.beginPath();
      ctx.moveTo(bx - rx + rx * frac, by - ry + ry * frac);
      ctx.lineTo(bx - rx + rx * frac, by - ry + ry * frac - h);
      ctx.stroke();
    }
  };

  // Ground shadow + base podium
  ctx.fillStyle = 'rgba(10, 18, 34, 0.28)';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 15);
  ctx.lineTo(cx + 34, cy + 2);
  ctx.lineTo(cx, cy + 17);
  ctx.lineTo(cx - 32, cy);
  ctx.closePath();
  ctx.fill();

  drawGlassBox(cx, cy + 13, 26, 13, 12);

  if (isLandmark81) {
    drawGlassBox(cx - 8, cy - 2, 12, 6, height * 0.52);
    drawGlassBox(cx + 9, cy - 3, 11, 5.5, height * 0.68);
    drawGlassBox(cx, cy + 1, 14, 7, height * 0.82);
    drawGlassBox(cx + 1, cy - height * 0.8, 8, 4, height * 0.17);
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + 1, cy - height - 5);
    ctx.lineTo(cx + 1, cy - height - 30);
    ctx.stroke();
    if (isNight) {
      ctx.fillStyle = pal['led-pink'];
      ctx.beginPath();
      ctx.arc(cx + 1, cy - height - 30, 2, 0, 7);
      ctx.fill();
    }
  } else {
    const lotusGrad = ctx.createLinearGradient(cx - 22, cy - height, cx + 18, cy);
    lotusGrad.addColorStop(0, isNight ? '#3f7396' : '#89ccf0');
    lotusGrad.addColorStop(0.55, pal.glass);
    lotusGrad.addColorStop(1, '#26445c');

    ctx.fillStyle = lotusGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 19, cy - 10);
    ctx.bezierCurveTo(cx - 24, cy - height * 0.4, cx - 17, cy - height * 0.88, cx - 5, cy - height);
    ctx.bezierCurveTo(cx + 20, cy - height - 8, cx + 24, cy - height * 0.5, cx + 16, cy - 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.door;
    ctx.beginPath();
    ctx.moveTo(cx + 3, cy - height + 2);
    ctx.bezierCurveTo(cx + 23, cy - height * 0.7, cx + 24, cy - height * 0.35, cx + 16, cy - 10);
    ctx.lineTo(cx + 2, cy - 4);
    ctx.closePath();
    ctx.fill();

    for (let z = 8; z < height - 8; z += 5) {
      const rx = 19 * (0.55 + 0.45 * Math.sin((Math.PI * z) / height));
      ctx.strokeStyle = isNight ? 'rgba(130, 225, 255, 0.35)' : pal.reflection;
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.ellipse(cx, cy - z, rx, 3.5, 0, 0, Math.PI);
      ctx.stroke();
    }
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 0.8;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 5, cy - 10);
      ctx.lineTo(cx + i * 2, cy - height + 8);
      ctx.stroke();
    }

    const heliY = cy - height * 0.68;
    ctx.fillStyle = pal.shadow;
    ctx.beginPath();
    ctx.ellipse(cx + 12, heliY + 2, 13, 4.5, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = pal.trim;
    ctx.beginPath();
    ctx.ellipse(cx + 12, heliY, 13, 4.5, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = pal.glass;
    ctx.beginPath();
    ctx.ellipse(cx + 12, heliY, 11, 3.2, 0, 0, 7);
    ctx.fill();
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 9, heliY - 2);
    ctx.lineTo(cx + 9, heliY + 2);
    ctx.moveTo(cx + 15, heliY - 2);
    ctx.lineTo(cx + 15, heliY + 2);
    ctx.moveTo(cx + 9, heliY);
    ctx.lineTo(cx + 15, heliY);
    ctx.stroke();

    ctx.fillStyle = pal.reflection;
    ctx.beginPath();
    ctx.ellipse(cx + 1, cy - height + 3, 8, 3.5, -0.3, 0, 7);
    ctx.fill();
  }
}

const REGIONAL_THEMES: Record<string, { walls: string[]; roof: string; ground: string }> = {
  city: { walls: ['trim', 'stone', 'porcelain', 'home-sage'], roof: 'roof-blue', ground: 'pavement' },
  country: { walls: ['stone', 'home-rose', 'home-sage', 'trim'], roof: 'tile', ground: 'lawn' },
  sea: { walls: ['porcelain', 'trim', 'porcelain', 'home-sage'], roof: 'roof-blue', ground: 'sand' },
  mountain: { walls: ['wood', 'stone', 'wood', 'home-rose'], roof: 'outline', ground: 'lawn' },
};

export function drawStandardBuilding(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  height: number,
  type: BuildingType,
  plotId: number,
  isNight: boolean,
  pal: ScenePalette,
  region: RegionId = 'city',
  level = 1
) {
  const variant = (((plotId * 31) ^ (plotId >>> 2)) >>> 0) % 8;
  const theme = REGIONAL_THEMES[region] ?? REGIONAL_THEMES.city;
  const wallColor = pal[theme.walls[variant % 4]];
  const roofColor = variant % 3 === 2 ? pal.tile : pal[theme.roof];

  const { point: pt, poly, slab, block } = createIsoHelpers(ctx, ox, oy, pal);

  const box = (u: number, v: number, w: number, d: number, h: number, z = 0, pitchedRoof = false) => {
    block(u, v, w, d, h, wallColor, pal['stone-shade'], pal.trim, z, z === 0);

    for (let wz = 4; wz < h - 3; wz += 10) {
      for (let c = 0; c < 3; c++) {
        const u0 = u + w * (0.1 + c * 0.29);
        const u1 = u0 + w * 0.17;
        const lit = isNight && (c + variant + Math.floor(wz / 10)) % 3 !== 0;
        poly(
          [
            pt(u0, v + d + 0.006, z + wz),
            pt(u1, v + d + 0.006, z + wz),
            pt(u1, v + d + 0.006, z + wz + 5),
            pt(u0, v + d + 0.006, z + wz + 5),
          ],
          lit ? pal.lit : pal.glass
        );
      }
    }

    if (pitchedRoof) {
      const rh = region === 'mountain' ? 13 : region === 'country' ? 10 : 8;
      poly(
        [
          pt(u - 0.03, v + d + 0.03, z + h),
          pt(u + w + 0.03, v + d + 0.03, z + h),
          pt(u + w + 0.03, v + d * 0.5, z + h + rh),
          pt(u - 0.03, v + d * 0.5, z + h + rh),
        ],
        roofColor
      );
      poly(
        [
          pt(u + w + 0.03, v - 0.03, z + h),
          pt(u + w + 0.03, v + d + 0.03, z + h),
          pt(u + w + 0.03, v + d * 0.5, z + h + rh),
        ],
        pal['stone-shade']
      );
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      const [rx0, ry0] = pt(u - 0.03, v + d * 0.5, z + h + rh);
      const [rx1, ry1] = pt(u + w + 0.03, v + d * 0.5, z + h + rh);
      ctx.moveTo(rx0, ry0);
      ctx.lineTo(rx1, ry1);
      ctx.stroke();
    } else if (level >= 2 && h >= 12) {
      // Rooftop terrace / AC equipment on upgraded flat roofs
      slab(u + 0.05, v + 0.05, w - 0.1, d - 0.1, z + h + 0.4, pal.foliage);
    }
  };

  slab(0.06, 0.06, 0.88, 0.88, 0, pal[theme.ground]);
  slab(0.42, 0.7, 0.16, 0.24, 0.05, pal.pavement);

  const drawYardTree = (u: number, v: number, sc = 1) => {
    const [tx, ty] = pt(u, v);
    ctx.fillStyle = 'rgba(12,22,34,0.2)';
    ctx.beginPath();
    ctx.ellipse(tx + 2.2 * sc, ty + 1, 4.4 * sc, 2 * sc, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = pal.wood;
    ctx.fillRect(tx - 0.6, ty - 6 * sc, 1.2, 6 * sc);
    if (region === 'mountain') {
      const mSets: Array<[string, string]> = [
        ['#cc7a29', '#edb24c'],
        ['#b84b34', '#df764e'],
        ['#5a7840', '#96a852'],
      ];
      const [mc0, mc1] = mSets[Math.abs(Math.round(tx + ty)) % mSets.length];
      ctx.fillStyle = mc0;
      ctx.beginPath();
      ctx.moveTo(tx, ty - 17 * sc);
      ctx.lineTo(tx + 5 * sc, ty - 4 * sc);
      ctx.lineTo(tx - 5 * sc, ty - 4 * sc);
      ctx.fill();
      ctx.fillStyle = mc1;
      ctx.beginPath();
      ctx.moveTo(tx, ty - 17 * sc);
      ctx.lineTo(tx + 3.2 * sc, ty - 9 * sc);
      ctx.lineTo(tx - 3.2 * sc, ty - 9 * sc);
      ctx.fill();
      return;
    }
    if (region === 'sea') {
      ctx.strokeStyle = pal.foliage;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (const dir of [-1, -0.4, 0.4, 1]) {
        ctx.moveTo(tx, ty - 11 * sc);
        ctx.quadraticCurveTo(tx + dir * 4 * sc, ty - 15 * sc, tx + dir * 7 * sc, ty - 9 * sc);
      }
      ctx.fillRect(tx - 0.6, ty - 11 * sc, 1.2, 5 * sc);
      ctx.stroke();
      return;
    }
    const ySets: Array<[string, string]> = [
      ['#dd8e2e', '#f5c358'],
      ['#ca5f2b', '#eb8f48'],
      ['#ba4232', '#e06c50'],
      ['#6f8a42', '#a8b556'],
    ];
    const [yc0, yc1] = ySets[Math.abs(Math.round(tx * 3 + ty)) % ySets.length];
    ctx.fillStyle = yc0;
    ctx.beginPath();
    ctx.ellipse(tx, ty - 8 * sc, 4.5 * sc, 5 * sc, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = yc1;
    ctx.beginPath();
    ctx.ellipse(tx - 1.4 * sc, ty - 9.5 * sc, 2.4 * sc, 2.8 * sc, 0, 0, 7);
    ctx.fill();
  };

  if (region !== 'city') {
    drawYardTree(0.12, 0.1, 0.9);
    if (variant % 2) drawYardTree(0.86, 0.12, 0.8);
  }

  if (type === 'nha_cap4' || type === 'nha_pho' || type === 'biet_thu') {
    switch (variant) {
      case 0:
        box(0.14, 0.12, 0.62, 0.6, height, 0, true);
        break;
      case 1:
        box(0.12, 0.12, 0.34, 0.64, height, 0, true);
        box(0.46, 0.12, 0.36, 0.3, height * 0.7, 0, true);
        break;
      case 2:
        box(0.1, 0.12, 0.33, 0.58, height, 0, true);
        box(0.48, 0.16, 0.33, 0.58, height * 0.85, 0, true);
        break;
      case 3:
        box(0.12, 0.12, 0.7, 0.23, height);
        box(0.12, 0.35, 0.23, 0.45, height * 0.75);
        box(0.59, 0.35, 0.23, 0.45, height * 0.75);
        slab(0.36, 0.38, 0.2, 0.3, 0, pal.pool);
        break;
      case 4:
        box(0.12, 0.12, 0.72, 0.6, height * 0.55);
        box(0.22, 0.14, 0.48, 0.38, height * 0.45, height * 0.55);
        slab(0.16, 0.55, 0.55, 0.12, height * 0.55, pal.foliage);
        break;
      case 5:
        box(0.25, 0.12, 0.42, 0.7, height * 1.2);
        for (let bz = 10; bz < height; bz += 10) slab(0.21, 0.76, 0.5, 0.12, bz, pal.trim);
        break;
      case 6:
        box(0.13, 0.13, 0.68, 0.6, height * 0.7, 0, true);
        box(0.34, 0.32, 0.25, 0.25, height * 0.4, height * 0.7, true);
        break;
      default:
        box(0.12, 0.12, 0.46, 0.65, height);
        box(0.58, 0.2, 0.24, 0.45, height * 0.5);
        slab(0.63, 0.68, 0.18, 0.14, 0, pal.pool);
    }
  } else if (type === 'chung_cu' || type === 'khach_san') {
    box(0.13, 0.12, 0.68, 0.62, 9);
    box(0.18, 0.16, variant % 2 ? 0.28 : 0.58, 0.48, height - 9, 9);
    if (variant % 2) box(0.51, 0.19, 0.25, 0.45, height * 0.78, 9);
    for (let bz = 12; bz < height; bz += 10) slab(0.12, 0.68, 0.69, 0.09, bz, pal.trim);
  } else if (type === 'nha_xuong' || type === 'trang_trai') {
    box(0.1, 0.13, 0.7, 0.55, height, 0, true);
    box(0.56, 0.56, 0.23, 0.2, 5);
    if (type === 'trang_trai') {
      for (let i = 0; i < 4; i++) slab(0.1 + i * 0.1, 0.76, 0.045, 0.13, 0, pal.foliage);
    }
  } else {
    box(0.12, 0.12, 0.69, 0.6, height, 0, type === 'nha_hang' && variant % 2 === 0);
    slab(0.09, 0.7, 0.77, 0.14, 8, variant % 2 ? pal['home-rose'] : pal['home-sage']);
    if (variant % 3 === 0) box(0.2, 0.2, 0.28, 0.22, 5, height);
    if (type === 'sieu_thi') slab(0.2, 0.2, 0.44, 0.32, height + 0.5, pal['roof-blue']);
  }

  // Front yard props
  if (region === 'country') {
    for (let i = 0; i < 5; i++) slab(0.1 + i * 0.16, 0.88, 0.03, 0.05, 2, pal.wood);
    slab(0.66, 0.74, 0.2, 0.12, 0.2, pal.flower);
    drawYardTree(0.86, 0.84, 0.7);
  } else if (region === 'sea') {
    slab(0.1, 0.76, 0.18, 0.14, 0.2, pal.pool);
    drawYardTree(0.88, 0.8, 0.9);
  } else if (region === 'mountain') {
    drawYardTree(0.88, 0.78, 0.8);
    drawYardTree(0.12, 0.84, 0.7);
  } else {
    slab(0.1, 0.78, 0.22, 0.1, 0.2, pal.foliage);
    ctx.fillStyle = isNight ? pal['led-gold'] : pal.trim;
    const [lx, ly] = pt(0.88, 0.86);
    ctx.fillRect(lx - 0.5, ly - 9, 1, 9);
    ctx.fillRect(lx - 1.5, ly - 10, 3, 1.5);
  }

  ctx.strokeStyle = pal.outline;
  ctx.lineWidth = 0.65;
  ctx.beginPath();
  [pt(0.06, 0.06), pt(0.94, 0.06), pt(0.94, 0.94), pt(0.06, 0.94)].forEach(([x, y], i) =>
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
  );
  ctx.closePath();
  ctx.stroke();

  if (level > 1) {
    drawStarBadge(ctx, ox, oy + 16 - height - 10, level);
  }
}
