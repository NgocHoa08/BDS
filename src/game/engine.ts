import {
  ALL_REGIONS,
  AREA_RANGES,
  BASE_LAND_PRICE,
  BILLION,
  BUILDABLE_TYPES,
  BUILDINGS,
  CAMPAIGNS,
  DOMESTIC_GOV_MAP,
  ETEX_CARD_FEE,
  ETEX_MIN_FEE,
  ETEX_SWIPE_RATE,
  EXPANSION_ROWS_STEP,
  FOREIGN_GOV_MAP,
  FOREIGN_GOVS,
  FOREIGN_REGIONS,
  GOV_INFO,
  INVESTOR_SHARE,
  isForeignRegion,
  isLandmarkType,
  LANDMARK_PLACEMENTS,
  MAP_H,
  MAP_W,
  MAX_MAP_H,
  MILLION,
  MISSIONS,
  NPC_NAMES,
  NPC_ROLES,
  OFFLINE_MAX_MS,
  OFFLINE_MIN_MS,
  OFFLINE_SECONDS_PER_DAY,
  PLAYER_SHARE,
  PLOT_COUNT,
  RATES,
  REGION_INCOME_MOD,
  REGION_NAMES,
  SEASON_INFO,
  STAFF_MAP,
  VISA_FEE,
} from './constants';
import type {
  BuildingType,
  CampaignType,
  CitySnapshot,
  DayTickResult,
  ForeignRegionId,
  GameState,
  GovId,
  Investment,
  Npc,
  OfflineReport,
  PersonaId,
  Plot,
  PlotBuilding,
  RegionId,
  SeasonId,
  SeasonMode,
  StaffId,
  TetMode,
} from './types';

const SAVE_KEY = 'bdsnh-v1';
const LEGACY_SAVE_KEY = 'dai-gia-dat-viet-v1';

// Deterministic Mulberry32 PRNG
function createRng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 1831565813) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function formatMoney(amount: number): string {
  const neg = amount < 0;
  const abs = Math.abs(amount);
  let out: string;
  if (abs >= BILLION) {
    out = (abs / BILLION).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' tỷ';
  } else if (abs >= MILLION) {
    out = (abs / MILLION).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' triệu';
  } else {
    out = Math.round(abs).toLocaleString('vi-VN') + ' đ';
  }
  return (neg ? '-' : '') + out;
}

export function isCityLandmarkPlot(plot: Plot): boolean {
  return plot.owner === 'city' || Boolean(plot.b && isLandmarkType(plot.b.type) && plot.owner !== 'me');
}

export function getTetCalendar(state: GameState): { day: number; year: number; celebrating: boolean } {
  const dayOfYear = ((state.day - 1) % 360) + 1;
  return {
    day: dayOfYear,
    year: Math.floor((state.day - 1) / 360) + 1,
    celebrating:
      state.tetMode === 'tet' || (state.tetMode === 'calendar' && (dayOfYear <= 7 || dayOfYear === 360)),
  };
}

export function isTetNightActive(state: GameState): boolean {
  return getTetCalendar(state).celebrating && (state.hour >= 18 || state.hour < 6);
}

export function setTetMode(state: GameState, mode: TetMode): null {
  state.tetMode = mode;
  return null;
}

// =========================================================================
// 4-Season Cycle (Spring -> Summer -> Autumn -> Winter, or Lock Any Season)
// =========================================================================

export function getCalendarSeason(day: number): SeasonId {
  const dayOfYear = ((Math.max(1, day) - 1) % 360) + 1;
  if (dayOfYear <= 90) return 'spring';
  if (dayOfYear <= 180) return 'summer';
  if (dayOfYear <= 270) return 'autumn';
  return 'winter';
}

export function getCurrentSeason(state: GameState): SeasonId {
  if (state.seasonMode && state.seasonMode !== 'auto') {
    return state.seasonMode;
  }
  return getCalendarSeason(state.day);
}

export function setSeasonMode(state: GameState, mode: SeasonMode): null {
  state.seasonMode = mode;
  return null;
}

// =========================================================================
// Management Team (Staff Perks & Salaries)
// =========================================================================

export function hasStaff(state: GameState, id: StaffId): boolean {
  return Array.isArray(state.staff) && state.staff.includes(id);
}

export function getEffectiveBizTaxRate(state: GameState): number {
  return hasStaff(state, 'tax_expert') ? 0.05 : RATES.bizTax;
}

export function getEffectiveBuildDays(state: GameState, baseDays: number): number {
  if (!hasStaff(state, 'architect')) return baseDays;
  return Math.max(1, Math.round(baseDays * 0.75));
}

export function getEffectiveLandDiscount(state: GameState): number {
  return hasStaff(state, 'super_broker') ? 0.9 : 1;
}

export function getDailyStaffSalary(state: GameState): number {
  if (!Array.isArray(state.staff)) return 0;
  return state.staff.reduce((sum, id) => sum + (STAFF_MAP[id]?.dailySalary ?? 0), 0);
}

export function hireStaff(state: GameState, id: StaffId): string | null {
  const def = STAFF_MAP[id];
  if (!def) return 'Nhân sự không hợp lệ.';
  if (hasStaff(state, id)) return `Bạn đã tuyển ${def.name} rồi.`;
  if (state.cash < def.hireCost) return `Chưa đủ ${formatMoney(def.hireCost)} phí ký hợp đồng.`;

  state.cash -= def.hireCost;
  state.staff = [...(state.staff ?? []), id];

  // Super Broker immediately fills all listed unrented residential/office properties
  if (id === 'super_broker') {
    let filled = 0;
    for (const p of getOwnedPlots(state)) {
      if (p.b && p.b.buildLeft === 0 && !p.b.paused && BUILDINGS[p.b.type].rental && !p.b.rented) {
        p.b.listed = true;
        p.b.rented = true;
        filled += 1;
      }
    }
    addLog(
      state,
      `🤝 Tuyển ${def.name} (${formatMoney(def.hireCost)})${filled > 0 ? ` — lấp đầy ngay ${filled} căn cho thuê!` : '.'}`
    );
  } else {
    addLog(state, `${def.icon} Tuyển ${def.name} (${formatMoney(def.hireCost)}, lương ${formatMoney(def.dailySalary)}/ngày).`);
  }
  return null;
}

export function fireStaff(state: GameState, id: StaffId): string | null {
  const def = STAFF_MAP[id];
  if (!def || !hasStaff(state, id)) return 'Nhân sự này chưa được tuyển.';
  state.staff = state.staff.filter((s) => s !== id);
  addLog(state, `Đã chấm dứt hợp đồng với ${def.name}.`);
  return null;
}

export function getRegionAt(x: number, y: number): RegionId {
  if (y > 28) return FOREIGN_REGIONS[Math.min(3, Math.floor(x / 7))];
  if (y === 28) return getRegionAt(x, 27);
  if (x < 14 && y < 14) return 'mountain';
  if (x >= 14 && y < 14) return 'city';
  if (x < 14 && y >= 14) return 'country';
  return 'sea';
}

function generatePlot(
  rand: () => number,
  npcs: Npc[],
  x: number,
  y: number,
  gov: GovId | undefined = FOREIGN_GOV_MAP[`${x},${y}`]
): Plot {
  const region = getRegionAt(x, y);
  let kind: Plot['kind'] = 'land';
  if (x % 6 === 0 || y % 6 === 0) kind = 'road';
  if (region === 'sea' && y < 28 && x + y > 45.36) kind = 'water';
  if (y === 28) kind = x % 6 === 0 ? 'road' : 'water';
  if (gov) kind = 'gov';

  const [minArea, maxArea] = AREA_RANGES[region];
  const plot: Plot = {
    id: y * MAP_W + x,
    x,
    y,
    kind,
    region,
    area: Math.round(minArea + rand() * (maxArea - minArea)),
    mod: 0.8 + rand() * 0.45,
    owner: null,
    b: null,
    gov,
    forSale: false,
  };

  const reservedForLandmark = LANDMARK_PLACEMENTS.some((l) => l.x === x && l.y === y);
  if (kind === 'land' && !reservedForLandmark && rand() < 0.3) {
    plot.owner = npcs[Math.floor(rand() * npcs.length)].id;
    if (rand() < 0.55) {
      const candidates = BUILDABLE_TYPES.filter(
        (t) => BUILDINGS[t].regions.includes(region) && BUILDINGS[t].cost < 6 * BILLION
      );
      if (candidates.length) {
        plot.b = {
          type: candidates[Math.floor(rand() * candidates.length)],
          level: 1,
          buildLeft: 0,
          rented: true,
          listed: false,
        };
      }
    }
    plot.forSale = rand() < 0.25;
  }

  return plot;
}

function ensureExpandedMap(state: GameState): void {
  for (const r of ALL_REGIONS) {
    state.idx[r] ??= 1;
  }
  if (state.plots.length >= PLOT_COUNT) return;
  const rand = createRng(20261110 + state.plots.length);
  for (let i = state.plots.length; i < PLOT_COUNT; i++) {
    state.plots.push(generatePlot(rand, state.npcs, i % MAP_W, Math.floor(i / MAP_W)));
  }
}

export function ensureSkylineLandmarks(state: GameState): void {
  ensureExpandedMap(state);
  for (const item of LANDMARK_PLACEMENTS) {
    const existing = state.plots.filter((p) => p.b?.type === item.type);
    if (existing.length) {
      let kept = existing.some((p) => p.owner === 'me');
      for (const p of existing) {
        if (p.owner !== 'me') {
          if (kept) {
            p.b = null;
            p.forSale = false;
            continue;
          }
          p.owner = 'city';
          p.forSale = false;
          kept = true;
        }
      }
      continue;
    }
    const target = state.plots[item.y * MAP_W + item.x];
    const region = BUILDINGS[item.type].regions[0];
    const chosen =
      target?.kind === 'land' && !target.owner && !target.b
        ? target
        : state.plots.find((p) => p.region === region && p.kind === 'land' && !p.owner && !p.b);
    if (chosen) {
      chosen.owner = 'city';
      chosen.forSale = false;
      chosen.b = {
        type: item.type,
        level: 1,
        buildLeft: 0,
        rented: true,
        listed: false,
      };
    }
  }
  state.skylineAdded = true;
}

