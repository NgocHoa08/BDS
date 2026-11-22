import type {
  BuildingDef,
  BuildingType,
  CampaignType,
  DomesticRegionId,
  ForeignRegionId,
  GovId,
  PersonaId,
  RegionId,
} from './types';

export const MILLION = 1e6;
export const BILLION = 1e9;

export const MAP_W = 28;
export const MAP_H = 50;
export const MAX_MAP_H = 120;
export const EXPANSION_ROWS_STEP = 2;
export const PLOT_COUNT = MAP_W * MAP_H;

export const DOMESTIC_REGIONS: DomesticRegionId[] = ['city', 'country', 'sea', 'mountain'];
export const FOREIGN_REGIONS: ForeignRegionId[] = ['china', 'laos', 'thailand', 'cambodia'];
export const ALL_REGIONS: RegionId[] = [...DOMESTIC_REGIONS, ...FOREIGN_REGIONS];

export const isForeignRegion = (region: RegionId): region is ForeignRegionId =>
  (FOREIGN_REGIONS as string[]).includes(region);

export const REGION_NAMES: Record<RegionId, string> = {
  city: 'Thành phố',
  country: 'Vùng quê',
  sea: 'Vùng biển',
  mountain: 'Vùng núi',
  china: 'Trung Quốc',
  laos: 'Lào',
  thailand: 'Thái Lan',
  cambodia: 'Campuchia',
};

export const FOREIGN_INFO: Record<ForeignRegionId, { city: string; landmark: BuildingType }> = {
  china: { city: 'Thượng Hải', landmark: 'minh_chau' },
  laos: { city: 'Viêng Chăn', landmark: 'that_luang' },
  thailand: { city: 'Bangkok', landmark: 'wat_arun' },
  cambodia: { city: 'Siem Reap', landmark: 'angkor' },
};

export const LAND_TYPES: Record<RegionId, string> = {
  city: 'Đất ở đô thị',
  country: 'Đất vườn / ruộng',
  sea: 'Đất ven biển',
  mountain: 'Đất đồi',
  china: 'Đất đô thị Thượng Hải',
  laos: 'Đất ven sông Viêng Chăn',
  thailand: 'Đất đô thị Bangkok',
  cambodia: 'Đất du lịch Siem Reap',
};

export const BASE_LAND_PRICE: Record<RegionId, number> = {
  city: 14 * MILLION,
  country: 1.1 * MILLION,
  sea: 3.8 * MILLION,
  mountain: 0.75 * MILLION,
  china: 9 * MILLION,
  laos: 1.4 * MILLION,
  thailand: 6 * MILLION,
  cambodia: 2.4 * MILLION,
};

export const REGION_INCOME_MOD: Record<RegionId, number> = {
  city: 1.15,
  country: 0.9,
  sea: 1.1,
  mountain: 0.95,
  china: 1.2,
  laos: 0.95,
  thailand: 1.12,
  cambodia: 1.02,
};

