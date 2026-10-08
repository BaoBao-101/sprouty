/**
 * One reading of ?page= and ?limit= for every admin list.
 *
 * These endpoints each used to return the first 200 rows and stop. That is
 * fine until a shop has 201 products, at which point the 201st is unreachable
 * from the admin — there is no page 2 to go to, and no hint that anything is
 * missing. Four of them were written that way; the rest had already grown a
 * hand-rolled copy of this, with its own defaults.
 */

/** Hard ceiling, so a crafted ?limit=100000 cannot be used to pull the table. */
const MAX_LIMIT = 100;

export function readPaging(query, { defaultLimit = 20 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

/**
 * The envelope every paged list returns. `pages` is computed here rather than
 * in each caller so an empty result is 1 page everywhere, not 0 on some
 * screens and 1 on others.
 */
export function paged(rows, total, { page, limit }, key = 'items') {
  return {
    [key]: rows,
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * Turns a search box into a Prisma OR across the given fields.
 *
 * Returns undefined for an empty search so it can be spread into a `where`
 * without leaving an `OR: []` behind, which Prisma reads as "match nothing".
 */
export function searchOr(search, fields) {
  const text = String(search ?? '').trim();
  if (!text) return undefined;
  return fields.map((field) => ({ [field]: { contains: text, mode: 'insensitive' } }));
}
