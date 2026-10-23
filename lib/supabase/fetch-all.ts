/**
 * Reads every row a query matches, a page at a time.
 *
 * PostgREST hands back at most the project's row cap (1000 by default) per request and says
 * nothing when it stops early, so a query over a table that keeps growing (the points
 * ledger, orders, order lines, variants) quietly loses rows once it outgrows the cap. This
 * asks for successive ranges until one comes back empty, which also copes with a cap set
 * lower than the page size.
 *
 * `page` builds the query for one range. It must order by something unique (end with
 * .order('id')), or rows can repeat or go missing between pages. On an error the rows read
 * so far come back with it, and the caller has to treat them as incomplete.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000
): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = [];
  for (let from = 0; ; ) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) return { data: rows, error };
    if (!data || data.length === 0) return { data: rows, error: null };
    rows.push(...data);
    from += data.length;
  }
}
