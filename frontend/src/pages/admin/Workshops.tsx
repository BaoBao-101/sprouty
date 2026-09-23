import { useEffect, useState } from 'react';
import { API } from '@/services/api';

interface WorkshopRow {
  id: number;
  title: string;
  dateTime: string;
  location: string;
  capacity: number;
  registrations: number;
  pctFull: number;
  upcoming: boolean;
}

interface LocationRow {
  location: string;
  workshopCount: number;
  totalRegistrations: number;
}

interface Stats {
  workshops: WorkshopRow[];
  byLocation: LocationRow[];
  totals: { workshopCount?: number; totalCapacity?: number; totalRegistrations?: number };
}

/** Green under 60% full, amber to 90%, red above — a quick capacity read. */
function fillColor(pct: number) {
  if (pct >= 90) return 'var(--rose)';
  if (pct >= 60) return 'var(--orange)';
  return 'var(--green)';
}

export default function Workshops() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    API.admin.workshops
      .stats()
      .then((data: any) => !cancelled && setStats(data))
      .catch((err: any) => !cancelled && setError(err?.message || 'Không tải được số liệu.'));
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = stats?.totals;

  return (
    <>
      <div className="page-head" style={{ marginBottom: 22 }}>
        <h1>Workshop</h1>
        <p>Sức chứa và số lượt đăng ký theo từng buổi</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card" style={{ '--accent': 'var(--orange)' } as React.CSSProperties}>
          <div className="stat-num">{totals?.workshopCount ?? '—'}</div>
          <div className="stat-label">Tổng workshop</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--green)' } as React.CSSProperties}>
          <div className="stat-num">
            {totals ? (totals.totalCapacity || 0).toLocaleString('vi-VN') : '—'}
          </div>
          <div className="stat-label">Tổng sức chứa</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--amber)' } as React.CSSProperties}>
          <div className="stat-num">
            {totals ? (totals.totalRegistrations || 0).toLocaleString('vi-VN') : '—'}
          </div>
          <div className="stat-label">Tổng lượt đăng ký</div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Danh sách workshop</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Thời gian</th>
                <th>Địa điểm</th>
                <th style={{ textAlign: 'right' }}>Đăng ký</th>
              </tr>
            </thead>
            <tbody>
              {error && (
                <tr>
                  <td colSpan={4} className="admin-cell-error">
                    {error}
                  </td>
                </tr>
              )}
              {!error && !stats && (
                <tr>
                  <td colSpan={4} className="admin-cell-empty">
                    Đang tải...
                  </td>
                </tr>
              )}
              {stats?.workshops.length === 0 && (
                <tr>
                  <td colSpan={4} className="admin-cell-empty">
                    Chưa có workshop.
                  </td>
                </tr>
              )}

              {stats?.workshops.map((w) => (
                <tr key={w.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '.85rem' }}>{w.title}</div>
                    <div style={{ fontSize: '.7rem', color: 'var(--ink-4)' }}>
                      {w.upcoming ? 'Sắp tới' : 'Đã diễn ra'}
                    </div>
                  </td>
                  <td style={{ fontSize: '.78rem', color: 'var(--ink-3)' }}>
                    {new Date(w.dateTime).toLocaleString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="ws-location">{w.location}</td>
                  <td style={{ textAlign: 'right', minWidth: 160 }}>
                    <div style={{ fontFamily: 'var(--font-h)', fontWeight: 700 }}>
                      {w.registrations}/{w.capacity}
                    </div>
                    <div className="ws-bar">
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, w.pctFull)}%`,
                          background: fillColor(w.pctFull),
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Theo địa điểm</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Địa điểm</th>
                <th style={{ textAlign: 'right' }}>Số buổi</th>
                <th style={{ textAlign: 'right' }}>Lượt đăng ký</th>
              </tr>
            </thead>
            <tbody>
              {!error && !stats && (
                <tr>
                  <td colSpan={3} className="admin-cell-empty">
                    Đang tải...
                  </td>
                </tr>
              )}
              {stats?.byLocation.length === 0 && (
                <tr>
                  <td colSpan={3} className="admin-cell-empty">
                    Chưa có dữ liệu.
                  </td>
                </tr>
              )}
              {stats?.byLocation.map((row) => (
                <tr key={row.location}>
                  <td style={{ fontSize: '.82rem' }}>{row.location}</td>
                  <td className="admin-num">{row.workshopCount}</td>
                  <td className="admin-num" style={{ color: 'var(--orange)' }}>
                    {row.totalRegistrations}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