export function createInitialGameState(): GameState {
  const rand = createRng(20261109);
  const npcs: Npc[] = NPC_NAMES.map((name, idx) => ({
    id: 'n' + idx,
    name,
    role: NPC_ROLES[idx % NPC_ROLES.length],
    persona: (['greedy', 'fair', 'easy'] as PersonaId[])[idx % 3],
    cash: (2 + rand() * 20) * BILLION,
  }));
  npcs.push(
    {
      id: 'r1',
      name: 'Tập đoàn Kim Long',
      role: 'Công ty BĐS đối thủ',
      persona: 'greedy',
      cash: 60 * BILLION,
      rival: true,
    },
    {
      id: 'r2',
      name: 'Công ty BĐS Phú Quý',
      role: 'Công ty BĐS đối thủ',
      persona: 'fair',
      cash: 40 * BILLION,
      rival: true,
    }
  );

  const plots: Plot[] = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      plots.push(generatePlot(rand, npcs, x, y, DOMESTIC_GOV_MAP[`${x},${y}`] ?? FOREIGN_GOV_MAP[`${x},${y}`]));
    }
  }

  const state: GameState = {
    v: 1,
    day: 1,
    hour: 7,
    cash: 1 * BILLION,
    savings: 0,
    loans: [],
    loanSeq: 1,
    plots,
    npcs,
    idx: {
      city: 1,
      country: 1,
      sea: 1,
      mountain: 1,
      china: 1,
      laos: 1,
      thailand: 1,
      cambodia: 1,
    },
    history: [],
    month: { revenue: 0, expense: 0, tax: 0 },
    total: { revenue: 0, expense: 0, tax: 0 },
    lastTax: null,
    log: [{ day: 1, text: 'Chào mừng! Bạn có 1 tỷ VNĐ để khởi nghiệp.' }],
    offers: [],
    auction: null,
    nego: null,
    speed: 1,
    paused: false,
    tutorialDone: false,
    heatmap: false,
    investments: [],
    investmentSeq: 1,
    claimedMissions: [],
    campaigns: [],
    skylineAdded: false,
    tetMode: 'calendar',
    visas: [],
    etex: false,
    staff: [],
    seasonMode: 'auto',
    lastActiveAt: Date.now(),
  };

  ensureSkylineLandmarks(state);
  return state;
}

export function getMapHeight(state: GameState): number {
  return Math.max(MAP_H, Math.floor(state.plots.length / MAP_W));
}

export function getDaysUntilNextExpansion(state: GameState): number | null {
  if (getMapHeight(state) >= MAX_MAP_H) return null;
  if (state.day < 15) return 15 - state.day;
  const rem = state.day % 30;
  return rem === 0 ? 30 : 30 - rem;
}

export function expandWorldRows(state: GameState, rowsToAdd = EXPANSION_ROWS_STEP): number {
  const curH = getMapHeight(state);
  const actualRows = Math.min(rowsToAdd, MAX_MAP_H - curH);
  if (actualRows <= 0) return 0;

  let addedLand = 0;
  for (let dy = 0; dy < actualRows; dy++) {
    const y = curH + dy;
    const rand = createRng(20261110 + y * 97 + state.day * 13);
    for (let x = 0; x < MAP_W; x++) {
      const region = getRegionAt(x, y);
      const kind: Plot['kind'] = x % 6 === 0 || y % 6 === 0 ? 'road' : 'land';
      const [minArea, maxArea] = AREA_RANGES[region];
      const plot: Plot = {
        id: y * MAP_W + x,
        x,
        y,
        kind,
        region,
        area: Math.round(minArea + rand() * (maxArea - minArea)),
        mod: 0.85 + rand() * 0.45,
        owner: null,
        b: null,
        forSale: false,
      };
      // Fresh expansion zones stay mostly open (~85% empty) for players to claim
      if (kind === 'land') {
        addedLand += 1;
        if (rand() < 0.14 && state.npcs.length) {
          plot.owner = state.npcs[Math.floor(rand() * state.npcs.length)].id;
          plot.forSale = rand() < 0.35;
        }
      }
      state.plots.push(plot);
    }
  }
  return addedLand;
}

export function reclaimSeaLand(state: GameState, count = 3): number {
  const candidates = state.plots.filter(
    (p) =>
      p.kind === 'water' &&
      p.region === 'sea' &&
      p.y < 28 &&
      getNeighbors(state, p, 1).some((n) => n.kind === 'land' || n.kind === 'road')
  );
  if (!candidates.length) return 0;

  // Pick shoreline tiles closest to inland first for natural coastal reclamation
  candidates.sort((a, b) => a.x + a.y - (b.x + b.y));
  const reclaimed = candidates.slice(0, count);
  const rand = createRng(20261201 + state.day * 31);
  for (const p of reclaimed) {
    p.kind = p.x % 6 === 0 || p.y % 6 === 0 ? 'road' : 'land';
    p.owner = null;
    p.b = null;
    p.forSale = false;
    p.area = Math.round(180 + rand() * 240);
    p.mod = 0.95 + rand() * 0.35;
  }
  return reclaimed.filter((p) => p.kind === 'land').length;
}

export function getNeighbors(state: GameState, plot: Plot, radius = 1): Plot[] {
  const mapH = getMapHeight(state);
  const out: Plot[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = plot.x + dx;
      const ny = plot.y + dy;
      if (nx >= 0 && ny >= 0 && nx < MAP_W && ny < mapH) {
        const p = state.plots[ny * MAP_W + nx];
        if (p) out.push(p);
      }
    }
  }
  return out;
}

export function isNearRoad(state: GameState, plot: Plot): boolean {
  return getNeighbors(state, plot, 1).some((p) => p.kind === 'road');
}

export function getLandPrice(state: GameState, plot: Plot): number {
  const near2 = getNeighbors(state, plot, 2);
  const builtCount = near2.filter((p) => p.b).length;
  const govBonus = near2.some((p) => p.kind === 'gov') ? 1.15 : 1;
  const seaBonus = plot.region === 'sea' && near2.some((p) => p.kind === 'water') ? 1.3 : 1;
  const roadBonus = isNearRoad(state, plot) ? 1.25 : 1;
  const raw =
    plot.area *
    BASE_LAND_PRICE[plot.region] *
    state.idx[plot.region] *
    plot.mod *
    roadBonus *
    govBonus *
    seaBonus *
    (1 + Math.min(builtCount, 10) * 0.035);
  return Math.round(raw / MILLION) * MILLION;
}

export function getBuildingValue(b: PlotBuilding): number {
  const def = BUILDINGS[b.type];
  return b.buildLeft > 0 ? def.cost * 0.5 : def.cost * (0.85 + (b.level - 1) * 0.45);
}

export function getPlotTotalValue(state: GameState, plot: Plot): number {
  return getLandPrice(state, plot) + (plot.b ? getBuildingValue(plot.b) : 0);
}

export function getCampaignBoost(state: GameState, region: RegionId): number {
  return state.campaigns
    .filter((c) => c.region === region && state.day < c.endDay)
    .reduce((sum, c) => sum + CAMPAIGNS[c.type].boost, 0);
}

export function getDailyIncome(state: GameState, plot: Plot): number {
  if (!plot.b || plot.b.buildLeft > 0 || plot.b.paused) return 0;
  const def = BUILDINGS[plot.b.type];
  if (def.rental && !plot.b.rented) return 0;
  const nearbyBuilt = getNeighbors(state, plot, 2).filter((p) => p.b).length;
  return (
    def.income *
    (1 + (plot.b.level - 1) * 0.6) *
    REGION_INCOME_MOD[plot.region] *
    (0.9 + Math.min(nearbyBuilt, 8) * 0.03) *
    (0.85 + state.idx[plot.region] * 0.15) *
    (1 + getCampaignBoost(state, plot.region))
  );
}

export function getUpgradeCost(b: PlotBuilding): number {
  return BUILDINGS[b.type].cost * 0.5 * b.level;
}

export function getOwnedPlots(state: GameState): Plot[] {
  return state.plots.filter((p) => p.owner === 'me');
}

export function getInvestmentDebt(state: GameState): number {
  return state.investments.reduce((sum, inv) => sum + inv.remaining, 0);
}

export function getTotalDebt(state: GameState): number {
  return state.loans.reduce((sum, loan) => sum + loan.remaining, 0) + getInvestmentDebt(state);
}

export function getRealEstateValue(state: GameState): number {
  return getOwnedPlots(state).reduce((sum, p) => sum + getPlotTotalValue(state, p), 0);
}

export function getNetWorth(state: GameState): number {
  return state.cash + state.savings + getRealEstateValue(state) - getTotalDebt(state);
}

export function getLoanLimit(state: GameState): number {
  return Math.max(
    0,
    Math.round((500 * MILLION + (getRealEstateValue(state) + state.savings) * 0.6 - getTotalDebt(state)) / 1e7) *
      1e7
  );
}

export function getPlayerTitle(state: GameState): string {
  const worth = getNetWorth(state);
  if (worth >= 50 * BILLION) return 'Ông trùm BDSNH';
  if (worth >= 10 * BILLION) return 'Đại gia địa ốc';
  if (worth >= 3 * BILLION) return 'Nhà phát triển';
  return 'Nhà đầu tư mới';
}

export function getNpcById(state: GameState, id: string): Npc | undefined {
  return state.npcs.find((n) => n.id === id);
}

export function addLog(state: GameState, text: string): void {
  state.log.unshift({ day: state.day, text });
  if (state.log.length > 60) state.log.length = 60;
}

function recordExpense(state: GameState, amount: number): void {
  state.cash -= amount;
  state.month.expense += amount;
  state.total.expense += amount;
}

function recordRevenue(state: GameState, amount: number): void {
  state.cash += amount;
  state.month.revenue += amount;
  state.total.revenue += amount;
}

export function getEtexFee(plot: Plot, amount: number): number {
  return isForeignRegion(plot.region) ? Math.max(ETEX_MIN_FEE, amount * ETEX_SWIPE_RATE) : 0;
}

export function checkForeignPermission(state: GameState, plot: Plot): string | null {
  if (!isForeignRegion(plot.region)) return null;
  if (!state.visas.includes(plot.region)) {
    return `Cần đăng ký visa ${REGION_NAMES[plot.region]} tại Chính phủ nước này.`;
  }
  if (!state.etex) {
    return 'Cần mở thẻ ETEX để quẹt thẻ khi đầu tư nước ngoài.';
  }
  return null;
}