export const AREA_RANGES: Record<RegionId, [number, number]> = {
  city: [60, 160],
  country: [250, 800],
  sea: [150, 450],
  mountain: [300, 1000],
  china: [80, 200],
  laos: [250, 700],
  thailand: [100, 260],
  cambodia: [200, 550],
};

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  nha_cap4: {
    name: 'Nhà cấp 4',
    cost: 350 * MILLION,
    days: 4,
    maint: 0.3 * MILLION,
    income: 3.5 * MILLION,
    rental: true,
    regions: ALL_REGIONS,
    height: 10,
    category: 'Nhà ở',
  },
  nha_pho: {
    name: 'Nhà phố',
    cost: 1.4 * BILLION,
    days: 8,
    maint: 1 * MILLION,
    income: 11 * MILLION,
    rental: true,
    regions: ['city', 'country', 'sea', ...FOREIGN_REGIONS],
    height: 26,
    category: 'Nhà ở',
  },
  biet_thu: {
    name: 'Biệt thự',
    cost: 3.5 * BILLION,
    days: 12,
    maint: 3 * MILLION,
    income: 26 * MILLION,
    rental: true,
    regions: ['city', 'sea', 'mountain', ...FOREIGN_REGIONS],
    height: 20,
    category: 'Nhà ở',
  },
  chung_cu: {
    name: 'Chung cư',
    cost: 14 * BILLION,
    days: 24,
    maint: 10 * MILLION,
    income: 95 * MILLION,
    rental: true,
    regions: ['city', 'china', 'thailand'],
    height: 64,
    category: 'Nhà ở',
  },
  cua_hang: {
    name: 'Cửa hàng',
    cost: 700 * MILLION,
    days: 5,
    maint: 0.8 * MILLION,
    income: 6.5 * MILLION,
    rental: false,
    regions: ALL_REGIONS,
    height: 14,
    category: 'Thương mại',
  },
  sieu_thi: {
    name: 'Siêu thị',
    cost: 5.5 * BILLION,
    days: 16,
    maint: 5 * MILLION,
    income: 42 * MILLION,
    rental: false,
    regions: ['city', 'country', 'china', 'thailand', 'cambodia'],
    height: 18,
    category: 'Thương mại',
  },
  khach_san: {
    name: 'Khách sạn',
    cost: 9 * BILLION,
    days: 20,
    maint: 8 * MILLION,
    income: 70 * MILLION,
    rental: false,
    regions: ['city', 'sea', 'mountain', ...FOREIGN_REGIONS],
    height: 52,
    category: 'Du lịch',
  },
  nha_hang: {
    name: 'Nhà hàng',
    cost: 1.8 * BILLION,
    days: 8,
    maint: 2 * MILLION,
    income: 15 * MILLION,
    rental: false,
    regions: ['city', 'sea', 'mountain', ...FOREIGN_REGIONS],
    height: 16,
    category: 'Thương mại',
  },
  nha_xuong: {
    name: 'Nhà xưởng',
    cost: 4.5 * BILLION,
    days: 14,
    maint: 4 * MILLION,
    income: 34 * MILLION,
    rental: false,
    regions: ['country', 'china', 'thailand', 'cambodia'],
    height: 18,
    category: 'Công nghiệp',
  },
  trang_trai: {
    name: 'Trang trại',
    cost: 500 * MILLION,
    days: 6,
    maint: 0.5 * MILLION,
    income: 5 * MILLION,
    rental: false,
    regions: ['country', 'mountain', 'laos', 'thailand', 'cambodia'],
    height: 9,
    category: 'Nông nghiệp',
  },
  quan_cafe: {
    name: 'Quán cà phê',
    cost: 450 * MILLION,
    days: 4,
    maint: 0.5 * MILLION,
    income: 4.6 * MILLION,
    rental: false,
    regions: ALL_REGIONS,
    height: 12,
    category: 'Thương mại',
  },
  tiem_banh_mi: {
    name: 'Tiệm bánh mì',
    cost: 300 * MILLION,
    days: 3,
    maint: 0.3 * MILLION,
    income: 3.2 * MILLION,
    rental: false,
    regions: ['city', 'country', 'sea', 'laos', 'cambodia'],
    height: 10,
    category: 'Thương mại',
  },
  cho_truyen_thong: {
    name: 'Chợ truyền thống',
    cost: 1.5 * BILLION,
    days: 8,
    maint: 1.3 * MILLION,
    income: 13 * MILLION,
    rental: false,
    regions: ['city', 'country', 'laos', 'thailand', 'cambodia'],
    height: 12,
    category: 'Thương mại',
  },
  trung_tam_tm: {
    name: 'Trung tâm thương mại',
    cost: 12 * BILLION,
    days: 24,
    maint: 10 * MILLION,
    income: 88 * MILLION,
    rental: false,
    regions: ['city', 'china', 'thailand'],
    height: 34,
    category: 'Thương mại',
  },
  spa: {
    name: 'Spa & thẩm mỹ',
    cost: 1.2 * BILLION,
    days: 7,
    maint: 1.2 * MILLION,
    income: 10.5 * MILLION,
    rental: false,
    regions: ['city', 'sea', 'china', 'thailand'],
    height: 16,
    category: 'Dịch vụ',
  },
  phong_gym: {
    name: 'Phòng gym',
    cost: 1.6 * BILLION,
    days: 8,
    maint: 1.6 * MILLION,
    income: 13 * MILLION,
    rental: false,
    regions: ['city', 'sea', 'china', 'thailand'],
    height: 18,
    category: 'Dịch vụ',
  },
  cay_xang: {
    name: 'Cây xăng',
    cost: 900 * MILLION,
    days: 5,
    maint: 0.9 * MILLION,
    income: 8 * MILLION,
    rental: false,
    regions: ['country', 'mountain', 'sea', 'laos', 'thailand', 'cambodia'],
    height: 10,
    category: 'Dịch vụ',
  },
  karaoke: {
    name: 'Karaoke',
    cost: 1.1 * BILLION,
    days: 6,
    maint: 1.1 * MILLION,
    income: 9.5 * MILLION,
    rental: false,
    regions: ['city', 'country', 'sea', 'china'],
    height: 16,
    category: 'Giải trí',
  },
  rap_phim: {
    name: 'Rạp chiếu phim',
    cost: 4.2 * BILLION,
    days: 14,
    maint: 3.8 * MILLION,
    income: 32 * MILLION,
    rental: false,
    regions: ['city', 'china', 'thailand'],
    height: 22,
    category: 'Giải trí',
  },
  khu_vui_choi: {
    name: 'Khu vui chơi',
    cost: 6.5 * BILLION,
    days: 18,
    maint: 6 * MILLION,
    income: 50 * MILLION,
    rental: false,
    regions: ['city', 'sea', 'china', 'thailand'],
    height: 34,
    category: 'Giải trí',
  },
  san_golf: {
    name: 'Sân golf',
    cost: 11 * BILLION,
    days: 24,
    maint: 8 * MILLION,
    income: 80 * MILLION,
    rental: false,
    regions: ['mountain', 'sea', 'china', 'thailand'],
    height: 6,
    category: 'Giải trí',
  },
  van_phong: {
    name: 'Cao ốc văn phòng',
    cost: 10 * BILLION,
    days: 22,
    maint: 8 * MILLION,
    income: 74 * MILLION,
    rental: true,
    regions: ['city', 'china', 'thailand'],
    height: 82,
    category: 'Văn phòng',
  },
  data_center: {
    name: 'Trung tâm dữ liệu',
    cost: 8 * BILLION,
    days: 20,
    maint: 9 * MILLION,
    income: 62 * MILLION,
    rental: false,
    regions: ['city', 'country', 'china'],
    height: 18,
    category: 'Văn phòng',
  },
  phong_kham: {
    name: 'Phòng khám đa khoa',
    cost: 2.2 * BILLION,
    days: 10,
    maint: 2 * MILLION,
    income: 18 * MILLION,
    rental: false,
    regions: ['city', 'country', 'sea', 'mountain', 'laos', 'cambodia'],
    height: 20,
    category: 'Y tế & Giáo dục',
  },
  benh_vien: {
    name: 'Bệnh viện quốc tế',
    cost: 9.5 * BILLION,
    days: 22,
    maint: 9 * MILLION,
    income: 70 * MILLION,
    rental: false,
    regions: ['city', 'china', 'thailand'],
    height: 46,
    category: 'Y tế & Giáo dục',
  },
  truong_hoc: {
    name: 'Trường quốc tế',
    cost: 5 * BILLION,
    days: 16,
    maint: 4.5 * MILLION,
    income: 37 * MILLION,
    rental: false,
    regions: ['city', 'country', 'china', 'thailand', 'cambodia'],
    height: 22,
    category: 'Y tế & Giáo dục',
  },
  resort: {
    name: 'Resort nghỉ dưỡng',
    cost: 7.5 * BILLION,
    days: 18,
    maint: 6.5 * MILLION,
    income: 58 * MILLION,
    rental: false,
    regions: ['sea', 'mountain', 'thailand', 'cambodia'],
    height: 16,
    category: 'Du lịch',
  },
  homestay: {
    name: 'Homestay nhà sàn',
    cost: 650 * MILLION,
    days: 5,
    maint: 0.6 * MILLION,
    income: 6 * MILLION,
    rental: true,
    regions: ['mountain', 'country', 'laos'],
    height: 14,
    category: 'Du lịch',
  },
  glamping: {
    name: 'Khu cắm trại glamping',
    cost: 800 * MILLION,
    days: 5,
    maint: 0.7 * MILLION,
    income: 7.4 * MILLION,
    rental: false,
    regions: ['mountain', 'sea', 'laos'],
    height: 8,
    category: 'Du lịch',
  },
  ben_du_thuyen: {
    name: 'Bến du thuyền',
    cost: 6 * BILLION,
    days: 16,
    maint: 5.5 * MILLION,
    income: 46 * MILLION,
    rental: false,
    regions: ['sea', 'thailand', 'cambodia'],
    height: 14,
    category: 'Du lịch',
  },
  kho_logistics: {
    name: 'Kho logistics',
    cost: 3.2 * BILLION,
    days: 11,
    maint: 2.8 * MILLION,
    income: 25 * MILLION,
    rental: false,
    regions: ['country', 'sea', 'china', 'thailand', 'laos'],
    height: 16,
    category: 'Công nghiệp',
  },
  dien_mat_troi: {
    name: 'Điện mặt trời',
    cost: 2.6 * BILLION,
    days: 9,
    maint: 1.4 * MILLION,
    income: 19 * MILLION,
    rental: false,
    regions: ['country', 'mountain', 'sea', 'laos', 'cambodia'],
    height: 4,
    category: 'Công nghiệp',
  },
  dam_tom: {
    name: 'Đầm nuôi tôm',
    cost: 900 * MILLION,
    days: 6,
    maint: 0.8 * MILLION,
    income: 8.2 * MILLION,
    rental: false,
    regions: ['sea', 'country', 'cambodia'],
    height: 3,
    category: 'Nông nghiệp',
  },
  doi_che: {
    name: 'Đồi chè',
    cost: 700 * MILLION,
    days: 6,
    maint: 0.5 * MILLION,
    income: 6.2 * MILLION,
    rental: false,
    regions: ['mountain', 'laos', 'china'],
    height: 5,
    category: 'Nông nghiệp',
  },
  nha_kinh: {
    name: 'Nông trại nhà kính',
    cost: 1.3 * BILLION,
    days: 7,
    maint: 1.1 * MILLION,
    income: 11.2 * MILLION,
    rental: false,
    regions: ['country', 'mountain', 'china', 'thailand'],
    height: 9,
    category: 'Nông nghiệp',
  },
  thap_81: {
    name: 'Tháp Việt 81',
    cost: 48 * BILLION,
    days: 45,
    maint: 28 * MILLION,
    income: 380 * MILLION,
    rental: false,
    regions: ['city'],
    height: 190,
    category: 'Biểu tượng',
  },
  thap_sen: {
    name: 'Tháp Búp Sen',
    cost: 32 * BILLION,
    days: 36,
    maint: 20 * MILLION,
    income: 260 * MILLION,
    rental: false,
    regions: ['city'],
    height: 145,
    category: 'Biểu tượng',
  },
  minh_chau: {
    name: 'Tháp Minh Châu',
    cost: 40 * BILLION,
    days: 40,
    maint: 24 * MILLION,
    income: 300 * MILLION,
    rental: false,
    regions: ['china'],
    height: 165,
    category: 'Biểu tượng',
  },
  that_luang: {
    name: 'Thạt Luổng',
    cost: 22 * BILLION,
    days: 30,
    maint: 14 * MILLION,
    income: 170 * MILLION,
    rental: false,
    regions: ['laos'],
    height: 62,
    category: 'Biểu tượng',
  },
  wat_arun: {
    name: 'Chùa Bình Minh',
    cost: 26 * BILLION,
    days: 32,
    maint: 16 * MILLION,
    income: 200 * MILLION,
    rental: false,
    regions: ['thailand'],
    height: 88,
    category: 'Biểu tượng',
  },
  angkor: {
    name: 'Đền Angkor Wat',
    cost: 30 * BILLION,
    days: 36,
    maint: 18 * MILLION,
    income: 230 * MILLION,
    rental: false,
    regions: ['cambodia'],
    height: 58,
    category: 'Biểu tượng',
  },
};

