import { useState } from 'react';
import { BUILDABLE_TYPES, BUILDINGS, REGION_NAMES } from '../../game/constants';
import { buildOnPlot, canBuildInPlot, formatMoney } from '../../game/engine';
import type { GameState, Plot } from '../../game/types';
import type { ActionRunner } from '../ui';

const CATEGORIES = [
  'Tất cả',
  'Nhà ở',
  'Thương mại',
  'Dịch vụ',
  'Giải trí',
  'Văn phòng',
  'Du lịch',
  'Công nghiệp',
  'Nông nghiệp',
  'Y tế & Giáo dục',
];

export function BuildPanel({ s, p, act }: { s: GameState; p: Plot | null; act: ActionRunner }) {
  const [cat, setCat] = useState('Tất cả');
  const canBuildHere = Boolean(p && p.owner === 'me' && !p.b && p.kind === 'land');

  const list = BUILDABLE_TYPES.filter((t) => (!canBuildHere || (p ? canBuildInPlot(p, t) : true))).filter(
    (t) => cat === 'Tất cả' || BUILDINGS[t].category === cat
  );

  return (
    <div>
      {!canBuildHere ? (
        <p className="mb-3 rounded-xl bg-secondary p-2.5 text-sm">
          Chọn một lô đất trống <b>của bạn</b> trên bản đồ để xây. Danh sách bên dưới để tham khảo.
        </p>
      ) : (
        <p className="mb-2 text-sm">
          Xây trên lô #{p!.id} ({REGION_NAMES[p!.region]}). Phí giấy phép 2%.
        </p>
      )}

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              cat === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {list.map((type) => {
          const def = BUILDINGS[type];
          const allowed = !p || canBuildInPlot(p, type);
          return (
            <div key={type} className={`rounded-xl bg-secondary p-2.5 ${allowed ? '' : 'opacity-50'}`}>
              <div className="flex items-center justify-between gap-2">
                <b>
                  {def.name}{' '}
                  <span className="text-[10px] font-normal text-muted-foreground">· {def.category}</span>
                </b>
                <span className="text-sm font-bold text-primary">{formatMoney(def.cost)}</span>
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                ⏱ {def.days} ngày · 🔧 {formatMoney(def.maint)}/ngày · 💵 ~{formatMoney(def.income)}/ngày ·{' '}
                {def.rental ? 'Cho thuê' : 'Kinh doanh'}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Khu vực: {def.regions.map((r) => REGION_NAMES[r]).join(', ')}
              </div>
              {canBuildHere && p && (
                <button
                  disabled={!allowed || s.cash < def.cost * 1.02}
                  className="btn-gold mt-2 w-full text-sm"
                  onClick={() => act(() => buildOnPlot(s, p, type), 'Khởi công! 🏗', p)}
                >
                  {allowed ? 'Xây tại đây' : 'Không đúng quy hoạch'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
