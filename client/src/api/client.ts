// One place that talks to the backend. Every api/*.ts file uses request().
import { getLanguage, translate } from '../i18n';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export class ApiError extends Error {
  status: number;
  details: { path: string; message: string }[];

  constructor(status: number, message: string, details: { path: string; message: string }[] = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// ---- token ----

export function getToken() {
  return localStorage.getItem('token');
}

export function saveToken(token: string) {
  localStorage.setItem('token', token);
}

export function removeToken() {
  localStorage.removeItem('token');
}

// ---- what to do when the server says 401 (set by AuthProvider) ----

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

// ---- request ----

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept-Language': getLanguage() };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(API_URL + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, translate('common.cannotReach'));
  }

  // 204 = No Content (e.g. after DELETE)
  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login' && unauthorizedHandler) {
      unauthorizedHandler();
    }
    const message = data?.error?.message ?? translate('common.somethingWrong');
    throw new ApiError(response.status, message, data?.error?.details ?? []);
  }

  return data as T;
}

// ---- helpers for showing errors ----

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : translate('common.somethingWrong');
}

// Turns the server's details[] into { fieldName: message } for forms.
export function getFieldErrors(error: unknown) {
  const errors: Record<string, string> = {};
  if (error instanceof ApiError) {
    for (const detail of error.details) {
      errors[detail.path] = detail.message;
    }
  }
  return errors;
}