export const LANDMARK_TYPES: BuildingType[] = [
  'thap_81',
  'thap_sen',
  'minh_chau',
  'that_luang',
  'wat_arun',
  'angkor',
];

export const isLandmarkType = (type: BuildingType): boolean => LANDMARK_TYPES.includes(type);

export const BUILDABLE_TYPES: BuildingType[] = (Object.keys(BUILDINGS) as BuildingType[]).filter(
  (type) => !isLandmarkType(type)
);

export const LANDMARK_PLACEMENTS: Array<{ x: number; y: number; type: BuildingType }> = [
  { x: 16, y: 11, type: 'thap_81' },
  { x: 21, y: 13, type: 'thap_sen' },
  { x: 3, y: 33, type: 'minh_chau' },
  { x: 9, y: 33, type: 'that_luang' },
  { x: 16, y: 33, type: 'wat_arun' },
  { x: 22, y: 33, type: 'angkor' },
];

export const PALACE_BOUNDS = {
  x: 18,
  y: -3,
  width: 2,
  depth: 2,
};

export const isPalaceCoord = (x: number, y: number): boolean =>
  x >= PALACE_BOUNDS.x &&
  x < PALACE_BOUNDS.x + PALACE_BOUNDS.width &&
  y >= PALACE_BOUNDS.y &&
  y < PALACE_BOUNDS.y + PALACE_BOUNDS.depth;

