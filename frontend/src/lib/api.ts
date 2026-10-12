export type NewsDto = {
  id: string;
  language: string;
  title: string;
  body: string;
  publishedAt: string;
};

const API_URL = process.env.API_URL ?? "http://localhost:5246";

export async function getNews(locale: string, page = 1, pageSize = 10): Promise<NewsDto[]> {
  const res = await fetch(`${API_URL}/api/news?lang=${locale}&page=${page}&pageSize=${pageSize}`, {
    cache: "no-store",
    // Fail fast if the API is down so the page never hangs on it.
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Failed to load news: ${res.status}`);
  }

  return res.json();
}

// Returns null when the article does not exist or is not published (404);
// any other failure throws so callers can show an "API down" state.
export async function getNewsById(locale: string, id: string): Promise<NewsDto | null> {
  const res = await fetch(`${API_URL}/api/news/${encodeURIComponent(id)}?lang=${locale}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to load news article: ${res.status}`);
  }

  return res.json();
}