function chargeEtexFee(state: GameState, plot: Plot, amount: number): void {
  const fee = getEtexFee(plot, amount);
  if (fee > 0) {
    recordExpense(state, fee);
    addLog(state, `Quẹt thẻ ETEX tại ${REGION_NAMES[plot.region]}: phí ${formatMoney(fee)}.`);
  }
}

export function applyForVisa(state: GameState, region: RegionId): string | null {
  if (!isForeignRegion(region)) return 'Quốc gia không hợp lệ.';
  if (state.visas.includes(region)) return 'Bạn đã có visa nước này.';
  if (state.cash < VISA_FEE) return 'Không đủ tiền lệ phí visa.';
  recordExpense(state, VISA_FEE);
  state.visas.push(region);
  addLog(state, `Được cấp visa đầu tư ${REGION_NAMES[region]}.`);
  return null;
}

export function openEtexCard(state: GameState): string | null {
  if (state.etex) return 'Bạn đã có thẻ ETEX.';
  if (state.cash < ETEX_CARD_FEE) return 'Không đủ tiền mở thẻ.';
  recordExpense(state, ETEX_CARD_FEE);
  state.etex = true;
  addLog(state, 'Mở thẻ ETEX thanh toán đầu tư quốc tế.');
  return null;
}

export function canBuildInPlot(plot: Plot, type: BuildingType): boolean {
  return !isLandmarkType(type) && BUILDINGS[type].regions.includes(plot.region);
}

export function getActiveInvestment(state: GameState, plotId: number): Investment | undefined {
  return state.investments.find((inv) => inv.plotId === plotId && inv.status !== 'closed');
}

export function getProjectCapital(type: BuildingType): number {
  return BUILDINGS[type].cost * (1 + RATES.permit);
}

export function buyEmptyLand(state: GameState, plot: Plot): string | null {
  if (plot.owner || plot.kind !== 'land') return 'Lô đất không khả dụng.';
  const err = checkForeignPermission(state, plot);
  if (err) return err;
  const price = Math.round(getLandPrice(state, plot) * getEffectiveLandDiscount(state));
  const regFee = price * RATES.regFee;
  const etexFee = getEtexFee(plot, price);
  if (state.cash < price + regFee + etexFee) return 'Không đủ tiền mặt.';
  state.cash -= price;
  recordExpense(state, regFee);
  chargeEtexFee(state, plot, price);
  plot.owner = 'me';
  plot.forSale = false;
  addLog(state, `Mua lô #${plot.id} (${REGION_NAMES[plot.region]}) giá ${formatMoney(price)}.`);
  return null;
}

export function getBuyEmptyLandCost(state: GameState, plot: Plot): number {
  const price = Math.round(getLandPrice(state, plot) * getEffectiveLandDiscount(state));
  return price + price * RATES.regFee + getEtexFee(plot, price);
}

export type BulkBuySort = 'cheapest' | 'price_per_sqm' | 'area_desc';

export function getBulkBuyLandCandidates(
  state: GameState,
  regionFilter: RegionId | 'all' = 'all',
  roadOnly = false,
  sortBy: BulkBuySort = 'cheapest'
): Plot[] {
  const list = state.plots.filter(
    (p) =>
      p.kind === 'land' &&
      !p.owner &&
      (regionFilter === 'all' || p.region === regionFilter) &&
      (!roadOnly || isNearRoad(state, p)) &&
      !checkForeignPermission(state, p)
  );

  if (sortBy === 'area_desc') {
    list.sort((a, b) => b.area - a.area || getLandPrice(state, a) - getLandPrice(state, b));
  } else if (sortBy === 'price_per_sqm') {
    list.sort((a, b) => getLandPrice(state, a) / a.area - getLandPrice(state, b) / b.area);
  } else {
    list.sort((a, b) => getBuyEmptyLandCost(state, a) - getBuyEmptyLandCost(state, b));
  }
  return list;
}

export function buyBulkEmptyLand(
  state: GameState,
  plotIds: number[]
): { boughtIds: number[]; totalSpent: number; skipped: number; error: string | null } {
  const boughtIds: number[] = [];
  let totalSpent = 0;
  let skipped = 0;
  let firstErr: string | null = null;

  for (const id of plotIds) {
    const plot = state.plots[id];
    if (!plot || plot.kind !== 'land' || plot.owner) {
      skipped += 1;
      continue;
    }
    const permErr = checkForeignPermission(state, plot);
    if (permErr) {
      skipped += 1;
      firstErr ??= permErr;
      continue;
    }
    const price = Math.round(getLandPrice(state, plot) * getEffectiveLandDiscount(state));
    const regFee = price * RATES.regFee;
    const etexFee = getEtexFee(plot, price);
    const totalCost = price + regFee + etexFee;
    if (state.cash < totalCost) {
      skipped += 1;
      firstErr ??= 'Không đủ tiền mặt (gồm lệ phí trước bạ 0,5%).';
      continue;
    }

    const beforeCash = state.cash;
    state.cash -= price;
    recordExpense(state, regFee);
    chargeEtexFee(state, plot, price);
    plot.owner = 'me';
    plot.forSale = false;
    totalSpent += beforeCash - state.cash;
    boughtIds.push(id);
  }

  if (boughtIds.length > 0) {
    addLog(state, `🛒 Mua hàng loạt ${boughtIds.length} lô đất trống (tổng ${formatMoney(totalSpent)}).`);
    return { boughtIds, totalSpent, skipped, error: null };
  }

  return {
    boughtIds,
    totalSpent: 0,
    skipped,
    error: firstErr ?? 'Không có lô đất trống nào đủ điều kiện mua.',
  };
}

export function buildOnPlot(state: GameState, plot: Plot, type: BuildingType): string | null {
  if (getActiveInvestment(state, plot.id)) return 'Lô đất đang có hợp đồng đầu tư.';
  if (plot.owner !== 'me' || plot.b) return 'Không thể xây ở đây.';
  if (!canBuildInPlot(plot, type)) return 'Quy hoạch không cho phép công trình này tại khu vực.';
  const err = checkForeignPermission(state, plot);
  if (err) return err;
  const def = BUILDINGS[type];
  const totalCost = def.cost * (1 + RATES.permit) + getEtexFee(plot, def.cost);
  if (state.cash < totalCost) return 'Không đủ tiền (gồm phí giấy phép 2%).';
  state.cash -= def.cost;
  recordExpense(state, def.cost * RATES.permit);
  chargeEtexFee(state, plot, def.cost);
  plot.b = {
    type,
    level: 1,
    buildLeft: getEffectiveBuildDays(state, def.days),
    rented: false,
    listed: def.rental,
  };
  addLog(state, `Cấp phép & khởi công ${def.name} tại lô #${plot.id}.`);
  return null;
}

export function upgradeBuilding(state: GameState, plot: Plot): string | null {
  if (getActiveInvestment(state, plot.id)) return 'Tất toán hợp đồng trước khi nâng cấp.';
  if (!plot.b || plot.owner !== 'me' || plot.b.buildLeft > 0) return 'Không thể nâng cấp.';
  if (plot.b.level >= 3) return 'Đã đạt cấp tối đa.';
  const err = checkForeignPermission(state, plot);
  if (err) return err;
  const cost = getUpgradeCost(plot.b);
  if (state.cash < cost + getEtexFee(plot, cost)) return 'Không đủ tiền.';
  state.cash -= cost;
  chargeEtexFee(state, plot, cost);
  plot.b.level += 1;
  plot.b.buildLeft = getEffectiveBuildDays(state, Math.ceil(BUILDINGS[plot.b.type].days / 2));
  addLog(state, `Nâng cấp ${BUILDINGS[plot.b.type].name} lên cấp ${plot.b.level}.`);
  return null;
}

export function getBuildPlotCost(plot: Plot, type: BuildingType): number {
  const def = BUILDINGS[type];
  return def.cost * (1 + RATES.permit) + getEtexFee(plot, def.cost);
}

export function getUpgradePlotCost(plot: Plot): number {
  if (!plot.b) return 0;
  const cost = getUpgradeCost(plot.b);
  return cost + getEtexFee(plot, cost);
}

export function getBulkBuildCandidates(
  state: GameState,
  type: BuildingType,
  regionFilter: RegionId | 'all' = 'all'
): Plot[] {
  return getOwnedPlots(state).filter(
    (p) =>
      p.kind === 'land' &&
      !p.b &&
      (regionFilter === 'all' || p.region === regionFilter) &&
      !getActiveInvestment(state, p.id) &&
      canBuildInPlot(p, type) &&
      !checkForeignPermission(state, p)
  );
}

export function buildBulkOnPlots(
  state: GameState,
  plotIds: number[],
  type: BuildingType
): { builtIds: number[]; totalSpent: number; skipped: number; error: string | null } {
  const def = BUILDINGS[type];
  if (!def) return { builtIds: [], totalSpent: 0, skipped: plotIds.length, error: 'Công trình không hợp lệ.' };

  const builtIds: number[] = [];
  let totalSpent = 0;
  let skipped = 0;
  let firstErr: string | null = null;

  for (const id of plotIds) {
    const plot = state.plots[id];
    if (!plot || plot.owner !== 'me' || plot.kind !== 'land' || plot.b || getActiveInvestment(state, id)) {
      skipped += 1;
      continue;
    }
    if (!canBuildInPlot(plot, type)) {
      skipped += 1;
      firstErr ??= 'Quy hoạch không cho phép công trình này tại khu vực.';
      continue;
    }
    const permErr = checkForeignPermission(state, plot);
    if (permErr) {
      skipped += 1;
      firstErr ??= permErr;
      continue;
    }
    const totalCost = getBuildPlotCost(plot, type);
    if (state.cash < totalCost) {
      skipped += 1;
      firstErr ??= 'Không đủ tiền mặt (gồm phí giấy phép 2%).';
      continue;
    }

    const beforeCash = state.cash;
    state.cash -= def.cost;
    recordExpense(state, def.cost * RATES.permit);
    chargeEtexFee(state, plot, def.cost);
    plot.b = {
      type,
      level: 1,
      buildLeft: getEffectiveBuildDays(state, def.days),
      rented: false,
      listed: def.rental,
    };
    totalSpent += beforeCash - state.cash;
    builtIds.push(id);
  }

  if (builtIds.length > 0) {
    addLog(
      state,
      `🏗 Xây hàng loạt ${builtIds.length} ${def.name} (tổng ${formatMoney(totalSpent)}).`
    );
    return { builtIds, totalSpent, skipped, error: null };
  }

  return {
    builtIds,
    totalSpent: 0,
    skipped,
    error: firstErr ?? 'Không có lô đất nào đủ điều kiện để xây.',
  };
}

