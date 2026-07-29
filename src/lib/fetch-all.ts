// The Data API caps every response at 1,000 rows. Catalog and price-book reads
// routinely exceed that (a market holds ~4,700 prices, the master catalog
// ~10,000 items), so all such reads must page explicitly.
const PAGE = 1000;

export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}
