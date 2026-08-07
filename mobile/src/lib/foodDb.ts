/**
 * Open Food Facts client — a free, no-key food & barcode database.
 * Called directly from the app (public API, generous limits; they only ask for
 * a descriptive User-Agent).
 */

const UA = 'Gainz/1.0 (fitness app)';
const FIELDS = 'code,product_name,brands,nutriments,serving_size';

export interface FoodDbItem {
  code: string;
  name: string;
  brand?: string;
  serving: string; // human label for one serving
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: Record<string, number | undefined>;
}

/** Map an Open Food Facts product to our normalized item, or null if unusable. */
function mapProduct(p: OffProduct): FoodDbItem | null {
  const name = p.product_name?.trim();
  if (!name || !p.code) return null;
  const n = p.nutriments ?? {};

  // Prefer per-serving values; fall back to per-100g.
  const hasServing = n['energy-kcal_serving'] != null;
  const cal = hasServing ? n['energy-kcal_serving'] : n['energy-kcal_100g'];
  if (cal == null) return null; // no calorie data → not useful

  const pick = (base: string) =>
    hasServing ? num(n[`${base}_serving`]) : num(n[`${base}_100g`]);

  return {
    code: p.code,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    serving: hasServing ? p.serving_size || '1 serving' : '100 g',
    calories: Math.round(num(cal)),
    protein_g: round1(pick('proteins')),
    carbs_g: round1(pick('carbohydrates')),
    fat_g: round1(pick('fat')),
  };
}

/** Full-text search for foods. */
export async function searchFoods(query: string, signal?: AbortSignal): Promise<FoodDbItem[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}` +
    `&search_simple=1&action=process&json=1&page_size=30&fields=${FIELDS}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal });
  if (!res.ok) throw new Error('Search failed. Please try again.');
  const data = (await res.json()) as { products?: OffProduct[] };
  return (data.products ?? []).map(mapProduct).filter((x): x is FoodDbItem => x !== null);
}

/** Look up a single product by barcode. Returns null if not found. */
export async function lookupBarcode(code: string): Promise<FoodDbItem | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const data = (await res.json()) as { status?: number; product?: OffProduct };
  if (data.status !== 1 || !data.product) return null;
  return mapProduct(data.product);
}
