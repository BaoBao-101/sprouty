/**
 * The model answers in a light markdown. Render only the markup we allow:
 * everything is escaped first, then bold, bullets and line breaks are put
 * back, so a reply can never inject markup of its own.
 */
export function renderMarkup(text: string) {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\n)[*-] /g, '$1• ')
    .replace(/\n/g, '<br>');
}