export function getBulkUpgradeCandidates(
  state: GameState,
  regionFilter: RegionId | 'all' = 'all',
  buildingFilter: BuildingType | 'all' = 'all',
  levelFilter: 'all' | 1 | 2 = 'all'
): Plot[] {
  return getOwnedPlots(state)
    .filter(
      (p) =>
        p.b &&
        p.b.buildLeft === 0 &&
        p.b.level < 3 &&
        (regionFilter === 'all' || p.region === regionFilter) &&
        (buildingFilter === 'all' || p.b.type === buildingFilter) &&
        (levelFilter === 'all' || p.b.level === levelFilter) &&
        !getActiveInvestment(state, p.id) &&
        !checkForeignPermission(state, p)
    )
    .sort((a, b) => {
      const la = a.b!.level;
      const lb = b.b!.level;
      if (la !== lb) return la - lb;
      return getUpgradePlotCost(a) - getUpgradePlotCost(b);
    });
}

export function upgradeBulkPlots(
  state: GameState,
  plotIds: number[]
): { upgradedIds: number[]; totalSpent: number; skipped: number; error: string | null } {
  const upgradedIds: number[] = [];
  let totalSpent = 0;
  let skipped = 0;
  let firstErr: string | null = null;

  for (const id of plotIds) {
    const plot = state.plots[id];
    if (!plot || !plot.b || plot.owner !== 'me' || plot.b.buildLeft > 0 || plot.b.level >= 3) {
      skipped += 1;
      continue;
    }
    if (getActiveInvestment(state, id)) {
      skipped += 1;
      firstErr ??= 'Tất toán hợp đồng đầu tư trước khi nâng cấp.';
      continue;
    }
    const permErr = checkForeignPermission(state, plot);
    if (permErr) {
      skipped += 1;
      firstErr ??= permErr;
      continue;
    }
    const cost = getUpgradeCost(plot.b);
    const totalCost = cost + getEtexFee(plot, cost);
    if (state.cash < totalCost) {
      skipped += 1;
      firstErr ??= 'Không đủ tiền mặt để nâng cấp.';
      continue;
    }

    const beforeCash = state.cash;
    state.cash -= cost;
    chargeEtexFee(state, plot, cost);
    plot.b.level += 1;
    plot.b.buildLeft = getEffectiveBuildDays(state, Math.ceil(BUILDINGS[plot.b.type].days / 2));
    totalSpent += beforeCash - state.cash;
    upgradedIds.push(id);
  }

  if (upgradedIds.length > 0) {
    addLog(
      state,
      `⬆ Nâng cấp hàng loạt ${upgradedIds.length} công trình (tổng ${formatMoney(totalSpent)}).`
    );
    return { upgradedIds, totalSpent, skipped, error: null };
  }

  return {
    upgradedIds,
    totalSpent: 0,
    skipped,
    error: firstErr ?? 'Không có công trình nào đủ điều kiện nâng cấp.',
  };
}

export function demolishBuilding(state: GameState, plot: Plot): string | null {
  if (getActiveInvestment(state, plot.id)) return 'Tất toán hợp đồng trước khi phá dỡ.';
  if (plot.owner === 'me' && plot.b) {
    addLog(state, `Phá dỡ ${BUILDINGS[plot.b.type].name} lô #${plot.id}.`);
    plot.b = null;
  }
  return null;
}

export function toggleRentalListing(plot: Plot): null {
  if (plot.b) {
    if (plot.b.paused) {
      plot.b.paused = false;
      plot.b.listed = true;
      return null;
    }
    plot.b.listed = !plot.b.listed;
    if (!plot.b.listed) plot.b.rented = false;
  }
  return null;
}

export function toggleBusinessPause(state: GameState, plot: Plot): string | null {
  if (!plot.b || plot.owner !== 'me') return 'Bạn chỉ có thể điều chỉnh công trình của mình.';
  if (plot.b.buildLeft > 0) return 'Công trình đang xây dựng chưa thể tạm ngừng kinh doanh.';

  const def = BUILDINGS[plot.b.type];
  const nextPaused = !plot.b.paused;

  if (nextPaused && getActiveInvestment(state, plot.id)) {
    return 'Không thể tạm ngừng công trình đang có hợp đồng đầu tư.';
  }

  plot.b.paused = nextPaused;
  if (nextPaused) {
    if (def.rental) {
      plot.b.listed = false;
      plot.b.rented = false;
    }
    addLog(state, `⏸ Tạm ngừng kinh doanh ${def.name} lô #${plot.id} (miễn chi phí bảo trì).`);
  } else {
    if (def.rental) {
      plot.b.listed = true;
    }
    addLog(state, `▶ Mở lại kinh doanh ${def.name} lô #${plot.id}.`);
  }
  return null;
}

export function setBulkBusinessPaused(
  state: GameState,
  paused: boolean,
  regionFilter: RegionId | 'all' = 'all'
): { count: number; skippedInvest: number; error: string | null } {
  let count = 0;
  let skippedInvest = 0;

  for (const plot of getOwnedPlots(state)) {
    if (!plot.b || plot.b.buildLeft > 0) continue;
    if (regionFilter !== 'all' && plot.region !== regionFilter) continue;
    if (Boolean(plot.b.paused) === paused) continue;

    if (paused && getActiveInvestment(state, plot.id)) {
      skippedInvest += 1;
      continue;
    }

    const def = BUILDINGS[plot.b.type];
    plot.b.paused = paused;
    if (paused && def.rental) {
      plot.b.listed = false;
      plot.b.rented = false;
    } else if (!paused && def.rental) {
      plot.b.listed = true;
    }
    count += 1;
  }

  if (count === 0) {
    return {
      count: 0,
      skippedInvest,
      error:
        skippedInvest > 0
          ? 'Các công trình đang có hợp đồng đầu tư nên không thể tạm ngừng.'
          : paused
            ? 'Không có công trình nào đang hoạt động để tạm ngừng.'
            : 'Không có công trình nào đang tạm ngừng để mở lại.',
    };
  }

  addLog(
    state,
    paused
      ? `⏸ Tạm ngừng kinh doanh hàng loạt ${count} công trình.`
      : `▶ Mở lại kinh doanh hàng loạt ${count} công trình.`
  );
  return { count, skippedInvest, error: null };
}

export function paintBuilding(
  plot: Plot,
  paint: { wall?: string; roof?: string } | null
): string | null {
  if (!plot.b || plot.owner !== 'me') return 'Bạn chỉ có thể sơn công trình của mình.';
  if (plot.b.buildLeft > 0) return 'Chờ công trình xây xong mới có thể sơn màu.';
  if (!paint || (!paint.wall && !paint.roof)) {
    delete plot.b.paint;
  } else {
    plot.b.paint = {
      ...(paint.wall ? { wall: paint.wall } : {}),
      ...(paint.roof ? { roof: paint.roof } : {}),
    };
  }
  return null;
}

// Banking
export function depositSavings(state: GameState, amount: number): null {
  const actual = Math.min(amount, state.cash);
  if (actual > 0) {
    state.cash -= actual;
    state.savings += actual;
    addLog(state, `Gửi tiết kiệm ${formatMoney(actual)}.`);
  }
  return null;
}

export function withdrawSavings(state: GameState, amount: number): null {
  const actual = Math.min(amount, state.savings);
  if (actual > 0) {
    state.savings -= actual;
    state.cash += actual;
    addLog(state, `Rút tiết kiệm ${formatMoney(actual)}.`);
  }
  return null;
}

export function takeLoan(state: GameState, amount: number, termDays: number): string | null {
  if (amount <= 0 || amount > getLoanLimit(state)) return 'Vượt hạn mức vay.';
  state.loans.push({
    id: state.loanSeq++,
    principal: amount,
    remaining: amount,
    termDays,
    daysLeft: termDays,
  });
  state.cash += amount;
  addLog(state, `Vay ${formatMoney(amount)} kỳ hạn ${termDays} ngày.`);
  return null;
}

export function repayLoan(state: GameState, loanId: number, amount: number): null {
  const loan = state.loans.find((l) => l.id === loanId);
  if (!loan) return null;
  const actual = Math.min(amount, loan.remaining, state.cash);
  if (actual <= 0) return null;
  state.cash -= actual;
  loan.remaining -= actual;
  if (loan.remaining < 1) {
    state.loans = state.loans.filter((l) => l !== loan);
    addLog(state, `Tất toán khoản vay #${loanId}.`);
  }
  return null;
}

// Investment partnerships
export function signInvestment(
  state: GameState,
  plotId: number,
  npcId: string,
  buildingType: BuildingType,
  termDays: number
): string | null {
  const plot = state.plots[plotId];
  const npc = state.npcs.find((n) => n.id === npcId);
  if (!plot || plot.kind !== 'land' || plot.owner !== 'me' || plot.b || getActiveInvestment(state, plotId)) {
    return 'Chọn lô đất trống của bạn, chưa có hợp đồng.';
  }
  if (!npc || npc.rival) return 'Nhà đầu tư không khả dụng.';
  if (!BUILDINGS[buildingType] || !canBuildInPlot(plot, buildingType)) return 'Công trình không đúng quy hoạch.';
  if (![90, 180, 365].includes(termDays)) return 'Kỳ hạn không hợp lệ.';

  const capital = getProjectCapital(buildingType);
  if (npc.cash < capital) return 'Nhà đầu tư không đủ vốn cho dự án này.';

  npc.cash -= capital;
  state.cash += capital;
  const err = buildOnPlot(state, plot, buildingType);
  if (err) {
    state.cash -= capital;
    npc.cash += capital;
    return err;
  }

  state.investments.push({
    id: state.investmentSeq++,
    plotId,
    npcId,
    principal: capital,
    remaining: capital,
    signedDay: state.day,
    termDays,
    endDay: state.day + termDays,
    netProfit: 0,
    sharedProfit: 0,
    investorPaid: 0,
    playerProfit: 0,
    status: 'active',
  });
  addLog(
    state,
    `Ký hợp đồng đầu tư lô #${plotId} với ${npc.name}: vốn ${formatMoney(capital)}, ${termDays} ngày, chia lời 70/30.`
  );
  return null;
}