export const GOV_INFO: Record<GovId, { name: string; desc: string }> = {
  ubnd: {
    name: 'UBND',
    desc: 'Ủy ban nhân dân: công bố quy hoạch, sự kiện và đấu giá đất.',
  },
  dangky: {
    name: 'Văn phòng đăng ký đất đai',
    desc: 'Đăng ký sang tên. Lệ phí trước bạ 0,5% khi mua đất.',
  },
  thue: {
    name: 'Cơ quan thuế',
    desc: 'Thu thuế mỗi 30 ngày: thuế đất 0,03%/tháng giá trị đất, thuế kinh doanh 7% doanh thu. Thuế chuyển nhượng 2% khi bán.',
  },
  quyhoach: {
    name: 'Phòng quy hoạch đô thị',
    desc: 'Cấp giấy phép xây dựng (phí 2% chi phí xây) và quy định loại công trình được phép theo khu vực.',
  },
  gov_china: {
    name: 'Chính phủ Trung Quốc',
    desc: 'Quản lý đất đai Trung Quốc, tự động cấp phép xây dựng. Nhà đầu tư Việt cần visa và thẻ ETEX.',
  },
  gov_laos: {
    name: 'Chính phủ Lào',
    desc: 'Quản lý đất đai Lào, tự động cấp phép xây dựng. Nhà đầu tư Việt cần visa và thẻ ETEX.',
  },
  gov_thailand: {
    name: 'Chính phủ Thái Lan',
    desc: 'Quản lý đất đai Thái Lan, tự động cấp phép xây dựng. Nhà đầu tư Việt cần visa và thẻ ETEX.',
  },
  gov_cambodia: {
    name: 'Chính phủ Campuchia',
    desc: 'Quản lý đất đai Campuchia, tự động cấp phép xây dựng. Nhà đầu tư Việt cần visa và thẻ ETEX.',
  },
};

