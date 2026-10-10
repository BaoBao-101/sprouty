/** Uploaded URLs and bundled paths share one resolver across cards and galleries. */
export function resolveProductImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url) return null;
  if (/^(https?:\/\/|\/\/|blob:|data:image\/)/i.test(url)) return url;
  if (/^[a-z][a-z\d+.-]*:/i.test(url)) return null;
  return url.startsWith('/') ? url : `/${url.replace(/^(\.\/)+/, '')}`;
}
export function productGalleryImages(product: { images?: unknown }): string[] {
  if (!Array.isArray(product.images)) return [];
  return [...new Set(product.images.map(resolveProductImageUrl).filter((url): url is string => url !== null))];
}
export function productFallbackImage(product: { id: number }) {
  return `/assets/images/products/kit-${product.id}.svg`;
}
export function productImage(product: { id: number; images?: unknown }) {
  return productGalleryImages(product)[0] || productFallbackImage(product);
}