function settleInvestmentDailyProfit(state: GameState, inv: Investment, deltaNet: number): void {
  if (inv.status === 'closed') return;
  inv.netProfit += deltaNet;
  const distributable = Math.max(0, inv.netProfit - inv.sharedProfit);
  if (distributable <= 0) return;
  const investorCut = distributable * INVESTOR_SHARE;
  inv.sharedProfit += distributable;
  inv.investorPaid += investorCut;
  inv.playerProfit += distributable * PLAYER_SHARE;
  recordExpense(state, investorCut);
  const npc = getNpcById(state, inv.npcId);
  if (npc) npc.cash += investorCut;
}

export function repayInvestment(state: GameState, invId: number): string | null {
  const inv = state.investments.find((i) => i.id === invId);
  if (!inv || inv.status === 'closed') return 'Hợp đồng đã tất toán hoặc không tồn tại.';
  if (state.cash < inv.remaining) return 'Chưa đủ tiền mặt để hoàn vốn; hợp đồng vẫn tiếp tục chia lời.';
  const npc = getNpcById(state, inv.npcId);
  if (!npc) return 'Không tìm thấy nhà đầu tư.';
  state.cash -= inv.remaining;
  npc.cash += inv.remaining;
  inv.remaining = 0;
  inv.status = 'closed';
  addLog(
    state,
    `Tất toán hợp đồng #${inv.id}: hoàn vốn cho ${npc.name}, công trình tiếp tục thuộc về bạn.`
  );
  return null;
}

export function previewBulkInvestmentCapacity(
  state: GameState,
  plotIds: number[],
  buildingType: BuildingType,
  preferredNpcId: string | 'auto' = 'auto'
): { eligibleCount: number; fundableCount: number; totalCapital: number } {
  const def = BUILDINGS[buildingType];
  if (!def) return { eligibleCount: 0, fundableCount: 0, totalCapital: 0 };

  const capital = getProjectCapital(buildingType);
  const eligible = plotIds
    .map((id) => state.plots[id])
    .filter(
      (p): p is Plot =>
        Boolean(
          p &&
            p.kind === 'land' &&
            p.owner === 'me' &&
            !p.b &&
            !getActiveInvestment(state, p.id) &&
            canBuildInPlot(p, buildingType) &&
            !checkForeignPermission(state, p)
        )
    );

  // Clone NPC cash pools to simulate exact multi-partner allocation
  const npcPools = state.npcs
    .filter((n) => !n.rival && (preferredNpcId === 'auto' || n.id === preferredNpcId))
    .map((n) => ({ id: n.id, cash: n.cash }));

  let cashLeft = state.cash;
  let fundableCount = 0;
  for (const plot of eligible) {
    const etexFee = getEtexFee(plot, def.cost);
    if (cashLeft < etexFee) continue;
    npcPools.sort((a, b) => b.cash - a.cash);
    const chosen = npcPools.find((n) => n.cash >= capital);
    if (!chosen) break;
    chosen.cash -= capital;
    cashLeft -= etexFee;
    fundableCount += 1;
  }

  return {
    eligibleCount: eligible.length,
    fundableCount,
    totalCapital: fundableCount * capital,
  };
}

export function signBulkInvestments(
  state: GameState,
  plotIds: number[],
  buildingType: BuildingType,
  termDays: number,
  preferredNpcId: string | 'auto' = 'auto'
): { signedIds: number[]; totalCapital: number; skipped: number; error: string | null } {
  const def = BUILDINGS[buildingType];
  if (!def) return { signedIds: [], totalCapital: 0, skipped: plotIds.length, error: 'Công trình không hợp lệ.' };
  if (![90, 180, 365].includes(termDays)) {
    return { signedIds: [], totalCapital: 0, skipped: plotIds.length, error: 'Kỳ hạn không hợp lệ.' };
  }

  const capital = getProjectCapital(buildingType);
  const signedIds: number[] = [];
  let totalCapital = 0;
  let skipped = 0;
  let firstErr: string | null = null;

  for (const id of plotIds) {
    const plot = state.plots[id];
    if (!plot || plot.kind !== 'land' || plot.owner !== 'me' || plot.b || getActiveInvestment(state, id)) {
      skipped += 1;
      continue;
    }
    if (!canBuildInPlot(plot, buildingType)) {
      skipped += 1;
      firstErr ??= 'Công trình không đúng quy hoạch khu vực.';
      continue;
    }
    const permErr = checkForeignPermission(state, plot);
    if (permErr) {
      skipped += 1;
      firstErr ??= permErr;
      continue;
    }

    const candidates = state.npcs
      .filter((n) => !n.rival && n.cash >= capital && (preferredNpcId === 'auto' || n.id === preferredNpcId))
      .sort((a, b) => b.cash - a.cash);
    const npc = candidates[0];
    if (!npc) {
      skipped += 1;
      firstErr ??= 'Các nhà đầu tư không còn đủ vốn cho dự án này.';
      continue;
    }

    const etexFee = getEtexFee(plot, def.cost);
    if (state.cash < etexFee) {
      skipped += 1;
      firstErr ??= 'Không đủ tiền mặt trả phí quẹt thẻ ETEX.';
      continue;
    }

    npc.cash -= capital;
    state.cash += capital;
    state.cash -= def.cost;
    recordExpense(state, def.cost * RATES.permit);
    chargeEtexFee(state, plot, def.cost);
    plot.b = {
      type: buildingType,
      level: 1,
      buildLeft: getEffectiveBuildDays(state, def.days),
      rented: false,
      listed: def.rental,
    };

    state.investments.push({
      id: state.investmentSeq++,
      plotId: id,
      npcId: npc.id,
      principal: capital,
      remaining: capital,
      signedDay: state.day,
      termDays,
      endDay: state.day + termDays,
      netProfit: 0,
      sharedProfit: 0,
      investorPaid: 0,
      playerProfit: 0,
      status: 'active',
    });

    signedIds.push(id);
    totalCapital += capital;
  }

  if (signedIds.length > 0) {
    addLog(
      state,
      `🤝 Gọi vốn hàng loạt ${signedIds.length} ${def.name} (tổng ${formatMoney(totalCapital)}, ${termDays} ngày, chia 70/30).`
    );
    return { signedIds, totalCapital, skipped, error: null };
  }

  return {
    signedIds,
    totalCapital: 0,
    skipped,
    error: firstErr ?? 'Không có lô đất nào đủ điều kiện gọi vốn.',
  };
}

export function repayBulkInvestments(state: GameState): {
  closedCount: number;
  totalRepaid: number;
  error: string | null;
} {
  const open = state.investments
    .filter((i) => i.status !== 'closed')
    .sort((a, b) => {
      if (a.status === 'due' && b.status !== 'due') return -1;
      if (b.status === 'due' && a.status !== 'due') return 1;
      return a.remaining - b.remaining;
    });

  let closedCount = 0;
  let totalRepaid = 0;

  for (const inv of open) {
    if (state.cash < inv.remaining) continue;
    const npc = getNpcById(state, inv.npcId);
    if (!npc) continue;
    const amount = inv.remaining;
    state.cash -= amount;
    npc.cash += amount;
    inv.remaining = 0;
    inv.status = 'closed';
    closedCount += 1;
    totalRepaid += amount;
  }

  if (closedCount > 0) {
    addLog(state, `✅ Tất toán hàng loạt ${closedCount} hợp đồng đầu tư (hoàn vốn ${formatMoney(totalRepaid)}).`);
    return { closedCount, totalRepaid, error: null };
  }

  return {
    closedCount: 0,
    totalRepaid: 0,
    error: open.length === 0 ? 'Không còn hợp đồng nào đang mở.' : 'Chưa đủ tiền mặt để tất toán hợp đồng nào.',
  };
}

// Missions & Campaigns
export function getMissionProgress(state: GameState, missionId: string): number {
  const owned = getOwnedPlots(state);
  switch (missionId) {
    case 'first_land':
    case 'portfolio':
      return owned.length;
    case 'first_build':
      return owned.filter((p) => p.b && p.b.buildLeft === 0).length;
    case 'partner':
      return state.investments.length;
    case 'income':
      return state.total.revenue;
    case 'regions':
      return new Set(owned.filter((p) => !isForeignRegion(p.region)).map((p) => p.region)).size;
    case 'cross_river':
      return owned.filter((p) => isForeignRegion(p.region)).length;
    case 'global':
      return new Set(owned.filter((p) => isForeignRegion(p.region)).map((p) => p.region)).size;
    case 'skyline':
      return owned.filter((p) => p.b && p.b.buildLeft === 0 && isLandmarkType(p.b.type)).length;
    default:
      return 0;
  }
}

export function claimMission(state: GameState, missionId: string): string | null {
  const mission = MISSIONS.find((m) => m.id === missionId);
  if (!mission || state.claimedMissions.includes(missionId) || getMissionProgress(state, missionId) < mission.target) {
    return 'Nhiệm vụ chưa hoàn thành hoặc đã nhận thưởng.';
  }
  state.claimedMissions.push(missionId);
  state.cash += mission.reward;
  addLog(state, `Hoàn thành ${mission.name}: thưởng ${formatMoney(mission.reward)}.`);
  return null;
}

export function launchCampaign(state: GameState, type: CampaignType, region: RegionId): string | null {
  const def = CAMPAIGNS[type];
  if (!def || !REGION_NAMES[region]) return 'Chiến dịch không hợp lệ.';
  if (!getOwnedPlots(state).some((p) => p.region === region && p.b && p.b.buildLeft === 0)) {
    return 'Cần một công trình đã hoàn thành tại khu vực.';
  }
  if (state.campaigns.some((c) => c.region === region && state.day < c.endDay)) {
    return 'Khu vực đã có một chiến dịch đang chạy.';
  }
  if (state.cash < def.cost) return 'Không đủ tiền cho chiến dịch.';

  recordExpense(state, def.cost);
  const affectedInvestments = state.investments.filter(
    (inv) =>
      inv.status !== 'closed' &&
      state.plots[inv.plotId]?.region === region &&
      state.plots[inv.plotId]?.b?.buildLeft === 0
  );
  for (const inv of affectedInvestments) {
    inv.netProfit -= def.cost / affectedInvestments.length;
  }

  state.campaigns.push({
    type,
    region,
    endDay: state.day + def.days,
  });
  addLog(state, `${def.name} tại ${REGION_NAMES[region]}: ${def.days} ngày.`);
  return null;
}

