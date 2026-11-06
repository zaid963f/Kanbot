import type { AuthResponse, LoginRequest, MeResponse, RegisterRequest } from '../types/api';
import { request } from './client';

export function register(body: RegisterRequest) {
  return request<AuthResponse>('POST', '/auth/register', body);
}

export function login(body: LoginRequest) {
  return request<AuthResponse>('POST', '/auth/login', body);
}

export function getMe() {
  return request<MeResponse>('GET', '/auth/me');
}
