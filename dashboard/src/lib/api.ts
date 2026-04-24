import { useAuthStore } from "@/store/auth.store";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

function getRefreshToken(): string | null {
  return useAuthStore.getState().refreshToken;
}

function setTokens(accessToken: string, refreshToken: string): void {
  useAuthStore.getState().setTokens(accessToken, refreshToken);
}

function clearTokens(): void {
  useAuthStore.getState().logout();
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      clearTokens();
      return null;
    }

    const data = await response.json();
    setTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    clearTokens();
    return null;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, headers: customHeaders, ...rest } = options;

  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(customHeaders as Record<string, string>),
  };

  const token = getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const serializedBody = isFormData
    ? (body as FormData)
    : body
      ? JSON.stringify(body)
      : undefined;

  let response = await fetch(`${BASE_URL}${endpoint}`, {
    ...rest,
    headers,
    body: serializedBody,
  });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      response = await fetch(`${BASE_URL}${endpoint}`, {
        ...rest,
        headers,
        body: serializedBody,
      });
    } else {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Authentication failed");
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const raw = errorData.detail ?? errorData.message ?? "Request failed";
    // FastAPI HTTPException(detail={...}) nests an object; coerce safely to string.
    const msg =
      typeof raw === "string"
        ? raw
        : typeof raw?.detail === "string"
          ? raw.detail
          : `HTTP ${response.status}`;
    throw new ApiError(response.status, msg, errorData);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "POST", body }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "PUT", body }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "PATCH", body }),

  delete: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "DELETE", body }),
};

export { BASE_URL, getAccessToken, setTokens, clearTokens };
