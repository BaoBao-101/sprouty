import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/**
 * The ticket, as something a phone camera can read.
 *
 * Six characters are easy enough to read out, but a parent holding a toddler
 * in one hand and a phone in the other should not have to, and staff should
 * not have to type what they heard. The code is the payload — not a URL — so
 * any scanner app on any phone produces exactly the string the lookup box
 * expects, with nothing to install on either side.
 *
 * Drawn as one SVG path rather than a canvas: it stays crisp at any size, it
 * prints, and it survives being rendered before fonts or images have loaded.
 */
export function TicketQr({ value, size = 132 }: { value: string; size?: number }) {
  const { path, cells } = useMemo(() => {
    // Type 0 lets the library pick the smallest version that fits; 'M' keeps
    // it readable with a thumb over a corner.
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();

    const count = qr.getModuleCount();
    let d = '';
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`;
      }
    }
    return { path: d, cells: count };
  }, [value]);

  // Four modules of quiet zone, which the spec requires and scanners rely on.
  const quiet = 4;
  const span = cells + quiet * 2;

  return (
    <svg
      className="ticket-qr"
      width={size}
      height={size}
      viewBox={`0 0 ${span} ${span}`}
      role="img"
      aria-label={`Mã QR vé ${value}`}
      shapeRendering="crispEdges"
    >
      <rect width={span} height={span} fill="#fff" />
      <g transform={`translate(${quiet} ${quiet})`}>
        <path d={path} fill="currentColor" />
      </g>
    </svg>
  );
}
