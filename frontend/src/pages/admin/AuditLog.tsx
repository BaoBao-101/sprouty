import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  PageHeader,
  Pagination,
  Panel,
  Pill,
  SearchBox,
  TableStates,
  Toolbar,
  type LoadState,
} from '@/components/admin/ui';
import { API } from '@/services/api';

/**
 * Reader for the audit trail.
 *
 * Every sensitive action already wrote an `AuditLog` row — role changes,
 * password resets, code revocations, moderation calls — but nothing read them
 * back, so the trail answered no question anyone could ask. This is that reader.
 */

interface AuditEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: unknown;
  createdAt: string;
  actor?: { id: string; name: string; email: string; role: string } | null;
}

const PAGE_SIZE = 25;

/**
 * Actions are dotted namespaces ("user.password.reset"). The prefix says which
 * part of the system was touched, which is how staff think about them, so it
 * drives both the label and the colour.
 */
const DOMAIN_LABEL: Record<string, string> = {
  user: 'Người dùng',
  product: 'Sản phẩm',
  workshop: 'Workshop',
  instruction_video: 'Video',
  user_image: 'Ảnh khách',
  redeem_code: 'Mã kích hoạt',
  blog: 'Blog',
  order: 'Đơn hàng',
};

const DOMAIN_TONE: Record<string, string> = {
  user: 'blue',
  product: 'orange',
  workshop: 'green',
  instruction_video: 'amber',
  user_image: 'rose',
  redeem_code: 'orange',
  blog: 'green',
  order: 'blue',
};

/** Vietnamese for the actions the codebase actually writes. */
const ACTION_LABEL: Record<string, string> = {
  'user.create': 'Tạo tài khoản',
  'user.update': 'Sửa tài khoản',
  'user.password.change': 'Tự đổi mật khẩu',
  'user.password.reset': 'Đặt lại mật khẩu',
  'user.vip.grant': 'Cấp VIP',
  'user.vip.revoke': 'Thu hồi VIP',
  'workshop.create': 'Tạo workshop',
  'workshop.update': 'Sửa workshop',
  'workshop.delete': 'Xoá workshop',
  'workshop.registration.delete': 'Huỷ lượt đăng ký',
  'instruction_video.create': 'Thêm video',
  'instruction_video.archive': 'Lưu trữ video',
  'instruction_video.thumbnail': 'Đổi ảnh thu nhỏ video',
  'user_image.active': 'Hiện ảnh khách',
  'user_image.hidden': 'Ẩn ảnh khách',
  'user_image.deleted': 'Xoá ảnh khách',
};

function domainOf(action: string) {
  const head = action.split('.')[0];
  return { key: head, label: DOMAIN_LABEL[head] ?? head, tone: DOMAIN_TONE[head] ?? 'grey' };
}