export const FOREIGN_GOVS: Record<ForeignRegionId, { x: number; y: number; id: GovId }> = {
  china: { x: 3, y: 39, id: 'gov_china' },
  laos: { x: 10, y: 39, id: 'gov_laos' },
  thailand: { x: 16, y: 39, id: 'gov_thailand' },
  cambodia: { x: 23, y: 39, id: 'gov_cambodia' },
};

export const FOREIGN_GOV_MAP: Record<string, GovId> = Object.fromEntries(
  Object.values(FOREIGN_GOVS).map((g) => [`${g.x},${g.y}`, g.id])
);

export const DOMESTIC_GOV_MAP: Record<string, GovId> = {
  '13,13': 'ubnd',
  '14,13': 'dangky',
  '13,14': 'thue',
  '14,14': 'quyhoach',
};

export const VISA_FEE = 30 * MILLION;
export const ETEX_CARD_FEE = 5 * MILLION;
export const ETEX_SWIPE_RATE = 0.002;
export const ETEX_MIN_FEE = 0.5 * MILLION;

export const RATES = {
  savings: 0.05,
  loan: 0.09,
  landTax: 0.0003,
  bizTax: 0.07,
  regFee: 0.005,
  transferTax: 0.02,
  permit: 0.02,
};

export const SPEEDS = [1, 2] as const;

export const OFFLINE_MAX_HOURS = 4;
export const OFFLINE_MAX_MS = OFFLINE_MAX_HOURS * 3600 * 1000;
export const OFFLINE_MIN_MS = 60 * 1000;
export const OFFLINE_SECONDS_PER_DAY = 120; // 2 phút ngoài đời = 1 ngày game (30 ngày/giờ, tối đa 4 giờ = 120 ngày)

export const INVESTOR_SHARE = 0.7;
export const PLAYER_SHARE = 0.3;

export const PERSONA_LABELS: Record<PersonaId, string> = {
  greedy: 'Khó tính',
  fair: 'Sòng phẳng',
  easy: 'Dễ tính',
};

export const CAMPAIGNS: Record<
  CampaignType,
  { name: string; cost: number; days: number; boost: number }
