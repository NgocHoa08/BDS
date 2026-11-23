export type DomesticRegionId = 'city' | 'country' | 'sea' | 'mountain';
export type ForeignRegionId = 'china' | 'laos' | 'thailand' | 'cambodia';
export type RegionId = DomesticRegionId | ForeignRegionId;

export type PlotKind = 'land' | 'road' | 'water' | 'gov';

export type GovId =
  | 'ubnd'
  | 'dangky'
  | 'thue'
  | 'quyhoach'
  | 'gov_china'
  | 'gov_laos'
  | 'gov_thailand'
  | 'gov_cambodia';

export type PersonaId = 'greedy' | 'fair' | 'easy';

export type TetMode = 'off' | 'calendar' | 'tet';

export type CampaignType = 'marketing' | 'festival';

export type BuildingType =
  | 'nha_cap4'
  | 'nha_pho'
  | 'biet_thu'
  | 'chung_cu'
  | 'cua_hang'
  | 'sieu_thi'
  | 'khach_san'
  | 'nha_hang'
  | 'nha_xuong'
  | 'trang_trai'
  | 'quan_cafe'
  | 'tiem_banh_mi'
  | 'cho_truyen_thong'
  | 'trung_tam_tm'
  | 'spa'
  | 'phong_gym'
  | 'cay_xang'
  | 'karaoke'
  | 'rap_phim'
  | 'khu_vui_choi'
  | 'san_golf'
  | 'van_phong'
  | 'data_center'
  | 'phong_kham'
  | 'benh_vien'
  | 'truong_hoc'
  | 'resort'
  | 'homestay'
  | 'glamping'
  | 'ben_du_thuyen'
  | 'kho_logistics'
  | 'dien_mat_troi'
  | 'dam_tom'
  | 'doi_che'
  | 'nha_kinh'
  | 'thap_81'
  | 'thap_sen'
  | 'minh_chau'
  | 'that_luang'
  | 'wat_arun'
  | 'angkor';

export interface BuildingDef {
  name: string;
  cost: number;
  days: number;
  maint: number;
  income: number;
  rental: boolean;
  regions: RegionId[];
  height: number;
  category: string;
}

export interface BuildingPaint {
  wall?: string;
  roof?: string;
}

export interface PlotBuilding {
  type: BuildingType;
  level: number;
  buildLeft: number;
  rented: boolean;
  listed: boolean;
  paused?: boolean;
  paint?: BuildingPaint;
}

export interface Plot {
  id: number;
  x: number;
  y: number;
  kind: PlotKind;
  region: RegionId;
  area: number;
  mod: number;
  owner: string | null; // 'me' | 'city' | npcId | null
  b: PlotBuilding | null;
  gov?: GovId;
  forSale: boolean;
}

export interface Npc {
  id: string;
  name: string;
  role: string;
  persona: PersonaId;
  cash: number;
  rival?: boolean;
}

export interface Loan {
  id: number;
  principal: number;
  remaining: number;
  termDays: number;
  daysLeft: number;
}

export interface Investment {
  id: number;
  plotId: number;
  npcId: string;
  principal: number;
  remaining: number;
  signedDay: number;
  termDays: number;
  endDay: number;
  netProfit: number;
  sharedProfit: number;
  investorPaid: number;
  playerProfit: number;
  status: 'active' | 'due' | 'closed';
}

export interface NegotiationLine {
  who: 'npc' | 'me';
  text: string;
}

export interface Negotiation {
  mode: 'buy' | 'sell';
  plotId: number;
  npcId: string;
  ask: number;
  limit: number;
  patience: number;
  lines: NegotiationLine[];
  done?: 'ok' | 'fail';
}

export interface Auction {
  plotId: number;
  bid: number;
  leader: string;
  npcId: string;
  npcMax: number;
  done?: boolean;
}

export interface BuyOffer {
  plotId: number;
  npcId: string;
  price: number;
  day: number;
}

export interface Campaign {
  type: CampaignType;
  region: RegionId;
  endDay: number;
}

export interface HistoryPoint {
  day: number;
  worth: number;
  cash: number;
}

export interface LogEntry {
  day: number;
  text: string;
}

export interface TaxSummary {
  land: number;
  biz: number;
  day: number;
}

export interface FinanceTotals {
  revenue: number;
  expense: number;
  tax: number;
}

export interface GameState {
  v: number;
  day: number;
  hour: number;
  cash: number;
  savings: number;
  loans: Loan[];
  loanSeq: number;
  plots: Plot[];
  npcs: Npc[];
  idx: Record<RegionId, number>;
  history: HistoryPoint[];
  month: FinanceTotals;
  total: FinanceTotals;
  lastTax: TaxSummary | null;
  log: LogEntry[];
  offers: BuyOffer[];
  auction: Auction | null;
  nego: Negotiation | null;
  speed: number;
  paused: boolean;
  tutorialDone: boolean;
  heatmap: boolean;
  investments: Investment[];
  investmentSeq: number;
  claimedMissions: string[];
  campaigns: Campaign[];
  skylineAdded: boolean;
  tetMode: TetMode;
  visas: ForeignRegionId[];
  etex: boolean;
  lastActiveAt?: number;
}

export interface OfflineReport {
  elapsedMs: number;
  cappedMs: number;
  wasCapped: boolean;
  daysSimulated: number;
  grossRevenue: number;
  maintenance: number;
  taxPaid: number;
  investorPaid: number;
  loanInterest: number;
  savingsInterest: number;
  netCashDelta: number;
  completedBuildings: string[];
  newPlotsUnlocked: number;
}

export interface FloatingFx {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
}

export interface DayTickResult {
  fx: Array<{ plotId: number; text: string; color: string }>;
  events: string[];
  completedLandmarks?: string[];
}

export interface ChatMessage {
  id: string;
  user_id: string | null;
  player_name: string;
  kind: 'chat' | 'news';
  message: string;
  created_at: string;
}

export interface CitySnapshotPlot {
  id: number;
  b?: {
    type: BuildingType;
    level: number;
    buildLeft: number;
    paint?: BuildingPaint;
  };
}

export interface CitySnapshot {
  v: 1;
  mapH: number;
  tetMode: TetMode;
  reclaimed: number[];
  owned: CitySnapshotPlot[];
}

export type ActivePanel =
  | null
  | 'plot'
  | 'dat'
  | 'build'
  | 'bank'
  | 'biz'
  | 'stats'
  | 'settings'
  | 'invest'
  | 'city'
  | 'palace'
  | 'leaderboard';