function describe(action: string) {
  return ACTION_LABEL[action] ?? action;
}

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [actions, setActions] = useState<Array<{ action: string; count: number }>>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<AuditEntry | null>(null);

  const load = useCallback(() => {
    setState('loading');
    const params: Record<string, unknown> = { page, limit: PAGE_SIZE };
    if (filter) params.action = filter;

    API.admin.audit
      .list(params)
      .then((data: any) => {
        setLogs(data.logs || []);
        setPages(data.pages || 1);
        setTotal(data.total || 0);
        setState('ready');
      })
      .catch((err: any) => {
        setError(err?.message || 'Không tải được nhật ký.');
        setState('error');
      });
  }, [page, filter]);

  useEffect(load, [load]);

  useEffect(() => {
    API.admin.audit
      .actions()
      .then((data: any) => setActions(data.actions || []))
      .catch(() => setActions([]));
  }, []);

  // The domains present in the log, so the filter never offers an empty one.
  const domains = [...new Set(actions.map((a) => a.action.split('.')[0]))];

  // Actor search is client-side over the page in hand: the server filters by
  // actorUserId, and staff search by name, which they cannot map to an id.
  const visible = search.trim()
    ? logs.filter((log) => {
        const term = search.trim().toLowerCase();
        return (
          (log.actor?.name || '').toLowerCase().includes(term) ||
          (log.actor?.email || '').toLowerCase().includes(term) ||
          describe(log.action).toLowerCase().includes(term) ||
          log.action.toLowerCase().includes(term)
        );
      })
    : logs;

  return (
    <>
      <PageHeader
        title="Nhật ký hoạt động"
        subtitle="Ai đã làm gì trên hệ thống — chỉ ghi, không sửa hay xoá được"
        actions={
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={state === 'loading'}>
            ↻ Làm mới
          </button>
        }
      />

      <Toolbar>
        <div className="ad-pills">
          <button
            className={`ad-pill${filter === '' ? ' active' : ''}`}
            onClick={() => {
              setFilter('');
              setPage(1);
            }}
          >
            Tất cả
            <span className="ad-pill-count">{total}</span>
          </button>
          {domains.map((domain) => (
            <button
              key={domain}
              className={`ad-pill${filter === domain ? ' active' : ''}`}
              onClick={() => {
                setFilter(domain);
                setPage(1);
              }}
            >
              {DOMAIN_LABEL[domain] ?? domain}
            </button>
          ))}
        </div>
        <SearchBox
          value={search}
          placeholder="Lọc theo người thực hiện hoặc hành động…"
          onChange={setSearch}
        />
      </Toolbar>

      <Panel flush>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Thời điểm</th>
              <th>Người thực hiện</th>
              <th>Hành động</th>
              <th>Đối tượng</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <TableStates
              state={state}
              error={error}
              isEmpty={visible.length === 0}
              columns={5}
              emptyIcon="🗒"
              emptyTitle={search || filter ? 'Không có bản ghi khớp' : 'Chưa có hoạt động nào'}
              emptyHint={
                search || filter
                  ? 'Thử bỏ bộ lọc hoặc đổi từ khoá.'
                  : 'Các thao tác quan trọng sẽ được ghi lại ở đây.'
              }
              onRetry={load}
            />
            {state === 'ready' &&
              visible.map((log) => {
                const domain = domainOf(log.action);
                return (
                  <tr key={log.id} className="ad-row-click" onClick={() => setDetail(log)}>
                    <td className="ad-cell-sub" style={{ whiteSpace: 'nowrap' }}>
                      {new Date(log.createdAt).toLocaleString('vi-VN')}
                    </td>
                    <td>
                      {log.actor ? (
                        <>
                          <div className="ad-cell-main">{log.actor.name}</div>
                          <div className="ad-cell-sub">{log.actor.email}</div>
                        </>
                      ) : (
                        // The actor row can outlive the user it names.
                        <span className="ad-cell-sub">Tài khoản đã xoá</span>
                      )}
                    </td>
                    <td>
                      <div className="ad-cell-main">{describe(log.action)}</div>
                      <div className="ad-cell-sub">{log.action}</div>
                    </td>
                    <td>
                      <Pill tone={domain.tone}>{domain.label}</Pill>
                    </td>
                    <td className="ad-cell-sub">Chi tiết →</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </Panel>

      <Pagination
        page={page}
        pages={pages}
        total={total}
        unit="bản ghi"
        onChange={setPage}
      />

      {detail && (
        <Modal
          title={describe(detail.action)}
          subtitle={new Date(detail.createdAt).toLocaleString('vi-VN')}
          onClose={() => setDetail(null)}
          footer={
            <button className="btn btn-ghost" onClick={() => setDetail(null)}>
              Đóng
            </button>
          }
        >
          <div className="ord-detail-grid">
            <div>
              <div className="ad-cell-sub">Người thực hiện</div>
              <div className="ad-cell-main">{detail.actor?.name ?? 'Tài khoản đã xoá'}</div>
              <div className="ad-cell-sub">{detail.actor?.email}</div>
            </div>
            <div>
              <div className="ad-cell-sub">Mã hành động</div>
              <div className="ad-cell-main">{detail.action}</div>
            </div>
            <div>
              <div className="ad-cell-sub">Loại đối tượng</div>
              <div className="ad-cell-main">{detail.targetType}</div>
            </div>
            <div>
              <div className="ad-cell-sub">Mã đối tượng</div>
              <div className="ad-cell-main" style={{ wordBreak: 'break-all' }}>
                {detail.targetId}
              </div>
            </div>
          </div>

          <div className="panel-subhead">Dữ liệu kèm theo</div>
          {detail.metadata && Object.keys(detail.metadata as object).length > 0 ? (
            <pre className="audit-meta">{JSON.stringify(detail.metadata, null, 2)}</pre>
          ) : (
            <div className="panel-empty">Không có dữ liệu kèm theo.</div>
          )}
        </Modal>
      )}
    </>
  );
}
