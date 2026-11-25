/** Pages to show: first, last, and a window of one around the current page. */
export function visiblePages(page: number, pageCount: number): number[] {
  const pages: number[] = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || (p >= page - 1 && p <= page + 1)) pages.push(p);
  }
  return pages;
}
