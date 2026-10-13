// Admin API client. Runs in the BROWSER (the admin forms mutate data from
// client components), so it reads NEXT_PUBLIC_API_URL: Next.js only exposes
// env vars with that prefix to browser code. Public pages keep using the
// server-only API_URL in ./api.ts.
export type NewsStatus = "Draft" | "Published" | "Archived";

export type TranslationDto = {
  language: "ar" | "en";
  title: string;
  body: string;
};

export type AdminNewsDto = {
  id: string;
  slug: string;
  status: NewsStatus;
  createdAt: string;
  updatedAt: string | null;
  publishedAt: string | null;
  translations: TranslationDto[];
};

export type AdminNewsPage = {
  items: AdminNewsDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5246";

// Thrown for non-2xx answers. `detail` is the Problem Details message from the
// API (business-rule violations are 400s with the reason in it), if any.
export class AdminApiError extends Error {
  constructor(
    public status: number,
    public detail: string | null,
  ) {
    super(detail ?? `Request failed: ${status}`);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/admin/news${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    let detail: string | null = null;
    try {
      const problem = await res.json();
      if (typeof problem?.detail === "string") detail = problem.detail;
    } catch {
      // Not JSON: fall back to the status code.
    }
    throw new AdminApiError(res.status, detail);
  }

  return res.json();
}

export function listAdminNews(page = 1, pageSize = 20): Promise<AdminNewsPage> {
  return request(`?page=${page}&pageSize=${pageSize}`);
}

// null when the article does not exist.
export async function getAdminNews(id: string): Promise<AdminNewsDto | null> {
  try {
    return await request<AdminNewsDto>(`/${encodeURIComponent(id)}`);
  } catch (e) {
    if (e instanceof AdminApiError && e.status === 404) return null;
    throw e;
  }
}

export function createNews(translations: TranslationDto[]): Promise<AdminNewsDto> {
  return request("", { method: "POST", body: JSON.stringify({ translations }) });
}

export function updateNews(id: string, translations: TranslationDto[]): Promise<AdminNewsDto> {
  return request(`/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ translations }),
  });
}

export function publishNews(id: string): Promise<AdminNewsDto> {
  return request(`/${encodeURIComponent(id)}/publish`, { method: "POST" });
}

export function archiveNews(id: string): Promise<AdminNewsDto> {
  return request(`/${encodeURIComponent(id)}/archive`, { method: "POST" });
}
