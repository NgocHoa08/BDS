import { Building2, Clock, Coins, MapPin, MoonStar } from 'lucide-react';
import { OFFLINE_MAX_HOURS } from '../../game/constants';
import { formatMoney } from '../../game/engine';
import type { OfflineReport } from '../../game/types';
import { ModalFrame, StatRow } from '../ui';

function formatDurationVi(ms: number): string {
  const totalMin = Math.max(1, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h} giờ ${m} phút`;
  if (h > 0) return `${h} giờ`;
  return `${m} phút`;
}

export function OfflineModal({
  report,
  onClose,
}: {
  report: OfflineReport;
  onClose: () => void;
}) {
  const daysText =
    report.daysSimulated >= 1
      ? `${Number(report.daysSimulated.toFixed(1)).toLocaleString('vi-VN')} ngày game`
      : `${Math.round(report.daysSimulated * 24)} giờ game`;

  const totalGain = report.netCashDelta + report.savingsInterest;
  const isPositive = totalGain >= 0;

  return (
    <ModalFrame>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30">
              <MoonStar size={20} />
            </div>
            <div>
              <h3 className="text-gold text-lg font-black leading-tight">Chào mừng trở lại!</h3>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock size={12} />
                Vắng mặt {formatDurationVi(report.elapsedMs)}
                {report.wasCapped && ` (tính tối đa ${OFFLINE_MAX_HOURS} giờ)`}
              </p>
            </div>
          </div>
          {report.wasCapped && (
            <span className="shrink-0 rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
              Tối đa {OFFLINE_MAX_HOURS}h
            </span>
          )}
        </div>

        {/* Hero Net Cash Card */}
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-secondary/60 to-secondary/30 p-3.5 text-center">
          <div className="text-xs font-medium text-muted-foreground">
            Thu nhập ròng ngoại tuyến ({daysText})
          </div>
          <div
            className={`mt-1 flex items-center justify-center gap-1.5 text-2xl font-black tabular-nums ${
              isPositive ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            <Coins size={22} className="shrink-0 text-primary" />
            <span>
              {report.netCashDelta >= 0 ? '+' : ''}
              {formatMoney(report.netCashDelta)}
            </span>
          </div>
          {report.savingsInterest > 0 && (
            <div className="mt-1 text-xs font-semibold text-emerald-300">
              + {formatMoney(report.savingsInterest)} lãi gửi tiết kiệm
            </div>
          )}
        </div>

        {/* Breakdown */}
        <div className="rounded-2xl bg-secondary/50 px-3 py-2">
          {report.grossRevenue > 0 && (
            <StatRow k="Doanh thu công trình" v={'+' + formatMoney(report.grossRevenue)} c="text-emerald-400" />
          )}
          {report.savingsInterest > 0 && (
            <StatRow k="Lãi tiết kiệm (5%/năm)" v={'+' + formatMoney(report.savingsInterest)} c="text-emerald-400" />
          )}
          {report.maintenance > 0 && (
            <StatRow k="Chi phí bảo trì" v={'-' + formatMoney(report.maintenance)} c="text-amber-300" />
          )}
          {report.staffSalary > 0 && (
            <StatRow k="Lương đội ngũ quản lý" v={'-' + formatMoney(report.staffSalary)} c="text-amber-300" />
          )}
          {report.taxPaid > 0 && (
            <StatRow k="Thuế đất & kinh doanh" v={'-' + formatMoney(report.taxPaid)} c="text-amber-300" />
          )}
          {report.investorPaid > 0 && (
            <StatRow k="Chia nhà đầu tư (70%)" v={'-' + formatMoney(report.investorPaid)} c="text-amber-300" />
          )}
          {report.loanInterest > 0 && (
            <StatRow k="Lãi vay ngân hàng" v={'-' + formatMoney(report.loanInterest)} c="text-red-400" />
          )}
        </div>

        {/* Milestones completed while offline */}
        {(report.completedBuildings.length > 0 || report.newPlotsUnlocked > 0) && (
          <div className="space-y-1.5 rounded-2xl border border-border/80 bg-secondary/35 p-2.5 text-xs">
            {report.completedBuildings.length > 0 && (
              <div className="flex items-start gap-2 text-emerald-300">
                <Building2 size={14} className="mt-0.5 shrink-0" />
                <span>
                  <b>Hoàn thành xây dựng ({report.completedBuildings.length}):</b>{' '}
                  {report.completedBuildings.slice(0, 4).join(', ')}
                  {report.completedBuildings.length > 4
                    ? ` và ${report.completedBuildings.length - 4} công trình khác`
                    : ''}
                </span>
              </div>
            )}
            {report.newPlotsUnlocked > 0 && (
              <div className="flex items-center gap-2 text-sky-300">
                <MapPin size={14} className="shrink-0" />
                <span>
                  <b>Mở rộng bản đồ:</b> khai phá thêm <b>+{report.newPlotsUnlocked} lô đất</b> mới!
                </span>
              </div>
            )}
          </div>
        )}

        <div className="text-center text-[11px] text-muted-foreground">
          Hệ thống tự chạy thu nhập tối đa <b>{OFFLINE_MAX_HOURS} giờ</b> mỗi lần đóng web (30 ngày game/giờ).
        </div>

        <button className="btn-gold w-full py-2.5 text-sm font-black" onClick={onClose}>
          Nhận tiền & Tiếp tục chơi
        </button>
      </div>
    </ModalFrame>
  );
}
