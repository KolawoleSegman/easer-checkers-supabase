import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const configured = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl;
export const API_BASE_URL = String(configured || 'https://easer-checker-backend.onrender.com').replace(/\/$/, '');
export const api = axios.create({ baseURL: API_BASE_URL, timeout: 15000, headers: { 'Content-Type': 'application/json' } });
api.interceptors.request.use(async config => {
  const token = await SecureStore.getItemAsync('easer.accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(r => r, async error => {
  if (error.response?.status === 401) await SecureStore.deleteItemAsync('easer.accessToken');
  return Promise.reject(error);
});
export function readableError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as any;
    if (Array.isArray(data?.message)) return data.message.join(', ');
    if (typeof data?.message === 'string') return data.message;
    if (!error.response) return 'Unable to reach the server. Check your internet connection.';
  }
  return 'Something went wrong. Please try again.';
}