// Negotiation
const BUY_ASK_MULT: Record<PersonaId, number> = { greedy: 1.3, fair: 1.12, easy: 1.03 };
const BUY_LIMIT_MULT: Record<PersonaId, number> = { greedy: 1.1, fair: 0.97, easy: 0.86 };
const SELL_ASK_MULT: Record<PersonaId, number> = { greedy: 0.78, fair: 0.88, easy: 0.95 };
const SELL_LIMIT_MULT: Record<PersonaId, number> = { greedy: 0.98, fair: 1.08, easy: 1.2 };

export function startBuyNegotiation(state: GameState, plot: Plot): string | null {
  if (isCityLandmarkPlot(plot)) return 'Công trình biểu tượng thuộc thành phố, không mua bán.';
  const err = checkForeignPermission(state, plot);
  if (err) return err;
  if (!plot.owner) return 'Lô đất không có chủ sở hữu.';
  const npc = getNpcById(state, plot.owner);
  if (!npc) return 'Không tìm thấy chủ đất.';

  const value = getPlotTotalValue(state, plot);
  const relMult = plot.forSale ? 1 : 1.2;
  const ask = Math.round((value * BUY_ASK_MULT[npc.persona] * relMult) / MILLION) * MILLION;

  state.nego = {
    mode: 'buy',
    plotId: plot.id,
    npcId: npc.id,
    ask,
    limit: value * BUY_LIMIT_MULT[npc.persona] * relMult,
    patience: npc.persona === 'greedy' ? 3 : npc.persona === 'fair' ? 4 : 5,
    lines: [
      {
        who: 'npc',
        text: plot.forSale
          ? `Lô này tôi đang rao bán. Giá ${formatMoney(ask)}, anh/chị thấy sao?`
          : `Đất này tôi chưa định bán... Nếu ${formatMoney(ask)} thì tôi suy nghĩ.`,
      },
    ],
  };
  return null;
}

export function startSellNegotiation(
  state: GameState,
  plot: Plot,
  npcId?: string,
  initialOffer?: number
): string | null {
  if (getActiveInvestment(state, plot.id)) return 'Tất toán hợp đồng trước khi bán lô đất.';
  const pool = state.npcs.filter((n) => !n.rival || Math.random() < 0.5);
  const npc = (npcId ? getNpcById(state, npcId) : pool[Math.floor(Math.random() * pool.length)]) ?? state.npcs[0];
  const value = getPlotTotalValue(state, plot);
  const ask = initialOffer ?? Math.round((value * SELL_ASK_MULT[npc.persona]) / MILLION) * MILLION;

  state.nego = {
    mode: 'sell',
    plotId: plot.id,
    npcId: npc.id,
    ask,
    limit: value * SELL_LIMIT_MULT[npc.persona] * (0.95 + Math.random() * 0.1),
    patience: npc.persona === 'greedy' ? 3 : 4,
    lines: [
      {
        who: 'npc',
        text: `Tôi là ${npc.name} (${npc.role}). Tôi trả ${formatMoney(ask)} cho lô này.`,
      },
    ],
  };
  return null;
}

function finalizeNegotiation(state: GameState, price: number): void {
  const nego = state.nego;
  if (!nego) return;
  const plot = state.plots[nego.plotId];
  const npc = getNpcById(state, nego.npcId);
  if (!npc) {
    nego.done = 'fail';
    return;
  }

  if (nego.mode === 'buy' && isCityLandmarkPlot(plot)) {
    nego.done = 'fail';
    return;
  }

  if (nego.mode === 'buy') {
    const regFee = price * RATES.regFee;
    if (checkForeignPermission(state, plot) || state.cash < price + regFee + getEtexFee(plot, price)) {
      nego.lines.push({ who: 'npc', text: 'Anh/chị chưa đủ tiền rồi.' });
      nego.done = 'fail';
      return;
    }
    state.cash -= price;
    recordExpense(state, regFee);
    chargeEtexFee(state, plot, price);
    npc.cash += price;
    plot.owner = 'me';
    plot.forSale = false;
    if (plot.b) plot.b.listed = BUILDINGS[plot.b.type].rental;
    addLog(state, `Mua lô #${plot.id} từ ${npc.name} giá ${formatMoney(price)}.`);
  } else {
    if (getActiveInvestment(state, plot.id)) {
      nego.done = 'fail';
      nego.lines.push({ who: 'npc', text: 'Lô này đang có hợp đồng đầu tư chưa tất toán.' });
      return;
    }
    const tax = price * RATES.transferTax;
    state.cash += price;
    state.month.tax += tax;
    state.total.tax += tax;
    state.cash -= tax;
    npc.cash -= price;
    plot.owner = npc.id;
    state.offers = state.offers.filter((o) => o.plotId !== plot.id);
    addLog(state, `Bán lô #${plot.id} cho ${npc.name} giá ${formatMoney(price)}.`);
  }

  nego.done = 'ok';
  nego.lines.push({ who: 'npc', text: 'Chốt! Hẹn ra Văn phòng đăng ký đất đai sang tên.' });
}

export function proposeNegotiationPrice(state: GameState, offer: number): void {
  const nego = state.nego;
  if (!nego || nego.done) return;
  nego.lines.push({ who: 'me', text: `Tôi đề nghị ${formatMoney(offer)}.` });
  const isBuy = nego.mode === 'buy';

  if (isBuy ? offer >= nego.limit || offer >= nego.ask : offer <= nego.limit || offer <= nego.ask) {
    const finalPrice = isBuy ? Math.min(offer, nego.ask) : Math.max(offer, nego.ask);
    finalizeNegotiation(state, finalPrice);
    return;
  }

  const insulting = isBuy ? offer < nego.limit * 0.7 : offer > nego.limit * 1.4;
  nego.patience -= insulting ? 2 : 1;
  if (nego.patience <= 0) {
    nego.done = 'fail';
    nego.lines.push({ who: 'npc', text: 'Thôi, không nói chuyện nữa. Hẹn dịp khác!' });
    return;
  }

  const diff = nego.ask - offer;
  const nextAsk = Math.round((nego.ask - diff * (insulting ? 0.1 : 0.35)) / MILLION) * MILLION;
  nego.ask = isBuy
    ? Math.max(nextAsk, Math.ceil(nego.limit / MILLION) * MILLION)
    : Math.min(nextAsk, Math.floor(nego.limit / MILLION) * MILLION);

  nego.lines.push({
    who: 'npc',
    text: insulting
      ? `Giá đó thấp quá, coi thường nhau à? ${formatMoney(nego.ask)} là cùng.`
      : `Gặp nhau ở giữa đi: ${formatMoney(nego.ask)}.`,
  });
}

export function acceptNegotiationAsk(state: GameState): void {
  if (state.nego && !state.nego.done) {
    finalizeNegotiation(state, state.nego.ask);
  }
}

// Auctions
export function bidInAuction(state: GameState): string | null {
  const auction = state.auction;
  if (!auction || auction.done) return null;
  const nextBid = Math.round((auction.bid * 1.06) / MILLION) * MILLION;
  const plot = state.plots[auction.plotId];
  const err = checkForeignPermission(state, plot);
  if (err) return err;
  if (state.cash < nextBid + getEtexFee(plot, nextBid)) return 'Không đủ tiền để trả giá.';

  auction.bid = nextBid;
  auction.leader = 'me';

  if (auction.npcMax >= nextBid * 1.05) {
    auction.bid = Math.round((nextBid * 1.05) / MILLION) * MILLION;
    auction.leader = auction.npcId;
  } else {
    auction.done = true;
    state.cash -= nextBid;
    chargeEtexFee(state, plot, nextBid);
    plot.owner = 'me';
    plot.forSale = false;
    addLog(state, `Thắng đấu giá lô #${plot.id} giá ${formatMoney(nextBid)}!`);
  }
  return null;
}

export function closeAuction(state: GameState): void {
  const auction = state.auction;
  if (!auction) return;
  if (!auction.done) {
    const plot = state.plots[auction.plotId];
    plot.owner = auction.npcId;
    const npc = getNpcById(state, auction.npcId);
    addLog(state, `${npc?.name ?? 'Đối thủ'} thắng đấu giá lô #${plot.id}.`);
  }
  state.auction = null;
}

// Foreign government autonomous development
function stepForeignGovDevelopment(state: GameState): void {
  const citizens = state.npcs.filter((n) => !n.rival);
  for (const region of FOREIGN_REGIONS) {
    if (Math.random() > 0.3) continue;
    const regionLand = state.plots.filter((p) => p.region === region && p.kind === 'land');
    if (regionLand.filter((p) => p.b).length > regionLand.length * 0.6) continue;
    const candidates = regionLand.filter(
      (p) =>
        !p.b &&
        p.owner !== 'me' &&
        p.owner !== 'city' &&
        !LANDMARK_PLACEMENTS.some((l) => l.x === p.x && l.y === p.y)
    );
    if (!candidates.length) continue;
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    const allowed = BUILDABLE_TYPES.filter((t) => canBuildInPlot(chosen, t) && BUILDINGS[t].cost < 6 * BILLION);
    if (!allowed.length) continue;
    chosen.owner ||= citizens[Math.floor(Math.random() * citizens.length)].id;
    const bType = allowed[Math.floor(Math.random() * allowed.length)];
    chosen.b = {
      type: bType,
      level: 1,
      buildLeft: BUILDINGS[bType].days,
      rented: true,
      listed: false,
    };
    if (Math.random() < 0.3) {
      addLog(
        state,
        `${GOV_INFO[FOREIGN_GOVS[region].id].name} cấp phép xây ${BUILDINGS[bType].name} tại lô #${chosen.id}.`
      );
    }
  }
}

export function advanceTime(state: GameState, deltaHours: number): DayTickResult[] {
  const ticks: DayTickResult[] = [];
  state.hour += deltaHours;
  while (state.hour >= 24) {
    state.hour -= 24;
    ticks.push(stepDay(state));
  }
  return ticks;
}

