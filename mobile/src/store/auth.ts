import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api } from '../api/client';
import type { AuthResponse, User } from '../types';

type AuthState = { user: User | null; token: string | null; ready: boolean; setSession: (data: AuthResponse) => Promise<void>; restore: () => Promise<void>; logout: () => Promise<void> };
export const useAuth = create<AuthState>((set) => ({
  user: null, token: null, ready: false,
  setSession: async data => { await SecureStore.setItemAsync('easer.accessToken', data.access_token); set({user:data.user, token:data.access_token, ready:true}); },
  restore: async () => {
    const token = await SecureStore.getItemAsync('easer.accessToken');
    if (!token) { set({ready:true}); return; }
    try { const r = await api.get('/profile'); set({token,user:r.data,ready:true}); }
    catch { await SecureStore.deleteItemAsync('easer.accessToken'); set({token:null,user:null,ready:true}); }
  },
  logout: async () => { await SecureStore.deleteItemAsync('easer.accessToken'); set({user:null,token:null,ready:true}); }
}));
