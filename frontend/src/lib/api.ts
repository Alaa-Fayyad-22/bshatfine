export type NewsDto = {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
};

const API_URL = process.env.API_URL ?? "http://localhost:5246";

export async function getNews(page = 1, pageSize = 10): Promise<NewsDto[]> {
  const res = await fetch(`${API_URL}/api/news?page=${page}&pageSize=${pageSize}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to load news: ${res.status}`);
  }

  return res.json();
}