export function stepDay(state: GameState): DayTickResult {
  const result: DayTickResult = { fx: [], events: [] };
  const prevSeason = getCurrentSeason(state);
  state.day += 1;
  const curSeason = getCurrentSeason(state);
  if (state.seasonMode === 'auto' && curSeason !== prevSeason) {
    const info = SEASON_INFO[curSeason];
    const msg = `${info.icon} Sang ${info.name}: ${info.desc}!`;
    addLog(state, msg);
    result.events.push(msg);
  }

  // End expired campaigns
  const expired = state.campaigns.filter((c) => state.day >= c.endDay);
  for (const c of expired) {
    result.events.push(`${CAMPAIGNS[c.type].name} tại ${REGION_NAMES[c.region]} đã kết thúc.`);
  }
  state.campaigns = state.campaigns.filter((c) => state.day < c.endDay);

  const bizTaxRate = getEffectiveBizTaxRate(state);
  const hasBroker = hasStaff(state, 'super_broker');

  // Buildings construction, rental & daily revenue
  let totalMaint = 0;
  for (const plot of state.plots) {
    if (!plot.b) continue;
    if (plot.b.buildLeft > 0) {
      plot.b.buildLeft -= 1;
      if (plot.b.buildLeft === 0 && plot.owner === 'me') {
        result.fx.push({ plotId: plot.id, text: 'Hoàn thành!', color: '#ffd166' });
        addLog(state, `${BUILDINGS[plot.b.type].name} lô #${plot.id} đã hoàn thành.`);
        if (isLandmarkType(plot.b.type)) {
          (result.completedLandmarks ??= []).push(BUILDINGS[plot.b.type].name);
        }
      }
      continue;
    }
    if (plot.owner !== 'me') continue;

    const def = BUILDINGS[plot.b.type];
    if (plot.b.paused) {
      continue;
    }
    if (def.rental) {
      if (hasBroker) {
        if (plot.b.listed && !plot.b.rented) {
          plot.b.rented = true;
        }
      } else if (plot.b.listed && !plot.b.rented && Math.random() < 0.3 + state.idx[plot.region] * 0.1) {
        plot.b.rented = true;
        addLog(state, `Có khách thuê ${def.name} lô #${plot.id}.`);
      } else if (plot.b.rented && Math.random() < 0.01) {
        plot.b.rented = false;
        addLog(state, `Khách thuê rời ${def.name} lô #${plot.id}.`);
      }
    }

    const dailyRev = getDailyIncome(state, plot) * (0.8 + Math.random() * 0.4);
    if (dailyRev > 0) {
      recordRevenue(state, dailyRev);
      result.fx.push({ plotId: plot.id, text: '+' + formatMoney(dailyRev), color: '#6ee7a8' });
    }

    const plotMaint = def.maint * plot.b.level;
    totalMaint += plotMaint;

    const inv = getActiveInvestment(state, plot.id);
    if (inv) {
      const dailyNet = dailyRev * (1 - bizTaxRate) - plotMaint - (getLandPrice(state, plot) * RATES.landTax) / 30;
      settleInvestmentDailyProfit(state, inv, dailyNet);
    }
  }
  const staffSal = getDailyStaffSalary(state);
  if (totalMaint + staffSal > 0) recordExpense(state, totalMaint + staffSal);

  // Mature investment contracts
  for (const inv of state.investments) {
    if (inv.status === 'closed' || state.day < inv.endDay) continue;
    if (state.cash >= inv.remaining) {
      repayInvestment(state, inv.id);
    } else if (inv.status !== 'due') {
      inv.status = 'due';
      addLog(state, `Hợp đồng #${inv.id} đến hạn: chưa đủ vốn hoàn trả, tiếp tục chia lời 70/30.`);
      result.events.push(`Hợp đồng #${inv.id} đến hạn hoàn vốn!`);
    }
  }

  // Savings interest
  state.savings += (state.savings * RATES.savings) / 365;

  // Loans daily interest & maturity
  for (const loan of state.loans) {
    recordExpense(state, (loan.remaining * RATES.loan) / 365);
    loan.daysLeft -= 1;
    if (loan.daysLeft <= 0) {
      const paid = Math.min(state.cash, loan.remaining);
      state.cash -= paid;
      loan.remaining -= paid;
      if (loan.remaining > 1) {
        loan.remaining *= 1.02;
        loan.daysLeft = 30;
        addLog(state, `Khoản vay #${loan.id} quá hạn! Phạt 2%, gia hạn 30 ngày.`);
        result.events.push('Khoản vay quá hạn, bị phạt 2%!');
      } else {
        addLog(state, `Khoản vay #${loan.id} đã được thanh toán khi đáo hạn.`);
      }
    }
  }
  state.loans = state.loans.filter((l) => l.remaining > 1);

  // Market index drift
  for (const region of Object.keys(state.idx) as RegionId[]) {
    const builtCount = state.plots.filter((p) => p.region === region && p.b).length;
    state.idx[region] = Math.max(
      0.5,
      state.idx[region] * (1.0006 + builtCount * 1e-5 + (Math.random() - 0.5) * 0.012)
    );
  }

  // Random market event (9%/day)
  if (Math.random() < 0.09) {
    const regions = Object.keys(state.idx) as RegionId[];
    const region = regions[Math.floor(Math.random() * regions.length)];
    const events: Array<[string, number]> = [
      [`UBND phê duyệt quy hoạch đường mới tại ${REGION_NAMES[region]}`, 0.08],
      [`Mở khu thương mại mới tại ${REGION_NAMES[region]}`, 0.12],
      [`Sốt đất ${REGION_NAMES[region]}! Nhà đầu tư đổ xô`, 0.15],
      [`Thị trường ${REGION_NAMES[region]} trầm lắng, giá giảm`, -0.07],
      [`Siết tín dụng bất động sản tại ${REGION_NAMES[region]}`, -0.05],
    ];
    const [headline, delta] = events[Math.floor(Math.random() * events.length)];
    state.idx[region] *= 1 + delta;
    result.events.push(`${headline} (${delta > 0 ? '+' : ''}${Math.round(delta * 100)}%)`);
    addLog(state, headline);
  }

  // Random UBND auction (5%/day)
  if (!state.auction && Math.random() < 0.05) {
    const roadFree = state.plots.filter((p) => p.kind === 'land' && !p.owner && isNearRoad(state, p));
    if (roadFree.length) {
      const target = roadFree[Math.floor(Math.random() * roadFree.length)];
      const basePrice = getLandPrice(state, target);
      const rivals = state.npcs.filter((n) => n.rival);
      const rival = rivals[Math.floor(Math.random() * rivals.length)];
      state.auction = {
        plotId: target.id,
        bid: Math.round((basePrice * 0.9) / MILLION) * MILLION,
        leader: '',
        npcId: rival.id,
        npcMax: basePrice * (1.05 + Math.random() * 0.35),
      };
      result.events.push(`UBND tổ chức đấu giá lô #${target.id} (${REGION_NAMES[target.region]})!`);
      addLog(state, `Đấu giá lô #${target.id} khởi điểm ${formatMoney(state.auction.bid)}.`);
    }
  }

  // Foreign governments auto-build
  stepForeignGovDevelopment(state);

  // NPC & Rival AI actions
  for (const npc of state.npcs) {
    if (Math.random() > (npc.rival ? 0.35 : 0.06)) continue;
    const freeLand = state.plots.filter((p) => p.kind === 'land' && !p.owner);
    if (freeLand.length && Math.random() < 0.6) {
      const chosen = freeLand[Math.floor(Math.random() * freeLand.length)];
      const price = getLandPrice(state, chosen);
      if (npc.cash > price) {
        npc.cash -= price;
        chosen.owner = npc.id;
        if (npc.rival && Math.random() < 0.6) {
          const allowed = (Object.keys(BUILDINGS) as BuildingType[]).filter((t) => canBuildInPlot(chosen, t));
          if (allowed.length) {
            const bType = allowed[Math.floor(Math.random() * allowed.length)];
            chosen.b = {
              type: bType,
              level: 1,
              buildLeft: BUILDINGS[bType].days,
              rented: true,
              listed: false,
            };
          }
        }
        if (npc.rival && Math.random() < 0.3) {
          addLog(state, `${npc.name} vừa thâu tóm lô #${chosen.id} tại ${REGION_NAMES[chosen.region]}.`);
        }
      }
    } else {
      const owned = state.plots.filter((p) => p.owner === npc.id && !isCityLandmarkPlot(p));
      if (owned.length) {
        owned[Math.floor(Math.random() * owned.length)].forSale = Math.random() < 0.5;
      }
    }
    npc.cash += (npc.rival ? 0.4 : 0.05) * BILLION * Math.random();
  }

  // Incoming NPC offers (15%/day, expire after 5 days)
  state.offers = state.offers.filter((o) => state.day - o.day < 5 && state.plots[o.plotId]?.owner === 'me');
  const myPlots = getOwnedPlots(state);
  if (myPlots.length && Math.random() < 0.15) {
    const plot = myPlots[Math.floor(Math.random() * myPlots.length)];
    const npc = state.npcs[Math.floor(Math.random() * state.npcs.length)];
    const offerPrice = Math.round((getPlotTotalValue(state, plot) * (0.9 + Math.random() * 0.25)) / MILLION) * MILLION;
    state.offers.unshift({ plotId: plot.id, npcId: npc.id, price: offerPrice, day: state.day });
    result.events.push(`${npc.name} muốn mua lô #${plot.id} giá ${formatMoney(offerPrice)}`);
  }

  // Monthly tax settlement (every 30 days)
  if (state.day % 30 === 0) {
    const landTax = myPlots.reduce((sum, p) => sum + getLandPrice(state, p), 0) * RATES.landTax;
    const bizTax = state.month.revenue * getEffectiveBizTaxRate(state);
    state.cash -= landTax + bizTax;
    state.total.tax += landTax + bizTax;
    state.lastTax = { land: landTax, biz: bizTax, day: state.day };
    addLog(state, `Nộp thuế tháng: thuế đất ${formatMoney(landTax)}, thuế kinh doanh ${formatMoney(bizTax)}.`);
    result.events.push(`Đã nộp thuế ${formatMoney(landTax + bizTax)}`);
    state.month = { revenue: 0, expense: 0, tax: 0 };
  }

  // Dynamic map expansion: the longer you play, the more land unlocks!
  if ((state.day === 15 || state.day % 30 === 0) && getMapHeight(state) < MAX_MAP_H) {
    const added = expandWorldRows(state, EXPANSION_ROWS_STEP);
    if (added > 0) {
      const msg = `🗺 Mở rộng quy hoạch: khai phá thêm ${added} lô đất mới về phía Nam!`;
      addLog(state, msg);
      result.events.push(msg);
    }
  }

  // Coastal land reclamation every 20 days in Vùng biển
  if (state.day % 20 === 0) {
    const reclaimed = reclaimSeaLand(state, 3);
    if (reclaimed > 0) {
      const msg = `🏝 Lấn biển Vùng biển: mở thêm ${reclaimed} lô đất ven biển mới!`;
      addLog(state, msg);
      result.events.push(msg);
    }
  }

  state.history.push({ day: state.day, worth: getNetWorth(state), cash: state.cash });
  if (state.history.length > 120) state.history.shift();

  return result;
}