> = {
  marketing: { name: 'Quảng bá khu phố', cost: 8 * MILLION, days: 7, boost: 0.2 },
  festival: { name: 'Lễ hội cuối tuần', cost: 20 * MILLION, days: 10, boost: 0.35 },
};

export interface MissionDef {
  id: string;
  name: string;
  detail: string;
  target: number;
  reward: number;
}

export const MISSIONS: MissionDef[] = [
  { id: 'first_land', name: 'Tấc đất đầu tiên', detail: 'Sở hữu 1 lô đất', target: 1, reward: 30 * MILLION },
  { id: 'first_build', name: 'Khởi nghiệp xây dựng', detail: 'Hoàn thành 1 công trình', target: 1, reward: 60 * MILLION },
  { id: 'partner', name: 'Bắt tay làm lớn', detail: 'Ký 1 hợp đồng đầu tư', target: 1, reward: 40 * MILLION },
  { id: 'portfolio', name: 'Nhà phát triển', detail: 'Sở hữu 5 lô đất', target: 5, reward: 150 * MILLION },
  { id: 'income', name: 'Dòng tiền vững vàng', detail: 'Đạt 100 triệu tổng doanh thu', target: 100 * MILLION, reward: 100 * MILLION },
  { id: 'regions', name: 'Dấu chân BDSNH', detail: 'Sở hữu đất tại cả 4 khu vực trong nước', target: 4, reward: 250 * MILLION },
  { id: 'cross_river', name: 'Qua cầu biên giới', detail: 'Sở hữu 1 lô đất ở nước láng giềng', target: 1, reward: 120 * MILLION },
  { id: 'global', name: 'Vươn ra biển lớn', detail: 'Sở hữu đất tại cả 4 nước láng giềng', target: 4, reward: 2 * BILLION },
  { id: 'skyline', name: 'Chạm tới bầu trời', detail: 'Sở hữu 1 tháp biểu tượng hoàn thành', target: 1, reward: 1 * BILLION },
];

export const NPC_NAMES = [
  'Ông Ba Tèo',
  'Bà Năm Lụa',
  'Chú Tư Hải',
  'Cô Sáu Hồng',
  'Anh Bảy Long',
  'Chị Tám Mai',
  'Ông Hai Phúc',
  'Bà Chín Liên',
  'Anh Minh Đức',
  'Chị Thu Hà',
  'Ông Quang Vinh',
  'Bà Kim Oanh',
];

export const NPC_ROLES = [
  'Người dân',
  'Người bán đất',
  'Người mua đất',
  'Nhà đầu tư',
  'Chủ doanh nghiệp',
  'Khách thuê nhà',
];

export const TUTORIAL_STEPS: Array<[string, string]> = [
  [
    'Chào mừng đến BDSNH!',
    'Bạn khởi nghiệp với 1 tỷ VNĐ tại BDSNH. Mục tiêu: mua đất, xây dựng, cho thuê, kinh doanh và xây dựng đế chế bất động sản.',
  ],
  [
    'Bản đồ 4 khu vực',
    'Thành phố (phía phải), Vùng núi (phía trên), Vùng quê (phía trái), Vùng biển (phía dưới). Kéo để di chuyển, chụm 2 ngón hoặc cuộn chuột để phóng to/thu nhỏ. Tòa nhà mái đỏ ở giữa là các cơ quan chính quyền.',
  ],
  [
    'Mua đất',
    'Chạm vào ô đất trống để xem diện tích, giá và mua. Ô có cờ đỏ là đất NPC đang rao bán — bạn có thể thương lượng giá. Viền vàng là đất của bạn, viền đỏ là của đối thủ.',
  ],
  [
    'Xây dựng & thu nhập',
    'Trên đất của bạn, chọn Xây dựng. Nhà ở cần đăng cho thuê để có khách; cửa hàng, khách sạn... tự kinh doanh. Thu nhập vào tài khoản mỗi ngày.',
  ],
  [
    'Ngân hàng & thuế',
    'Gửi tiết kiệm lãi 5%/năm hoặc vay vốn 9%/năm. Cứ 30 ngày nộp thuế đất và thuế kinh doanh. Thời gian có x1 và x2. Mở Đầu tư & gọi vốn để ký hợp đồng: nhà đầu tư hưởng 70%, bạn 30% lợi nhuận ròng.',
  ],
];
