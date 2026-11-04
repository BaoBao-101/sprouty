/**
 * The certificate of one picking: "Chứng nhận Nhà nông nhí". On the page as a
 * card, and as a picture to keep or send (downloadCertificate), drawn on a
 * canvas in the site's own fonts so it looks the same printed or shared.
 *
 * The stars say what they were for — the plant's average health, the days in
 * a row the child came back, and whether it got there without dying — so a
 * child with one star knows what to do better next time.
 */
import type { HarvestRecord } from '@/types/plant';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import './HarvestCertificate.css';

const dateVi = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Why it earned its stars, in the child's terms. */
export function starReasons(h: HarvestRecord): string[] {
  return [
    `Sức khoẻ trung bình ${h.avgHealth}%`,
    `${h.streak} ngày chăm liên tục`,
    h.attempt > 1 ? `Đã phải gieo lại ${h.attempt - 1} lần` : 'Chưa lần nào để cây héo khô',
  ];
}

/** What picking it was: "đợt 2/3", or nothing for a plant picked once. */
const pickingLabel = (h: HarvestRecord) => (h.of > 1 ? ` · đợt ${h.number}/${h.of}` : '');

export function Stars({ value, size = 22 }: { value: number; size?: number }) {
  return (
    <span className="hc-stars" aria-label={`${value} trên 3 sao`}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={n <= value ? 'on' : ''} style={{ fontSize: size }}>★</span>
      ))}
    </span>
  );
}

export function HarvestCertificate({ harvest }: { harvest: HarvestRecord }) {
  return (
    <article className="hc-card" aria-label={`Chứng nhận thu hoạch ${harvest.plantName}`}>
      <span className="hc-kicker"><SproutyIcon name="trophy" size={16} /> Chứng nhận Nhà nông nhí</span>
      <h3 className="hc-name">{harvest.plantName}</h3>
      <p className="hc-sub">{harvest.speciesLabel} · thu hoạch {harvest.harvestLabel}{pickingLabel(harvest)}{harvest.season > 1 ? ` · vụ ${harvest.season}` : ''}</p>
      <Stars value={harvest.stars} />
      <ul className="hc-stats">
        <li><b>{harvest.days}</b><span>ngày trồng</span></li>
        <li><b>{harvest.careCount}</b><span>lần chăm</span></li>
        <li><b>{harvest.streak}</b><span>ngày liền</span></li>
        <li><b>{harvest.avgHealth}%</b><span>sức khoẻ</span></li>
      </ul>
      <p className="hc-why">{starReasons(harvest).join(' · ')}</p>
      <p className="hc-date">Ngày {dateVi(harvest.createdAt)} · Sprouty</p>
    </article>
  );
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * .45 : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/** Draws the certificate at print size and saves it as a PNG. */
export async function downloadCertificate(h: HarvestRecord) {
  const W = 1200, H = 860;
  // The canvas only draws a web font once it has loaded.
  await Promise.all([
    document.fonts.load('700 60px "Baloo 2"'),
    document.fonts.load('600 26px "Be Vietnam Pro"'),
    document.fonts.load('400 24px "Be Vietnam Pro"'),
  ]).catch(() => undefined);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const display = '"Baloo 2", "Be Vietnam Pro", sans-serif', body = '"Be Vietnam Pro", sans-serif';

  ctx.fillStyle = '#F5F2EA'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.roundRect(40, 40, W - 80, H - 80, 36); ctx.fill();
  ctx.strokeStyle = '#2E8447'; ctx.lineWidth = 6; ctx.stroke();
  ctx.strokeStyle = '#DFF1D7'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(62, 62, W - 124, H - 124, 26); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#2E8447'; ctx.font = `600 26px ${body}`;
  ctx.fillText('CHỨNG NHẬN NHÀ NÔNG NHÍ', W / 2, 150);
  ctx.fillStyle = '#203424'; ctx.font = `700 76px ${display}`;
  ctx.fillText(h.plantName, W / 2, 250, W - 200);
  ctx.fillStyle = '#5E7662'; ctx.font = `400 28px ${body}`;
  ctx.fillText(`${h.speciesLabel} · thu hoạch ${h.harvestLabel}${pickingLabel(h)}${h.season > 1 ? ` · vụ ${h.season}` : ''}`, W / 2, 305, W - 200);

  for (let i = 0; i < 3; i++) {
    star(ctx, W / 2 + (i - 1) * 78, 385, 32);
    ctx.fillStyle = i < h.stars ? '#E9A21B' : '#E6E1D3'; ctx.fill();
  }

  const stats: Array<[string, string]> = [[String(h.days), 'ngày trồng'], [String(h.careCount), 'lần chăm'], [String(h.streak), 'ngày liền'], [`${h.avgHealth}%`, 'sức khoẻ']];
  stats.forEach(([value, label], i) => {
    const x = 170 + i * 220;
    ctx.fillStyle = '#ECF9E8';
    ctx.beginPath(); ctx.roundRect(x - 95, 455, 190, 130, 22); ctx.fill();
    ctx.fillStyle = '#236B3A'; ctx.font = `700 52px ${display}`; ctx.fillText(value, x, 525);
    ctx.fillStyle = '#5E7662'; ctx.font = `400 22px ${body}`; ctx.fillText(label, x, 563);
  });

  ctx.fillStyle = '#34513A'; ctx.font = `400 24px ${body}`;
  ctx.fillText(starReasons(h).join('  ·  '), W / 2, 650, W - 200);
  ctx.fillStyle = '#8CA591'; ctx.font = `400 22px ${body}`;
  ctx.fillText(`Ngày ${dateVi(h.createdAt)}  ·  sprouty.id.vn`, W / 2, 740);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const slug = h.plantName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  link.href = url; link.download = `chung-nhan-${slug}-dot-${h.number}.png`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