// Compact City Snapshot for Visit Mode (Top 1 / BXH)
export function extractCitySnapshot(state: GameState): CitySnapshot {
  const mapH = getMapHeight(state);
  const reclaimed: number[] = [];
  for (const p of state.plots) {
    if (p.region === 'sea' && p.y < 28 && p.x + p.y > 45.36 && p.kind === 'land') {
      reclaimed.push(p.id);
    }
  }
  const owned = getOwnedPlots(state).map((p) => ({
    id: p.id,
    ...(p.b
      ? {
          b: {
            type: p.b.type,
            level: p.b.level,
            buildLeft: p.b.buildLeft,
            ...(p.b.paint ? { paint: p.b.paint } : {}),
          },
        }
      : {}),
  }));
  return {
    v: 1,
    mapH,
    tetMode: state.tetMode,
    seasonMode: state.seasonMode,
    reclaimed,
    owned,
  };
}

export function buildVisitedGameState(
  meta: { day: number; cash: number },
  snap: CitySnapshot
): GameState {
  const s = createInitialGameState();
  const targetH = Math.min(MAX_MAP_H, Math.max(MAP_H, Math.floor(snap.mapH || MAP_H)));
  if (targetH > MAP_H) {
    expandWorldRows(s, targetH - MAP_H);
  }
  if (Array.isArray(snap.reclaimed)) {
    for (const id of snap.reclaimed) {
      const p = s.plots[id];
      if (p) {
        p.kind = 'land';
        p.owner = null;
        p.b = null;
        p.forSale = false;
      }
    }
  }
  if (Array.isArray(snap.owned)) {
    for (const item of snap.owned) {
      const p = s.plots[item.id];
      if (!p) continue;
      p.kind = 'land';
      p.owner = 'me';
      p.forSale = false;
      if (item.b && BUILDINGS[item.b.type]) {
        p.b = {
          type: item.b.type,
          level: Math.max(1, Math.min(3, Math.floor(item.b.level || 1))),
          buildLeft: Math.max(0, Math.floor(item.b.buildLeft || 0)),
          rented: true,
          listed: false,
          ...(item.b.paint ? { paint: item.b.paint } : {}),
        };
      } else {
        p.b = null;
      }
    }
  }
  s.day = Math.max(1, Math.floor(meta.day || 1));
  s.hour = 10.5;
  s.cash = Number(meta.cash) || 0;
  s.tetMode = snap.tetMode ?? 'calendar';
  s.seasonMode = snap.seasonMode ?? 'auto';
  s.paused = true;
  s.tutorialDone = true;
  return s;
}

// Offline earnings (capped at OFFLINE_MAX_HOURS = 4h)
export function applyOfflineProgress(state: GameState, now = Date.now()): OfflineReport | null {
  const prevAt = state.lastActiveAt;
  state.lastActiveAt = now;

  if (!state.tutorialDone || state.paused || typeof prevAt !== 'number' || !Number.isFinite(prevAt)) {
    return null;
  }

  const elapsedMs = now - prevAt;
  if (elapsedMs < OFFLINE_MIN_MS) return null;

  const myPlots = getOwnedPlots(state);
  const hasProgress = myPlots.some((p) => p.b) || state.savings > 0;
  if (!hasProgress) return null;

  const cappedMs = Math.min(elapsedMs, OFFLINE_MAX_MS);
  const wasCapped = elapsedMs > OFFLINE_MAX_MS;
  const totalOfflineDays = cappedMs / 1000 / OFFLINE_SECONDS_PER_DAY;
  if (totalOfflineDays < 0.05) return null;

  const fullDays = Math.floor(totalOfflineDays);
  const rem = totalOfflineDays - fullDays;
  const startCash = state.cash;

  let grossRevenue = 0;
  let maintenance = 0;
  let staffSalary = 0;
  let taxPaid = 0;
  let investorPaid = 0;
  let loanInterest = 0;
  let savingsInterest = 0;
  const completedBuildings: string[] = [];
  let newPlotsUnlocked = 0;
  const bizTaxRate = getEffectiveBizTaxRate(state);
  const hasBroker = hasStaff(state, 'super_broker');
  const dailyStaffSal = getDailyStaffSalary(state);

  const runSlice = (weight: number, isFullDay: boolean) => {
    if (isFullDay) {
      state.day += 1;
    } else {
      state.hour += weight * 24;
      while (state.hour >= 24) {
        state.hour -= 24;
        state.day += 1;
      }
    }

    state.campaigns = state.campaigns.filter((c) => state.day < c.endDay);

    for (const plot of myPlots) {
      const landTax = ((getLandPrice(state, plot) * RATES.landTax) / 30) * weight;
      if (landTax > 0) {
        state.cash -= landTax;
        state.total.tax += landTax;
        taxPaid += landTax;
      }

      if (!plot.b) continue;
      if (plot.b.buildLeft > 0) {
        if (isFullDay) {
          plot.b.buildLeft -= 1;
          if (plot.b.buildLeft === 0) {
            const name = BUILDINGS[plot.b.type].name;
            completedBuildings.push(name);
            addLog(state, `${name} lô #${plot.id} đã hoàn thành (offline).`);
          }
        }
        continue;
      }

      const def = BUILDINGS[plot.b.type];
      if (plot.b.paused) {
        continue;
      }
      if (def.rental && plot.b.listed && !plot.b.rented) {
        if (hasBroker || Math.random() < (0.3 + state.idx[plot.region] * 0.1) * weight) {
          plot.b.rented = true;
        }
      }

      const rev = getDailyIncome(state, plot) * weight;
      const maint = def.maint * plot.b.level * weight;
      const bizTax = rev * bizTaxRate;

      if (rev > 0) {
        state.cash += rev;
        state.total.revenue += rev;
        grossRevenue += rev;
      }
      if (maint > 0) {
        state.cash -= maint;
        state.total.expense += maint;
        maintenance += maint;
      }
      if (bizTax > 0) {
        state.cash -= bizTax;
        state.total.tax += bizTax;
        taxPaid += bizTax;
      }

      const inv = getActiveInvestment(state, plot.id);
      if (inv) {
        const prevPaid = inv.investorPaid;
        const dailyNet = rev - bizTax - maint - landTax;
        settleInvestmentDailyProfit(state, inv, dailyNet);
        investorPaid += Math.max(0, inv.investorPaid - prevPaid);
      }
    }

    if (dailyStaffSal > 0) {
      const sal = dailyStaffSal * weight;
      state.cash -= sal;
      state.total.expense += sal;
      staffSalary += sal;
    }

    if (state.savings > 0) {
      const sInt = ((state.savings * RATES.savings) / 365) * weight;
      state.savings += sInt;
      savingsInterest += sInt;
    }

    for (const loan of state.loans) {
      const lInt = ((loan.remaining * RATES.loan) / 365) * weight;
      if (lInt > 0) {
        state.cash -= lInt;
        state.total.expense += lInt;
        loanInterest += lInt;
      }
      if (isFullDay) {
        loan.daysLeft = Math.max(1, loan.daysLeft - 1);
      }
    }

    if (isFullDay) {
      if ((state.day === 15 || state.day % 30 === 0) && getMapHeight(state) < MAX_MAP_H) {
        newPlotsUnlocked += expandWorldRows(state, EXPANSION_ROWS_STEP);
      }
      if (state.day % 20 === 0) {
        newPlotsUnlocked += reclaimSeaLand(state, 3);
      }
    }
  };

  for (let i = 0; i < fullDays; i++) {
    runSlice(1, true);
  }
  if (rem >= 0.05) {
    runSlice(rem, false);
  }

  const netCashDelta = state.cash - startCash;
  if (
    Math.abs(netCashDelta) < 1 &&
    savingsInterest < 1 &&
    completedBuildings.length === 0 &&
    newPlotsUnlocked === 0
  ) {
    return null;
  }

  state.history.push({ day: state.day, worth: getNetWorth(state), cash: state.cash });
  if (state.history.length > 120) state.history.shift();

  const totalMin = Math.max(1, Math.floor(cappedMs / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const durStr = h > 0 ? (m > 0 ? `${h}g${m}p` : `${h}g`) : `${m}p`;
  addLog(
    state,
    `🌙 Thu nhập offline (${durStr} · ${Number(totalOfflineDays.toFixed(1))} ngày): ${netCashDelta >= 0 ? '+' : ''}${formatMoney(netCashDelta)}.`
  );

  return {
    elapsedMs,
    cappedMs,
    wasCapped,
    daysSimulated: totalOfflineDays,
    grossRevenue,
    maintenance,
    staffSalary,
    taxPaid,
    investorPaid,
    loanInterest,
    savingsInterest,
    netCashDelta,
    completedBuildings,
    newPlotsUnlocked,
  };
}

// Persistence
export function saveGameState(state: GameState): void {
  try {
    state.lastActiveAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, nego: null }));
  } catch {
    // ignore quota errors
  }
}

export function hydrateGameState(rawObj: unknown): GameState | null {
  try {
    if (!rawObj || typeof rawObj !== 'object') return null;
    const parsed = rawObj as GameState;
    if (parsed.v !== 1 || !Array.isArray(parsed.plots)) return null;
    parsed.investments ??= [];
    parsed.investmentSeq ??= 1;
    parsed.speed = 1;
    parsed.nego = null;
    parsed.visas ??= [];
    parsed.etex ??= false;
    parsed.claimedMissions ??= [];
    parsed.campaigns ??= [];
    parsed.staff = Array.isArray(parsed.staff) ? parsed.staff : [];
    if (!['auto', 'spring', 'summer', 'autumn', 'winter'].includes(parsed.seasonMode)) {
      parsed.seasonMode = 'auto';
    }
    ensureSkylineLandmarks(parsed);
    if (!['off', 'calendar', 'tet'].includes(parsed.tetMode)) {
      parsed.tetMode = 'calendar';
    }
    return parsed;
  } catch {
    return null;
  }
}

export function loadGameState(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem(LEGACY_SAVE_KEY);
    if (!raw) return null;
    return hydrateGameState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearGameState(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(LEGACY_SAVE_KEY);
  } catch {
    // ignore
  }
}
