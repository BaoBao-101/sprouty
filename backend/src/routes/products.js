import { speciesCatalog, speciesFor } from '../services/plant-sim.js';

/**
 * Attaches the species a kit grows, resolved the same way the simulation
 * resolves it.
 *
 * The row carries only `speciesKey`, and `null` on anything that predates the
 * column. Letting the shop map keys to names itself would mean a second copy of
 * the catalogue that drifts the first time a species is added, so the label,
 * the icon and the colours are resolved here and travel with the product.
 */
function withSpecies(product) {
  if (product.category !== 'kit') return { ...product, species: null };
  const species = speciesFor(product);
  return {
    ...product,
    // Normalised, so a kit matched by its legacy name reports the key it
    // actually behaves as rather than the null in its column.
    speciesKey: species.key,
    species: {
      key: species.key,
      label: species.label,
      icon: species.icon,
      harvest: species.harvest,
      form: species.form,
      pollinate: species.pollinate,
    },
  };
}

export default async function productRoutes(fastify) {
  // GET /api/v1/products
  fastify.get('/products', async (req) => {
    const { category, search, badge, species } = req.query;
    const where = { status: 'published' };
    if (category) where.category = category;
    if (badge) where.badge = badge;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { collection: { contains: search, mode: 'insensitive' } },
      ];
    }

    const products = await fastify.prisma.product.findMany({
      where,
      orderBy: [{ badge: 'asc' }, { id: 'asc' }],
    });

    const withSpeciesRows = products.map(withSpecies);

    // Filtered after resolution, not in the query: a kit whose species comes
    // from the legacy name match has no `speciesKey` in the database, and a
    // WHERE clause would silently drop it from its own species' results.
    const filtered = species
      ? withSpeciesRows.filter((p) => p.species?.key === species)
      : withSpeciesRows;

    return { products: filtered };
  });

  // GET /api/v1/products/species — the species the shop can filter by, with
  // how many published kits each one has. Public, because the filter sidebar
  // needs it before anyone signs in.
  fastify.get('/products/species', async () => {
    const kits = await fastify.prisma.product.findMany({
      where: { status: 'published', category: 'kit' },
      select: { id: true, name: true, speciesKey: true, category: true },
    });

    const counts = new Map();
    for (const kit of kits) {
      const key = speciesFor(kit).key;
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const offered = speciesCatalog()
      .map((s) => ({ ...s, count: counts.get(s.key) || 0 }))
      // A species nobody sells is a filter that returns nothing, so it is not
      // offered. The admin picker still lists every species.
      .filter((s) => s.count > 0);

    // Kits whose species was never chosen resolve to the generic fallback,
    // which is not in the catalogue. Without an entry for them they would be
    // unreachable from this filter — present in "Tất cả" but in no species,
    // which reads as the shop losing products.
    const generic = counts.get('generic') || 0;
    if (generic > 0) {
      offered.push({
        key: 'generic',
        label: 'Cây thường',
        icon: 'sprout',
        harvest: 'trái',
        pollinate: true,
        form: 'bush',
        fruitShape: 'round',
        fruitColor: '#E8503A',
        flowerColor: '#FFC83D',
        blurb: 'Chưa chọn giống cụ thể.',
        stageLabels: [],
        count: generic,
      });
    }

    return { species: offered, total: kits.length };
  });

  // GET /api/v1/products/:id
  fastify.get('/products/:id', async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return reply.code(400).send({ message: 'ID không hợp lệ.' });

    const product = await fastify.prisma.product.findFirst({
      where: { id, status: 'published' },
    });

    if (!product) return reply.code(404).send({ message: 'Không tìm thấy sản phẩm.' });
    return { product: withSpecies(product) };
  });
}
