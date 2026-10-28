/** Live Vietnam time, matching the garden's default timezone and daylight curve. */
export function plantClock(now: number) {
  const local = new Date(now + 7 * 60 * 60 * 1000);
  const hours = local.getUTCHours();
  const minutes = local.getUTCMinutes();
  const hour = hours + minutes / 60;
  return {
    clock: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    isDay: Math.max(0, Math.sin(((hour - 6) / 12.5) * Math.PI)) > 0.08,
  };
}
