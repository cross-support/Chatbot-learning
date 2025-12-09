import { toastError } from '../hooks/useToast';

interface ApiError {
  statusCode: number;
  message: string;
  error: string;
}

interface ApiOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_RETRIES = 0;
const DEFAULT_RETRY_DELAY = 1000;

function getToken(): string | null {
  // まずzustandのストアからトークンを取得を試みる
  const authState = localStorage.getItem('crossbot-auth');
  if (authState) {
    try {
      const parsed = JSON.parse(authState);
      if (parsed?.state?.token) {
        return parsed.state.token;
      }
    } catch {
      // パース失敗時は無視
    }
  }
  // フォールバック：直接 'token' キーを確認
  return localStorage.getItem('token');
}

function getErrorMessage(status: number, apiError?: ApiError): string {
  if (apiError?.message) {
    return apiError.message;
  }

  switch (status) {
    case 400:
      return '入力内容に誤りがあります';
    case 401:
      return 'ログインが必要です';
    case 403:
      return 'この操作を行う権限がありません';
    case 404:
      return 'データが見つかりません';
    case 409:
      return 'データが競合しています';
    case 422:
      return '入力内容を確認してください';
    case 429:
      return 'リクエストが多すぎます。しばらくお待ちください';
    case 500:
      return 'サーバーエラーが発生しました';
    case 502:
    case 503:
    case 504:
      return 'サーバーに接続できません';
    default:
      return `エラーが発生しました (${status})`;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function apiRequest<T>(
  url: string,
  options: ApiOptions = {}
): Promise<T> {
  const {
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    ...fetchOptions
  } = options;

  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...fetchOptions.headers,
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let apiError: ApiError | undefined;
        try {
          apiError = await response.json();
        } catch {
          // レスポンスがJSONでない場合は無視
        }

        const errorMessage = getErrorMessage(response.status, apiError);

        // 401の場合はトークンを削除してログイン画面へ
        if (response.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }

        throw new Error(errorMessage);
      }

      // 204 No Content の場合は空オブジェクトを返す
      if (response.status === 204) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          lastError = new Error('リクエストがタイムアウトしました');
        } else if (error.message.includes('Failed to fetch')) {
          lastError = new Error('ネットワークに接続できません');
        } else {
          lastError = error;
        }
      } else {
        lastError = new Error('不明なエラーが発生しました');
      }

      // リトライ可能な場合は待機
      if (attempt < retries) {
        const delay = retryDelay * Math.pow(2, attempt); // 指数バックオフ
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

// 便利メソッド
export async function get<T>(url: string, options?: ApiOptions): Promise<T> {
  return apiRequest<T>(url, { ...options, method: 'GET' });
}

export async function post<T>(
  url: string,
  data?: unknown,
  options?: ApiOptions
): Promise<T> {
  return apiRequest<T>(url, {
    ...options,
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

export async function put<T>(
  url: string,
  data?: unknown,
  options?: ApiOptions
): Promise<T> {
  return apiRequest<T>(url, {
    ...options,
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
}

export async function patch<T>(
  url: string,
  data?: unknown,
  options?: ApiOptions
): Promise<T> {
  return apiRequest<T>(url, {
    ...options,
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
}

export async function del<T>(url: string, options?: ApiOptions): Promise<T> {
  return apiRequest<T>(url, { ...options, method: 'DELETE' });
}

// エラーハンドリング付きの呼び出し
export async function apiCall<T>(
  fn: () => Promise<T>,
  options: { showError?: boolean; errorMessage?: string } = {}
): Promise<T | null> {
  const { showError = true, errorMessage } = options;

  try {
    return await fn();
  } catch (error) {
    if (showError) {
      const message = errorMessage || (error instanceof Error ? error.message : 'エラーが発生しました');
      toastError(message);
    }
    return null;
  }
}

// FAQ API
export const faqApi = {
  getApprovedFaqs: () => get<any[]>('/api/faq'),
  getSuggestions: (status?: string, sortBy?: string) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (sortBy) params.append('sortBy', sortBy);
    return get<any[]>(`/api/faq/suggestions?${params}`);
  },
  searchSimilar: (query: string) => get<any[]>(`/api/faq/search?q=${encodeURIComponent(query)}`),
  createFaq: (data: { question: string; answer: string }) => post<any>('/api/faq', data),
  approveSuggestion: (id: string) => post<any>(`/api/faq/suggestions/${id}/approve`),
  rejectSuggestion: (id: string) => post<any>(`/api/faq/suggestions/${id}/reject`),
  updateFaq: (id: string, data: { question?: string; answer?: string }) => patch<any>(`/api/faq/${id}`, data),
  deleteFaq: (id: string) => del<any>(`/api/faq/${id}`),
  getStats: () => get<any>('/api/faq/stats'),
};

// Rich Message API
export const richMessageApi = {
  getAll: () => get<any[]>('/api/rich-messages'),
  getById: (id: string) => get<any>(`/api/rich-messages/${id}`),
  create: (data: any) => post<any>('/api/rich-messages', data),
  update: (id: string, data: any) => patch<any>(`/api/rich-messages/${id}`, data),
  delete: (id: string) => del<any>(`/api/rich-messages/${id}`),
};

// i18n API
export const i18nApi = {
  getByLocale: (locale: string) => get<any[]>(`/api/i18n/${locale}`),
  getByLocaleAndNamespace: (locale: string, namespace: string) =>
    get<any[]>(`/api/i18n/${locale}/${namespace}`),
  create: (data: { locale: string; namespace: string; key: string; value: string }) =>
    post<any>('/api/i18n', data),
  update: (id: string, data: { value: string }) => patch<any>(`/api/i18n/${id}`, data),
  delete: (id: string) => del<any>(`/api/i18n/${id}`),
  getAllTranslations: () => get<any[]>('/api/i18n'),
};
