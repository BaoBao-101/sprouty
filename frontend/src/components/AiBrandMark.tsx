/** The supplied Sprouty S mark, shared by both assistant surfaces. */
export function AiBrandMark({ size = 24 }: { size?: number }) {
  return <img src="/assets/images/sprouty-mark.png" alt="" aria-hidden="true" width={size} height={size} style={{ width: size, height: size, objectFit: 'contain', display: 'block', flexShrink: 0 }} />;
}
