import { useEffect, useRef, useState } from 'react';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import type { PlantDevice } from '@/types/plant';
import './IotDock.css';

/** What a sensor says about the plant, worked out by the page. */
export interface SensorRead {
  value: string;
  verdict: string;
  tone: 'good' | 'warn' | 'bad';
  note?: string;
}

/** The card has room for what a part does, not the whole explanation. */
function firstSentence(text: string) {
  const end = text.search(/[.!?](\s|$)/);
  return end < 0 ? text : text.slice(0, end + 1);
}

/**
 * The IoT parts on the picture of the plant: one slim bar along the bottom of
 * the 3D view, and a small card above it for whichever part is tapped.
 *
 * Readings, switching the pump or the lamp, wiring a new part in and taking
 * one out all happen here, on the plant. They used to be chips that only
 * scrolled the page down to the board.
 */
export function IotDock({
  devices,
  wired,
  busy,
  read,
  onToggle,
  onPlace,
  onPlaceAll,
  onRemove,
  onOpenBoard,
}: {
  devices: PlantDevice[];
  /** Types wired on the board. */
  wired: string[];
  busy: boolean;
  read: (device: PlantDevice) => SensorRead | null;
  onToggle: (type: string, next: boolean) => void | Promise<void>;
  onPlace: (type: string) => void;
  onPlaceAll: () => void;
  onRemove: (type: string) => void;
  onOpenBoard: (type?: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // A tap anywhere else, or Escape, puts the card away.
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key);
    };
  }, [open]);

  const on = devices.filter((d) => d.unlocked && wired.includes(d.type));
  const spare = devices.filter((d) => d.unlocked && !wired.includes(d.type));
  // Sensors with a number show it; the camera and the actuators are either working or not.
  const readers = on.filter((d) => d.kind === 'sensor' && d.type !== 'camera');
  const workers = on.filter((d) => d.kind === 'actuator' || d.type === 'camera');
  const current = open && open !== 'add' ? on.find((d) => d.type === open) ?? null : null;
  const toggle = (key: string) => setOpen((o) => (o === key ? null : key));
  const running = (d: PlantDevice) => d.type === 'camera' || d.autoMode;

  return (
    <div className="iotd" ref={root}>
      {open === 'add' && (
        <div className="iotd-pop" role="dialog" aria-label="Lắp linh kiện">
          <div className="iotd-pop-head">
            <span className="iotd-pop-icon">
              <SproutyIcon name="plus" size={20} />
            </span>
            <div>
              <strong>Lắp linh kiện</strong>
              <em>Cắm vào chậu, chỉ số hiện ngay trên cây</em>
            </div>
            <button type="button" className="iotd-close" aria-label="Đóng" onClick={() => setOpen(null)}>
              <SproutyIcon name="close" size={14} />
            </button>
          </div>
          {spare.length === 0 ? (
            <p className="iotd-note">Đã lắp hết linh kiện của chặng này.</p>
          ) : (
            <div className="iotd-spare">
              {spare.map((d) => (
                <button type="button" key={d.type} className={`iotd-spare-item is-${d.kind}`} onClick={() => onPlace(d.type)}>
                  <SproutyIcon name={d.icon} size={16} />
                  <span>{d.label}</span>
                  <SproutyIcon name="plus" size={14} />
                </button>
              ))}
            </div>
          )}
          {spare.length > 1 && (
            <button
              type="button"
              className="btn btn-primary btn-sm iotd-all"
              onClick={() => {
                onPlaceAll();
                setOpen(null);
              }}
            >
              Lắp tất cả
            </button>
          )}
        </div>
      )}

      {current && (
        <div className="iotd-pop" role="dialog" aria-label={current.label}>
          <div className="iotd-pop-head">
            <span className={`iotd-pop-icon is-${current.kind}`}>
              <SproutyIcon name={current.icon} size={20} />
            </span>
            <div>
              <strong>{current.label}</strong>
              <em>
                {current.kind === 'sensor' ? 'Cảm biến' : 'Thiết bị'} · Pin {Math.round(current.battery)}%
              </em>
            </div>
            <button type="button" className="iotd-close" aria-label="Đóng" onClick={() => setOpen(null)}>
              <SproutyIcon name="close" size={14} />
            </button>
          </div>

          {(() => {
            const r = current.kind === 'sensor' ? read(current) : null;
            return r ? (
              <>
                <div className={`iotd-read is-${r.tone}`}>
                  <b>{r.value}</b>
                  <span>{r.verdict}</span>
                </div>
                {r.note && <p className="iotd-note">{r.note}</p>}
              </>
            ) : null;
          })()}

          {current.kind === 'actuator' && (
            <>
              <p className="iotd-note">{firstSentence(current.about)}</p>
              <button
                type="button"
                role="switch"
                aria-checked={current.autoMode}
                className={`iotd-switch${current.autoMode ? ' is-on' : ''}`}
                disabled={busy}
                onClick={() => void onToggle(current.type, !current.autoMode)}
              >
                <span className="iotd-knob" aria-hidden="true" />
                {current.autoMode ? 'Đang bật — bấm để tắt' : 'Đang tắt — bấm để bật'}
              </button>
            </>
          )}

          <div className="iotd-pop-foot">
            <button
              type="button"
              className="iotd-link"
              disabled={busy}
              onClick={() => {
                setOpen(null);
                onRemove(current.type);
              }}
            >
              Gỡ khỏi chậu
            </button>
            <button
              type="button"
              className="iotd-link"
              onClick={() => {
                setOpen(null);
                onOpenBoard(current.type);
              }}
            >
              Xem bảng mạch
            </button>
          </div>
        </div>
      )}

      <div className="iotd-bar" role="toolbar" aria-label="Linh kiện IoT trên cây">
        {on.length === 0 ? (
          <button type="button" className="iotd-wide" aria-expanded={open === 'add'} onClick={() => toggle('add')}>
            <SproutyIcon name="plus" size={15} /> Lắp linh kiện IoT
          </button>
        ) : (
          <>
            {readers.map((d) => {
              const r = read(d);
              return (
                <button
                  type="button"
                  key={d.type}
                  className={`iotd-item is-${r?.tone ?? 'good'}${open === d.type ? ' is-open' : ''}`}
                  aria-expanded={open === d.type}
                  title={d.label}
                  onClick={() => toggle(d.type)}
                >
                  <SproutyIcon name={d.icon} size={15} />
                  <b>{r?.value ?? '…'}</b>
                </button>
              );
            })}
            {readers.length > 0 && workers.length > 0 && <span className="iotd-sep" aria-hidden="true" />}
            {workers.map((d) => (
              <button
                type="button"
                key={d.type}
                className={`iotd-item is-icon${running(d) ? ' is-on' : ''}${open === d.type ? ' is-open' : ''}`}
                aria-expanded={open === d.type}
                title={`${d.label}: ${running(d) ? 'đang bật' : 'đang tắt'}`}
                aria-label={`${d.label}: ${running(d) ? 'đang bật' : 'đang tắt'}`}
                onClick={() => toggle(d.type)}
              >
                <SproutyIcon name={d.icon} size={16} />
              </button>
            ))}
            {spare.length > 0 && (
              <button
                type="button"
                className={`iotd-item is-icon is-add${open === 'add' ? ' is-open' : ''}`}
                aria-expanded={open === 'add'}
                title="Lắp thêm linh kiện"
                aria-label="Lắp thêm linh kiện"
                onClick={() => toggle('add')}
              >
                <SproutyIcon name="plus" size={16} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
