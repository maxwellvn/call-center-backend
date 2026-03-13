export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
  const perPage = Math.min(Math.max(Number(searchParams.get("perPage") ?? 20), 1), 100);
  const skip = (page - 1) * perPage;

  return { page, perPage, skip, take: perPage };
}
