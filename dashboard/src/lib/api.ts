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
    // Phase 7 P4a: backend now returns detail as {code, message, ...} for
    // budget / quota / plan-mode / approval errors. Prefer detail.message so
    // ApiError.message is user-facing, and stash detail.code on the error
    // instance so toast handlers can switch on it (e.g. render an upgrade CTA
    // for ai_budget_* codes).
    const isStructured =
      raw && typeof raw === "object" && (raw.code || raw.message);
    const msg = isStructured
      ? (typeof raw.message === "string" ? raw.message : `HTTP ${response.status}`)
      : typeof raw === "string"
        ? raw
        : typeof raw?.detail === "string"
          ? raw.detail
          : `HTTP ${response.status}`;
    const code = isStructured && typeof raw.code === "string" ? raw.code : null;
    throw new ApiError(response.status, msg, errorData, code);
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
    public data?: unknown,
    /**
     * Structured error code from the backend. Present for:
     * - ai_budget_limit_reached | ai_budget_would_exceed | ai_budget_deep_mode_cap
     * - plan_mode_not_available
     * - quota_exceeded
     * - content_not_approved | content_post_not_found
     * - video_generation_unavailable
     * Callers switch on this to render tailored UX (upgrade CTA, approval
     * prompt, coming-soon state) instead of a generic red toast.
     */
    public code: string | null = null
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Convenience: is this one of the ai_budget_* codes? */
  get isBudgetError(): boolean {
    return !!this.code && this.code.startsWith("ai_budget_");
  }

  /** Convenience: should the UI route the user to the upgrade page? */
  get suggestsUpgrade(): boolean {
    return (
      this.isBudgetError ||
      this.code === "plan_mode_not_available" ||
      this.code === "quota_exceeded"
    );
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
