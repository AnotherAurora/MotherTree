/** Matches PostgREST max_rows in supabase/config.toml and export scripts. */
export const DEFAULT_PAGE_SIZE = 1000;

/** Safety cap for admin bulk list / FK option loads. */
export const ADMIN_BULK_MAX_ROWS = 5000;

const IN_CLAUSE_BATCH_SIZE = 500;

export type PaginateQueryResult<T> = {
  data: T[];
  truncated: boolean;
  error?: string;
};

export type PaginateQueryOptions = {
  pageSize?: number;
  maxRows?: number;
};

type PageResponse<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

/**
 * Fetch all rows via `.range(from, to)` pages. Each page request stays within
 * PostgREST max_rows (1000 by default).
 */
export async function paginateQuery<T>(
  buildPage: (from: number, to: number) => PromiseLike<PageResponse<T>>,
  options: PaginateQueryOptions = {},
): Promise<PaginateQueryResult<T>> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxRows = options.maxRows;
  const all: T[] = [];
  let from = 0;
  let truncated = false;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await buildPage(from, to);
    if (error) {
      return { data: all, truncated, error: error.message };
    }

    const page = data ?? [];
    all.push(...page);

    if (maxRows != null && all.length >= maxRows) {
      const hadMore = all.length > maxRows || page.length === pageSize;
      if (all.length > maxRows) {
        all.length = maxRows;
      }
      truncated = hadMore;
      break;
    }

    if (page.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return { data: all, truncated };
}

export function chunkArray<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error("chunk size must be at least 1");
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export const DEFAULT_IN_CLAUSE_BATCH_SIZE = IN_CLAUSE_BATCH_SIZE;
