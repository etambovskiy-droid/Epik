/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import {
  auth,
  db,
  onAuthStateChanged,
  signInWithGooglePopup,
  syncFirebaseUserProfile,
  signOutFirebase,
  handleFirestoreError,
  sendPasswordResetEmail,
  OperationType
} from '../firebase';

export interface MerchantStore {
  id: string;
  name: string;
  sellerCode: string;
  createdAt: string;
  isVerified: boolean;
  subscriptionTier?: 'free' | 'pro' | 'enterprise';
}

export const SUPER_ADMIN_EMAIL = 'e.tambovskiy@gmail.com';

export type UserApprovalStatus = 'approved' | 'pending_approval' | 'rejected';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  shopName: string;
  sellerCode: string;
  phone?: string;
  role: 'seller' | 'admin' | 'manager';
  status: UserApprovalStatus;
  approvalToken?: string;
  approvedAt?: string;
  rejectedAt?: string;
  adminNotes?: string;
  avatarUrl?: string;
  createdAt: string;
  isFirebaseUser?: boolean;
  isDemo?: boolean;
  stores: MerchantStore[];
  activeStoreId: string;
}

export const AUTH_USER_STORAGE_KEY = 'epicentr_auth_user';
export const REGISTERED_USERS_STORAGE_KEY = 'epicentr_registered_users';
export const EXPLICIT_LOGOUT_STORAGE_KEY = 'epicentr_explicit_logout';

export const DEFAULT_DEMO_STORES: MerchantStore[] = [
  {
    id: 'shop-electronics',
    name: 'Епіцентр Постач Трейд',
    sellerCode: 'EP-89214',
    createdAt: '2026-01-15T10:00:00Z',
    isVerified: true,
    subscriptionTier: 'pro'
  },
  {
    id: 'shop-furniture',
    name: 'Меблевий салон «ComfortHome»',
    sellerCode: 'EP-44210',
    createdAt: '2026-02-01T10:00:00Z',
    isVerified: true,
    subscriptionTier: 'pro'
  },
  {
    id: 'shop-lighting',
    name: 'Студія світла «Lumina»',
    sellerCode: 'EP-99301',
    createdAt: '2026-02-12T10:00:00Z',
    isVerified: true,
    subscriptionTier: 'free'
  }
];

export const SUPER_ADMIN_USER: UserProfile = {
  id: 'usr_super_admin_tambovskiy',
  email: SUPER_ADMIN_EMAIL,
  name: 'Евгеній Тамбовський',
  shopName: 'Головний Адміністратор Епіцентр PIM',
  sellerCode: 'EP-ADMIN-01',
  phone: '+380 (50) 000-00-00',
  role: 'admin',
  status: 'approved',
  createdAt: '2026-01-01T00:00:00Z',
  stores: DEFAULT_DEMO_STORES,
  activeStoreId: 'shop-electronics'
};

export const DEFAULT_DEMO_USER: UserProfile = {
  id: 'usr_seller_demo_01',
  email: 'seller@epicentr.ua',
  name: 'Олександр Мельник (Демо-доступ)',
  shopName: 'Епіцентр Демо-Маркет (Sandbox)',
  sellerCode: 'EP-DEMO',
  phone: '+380 (67) 123-45-67',
  role: 'seller',
  status: 'approved',
  isDemo: true,
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?autoformat&fit=crop&w=200&q=80',
  createdAt: '2026-01-15T10:00:00Z',
  stores: DEFAULT_DEMO_STORES,
  activeStoreId: 'shop-electronics'
};

const DEFAULT_DEMO_PASSWORD = 'epicentr2026';
const SUPER_ADMIN_PASSWORD = 'adminTambovskiy2026!';

interface StoredAccount {
  user: UserProfile;
  passwordHash: string;
}

function generateSellerCode(): string {
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  return `EP-${randomSuffix}`;
}

export function normalizeUserProfile(raw: Partial<UserProfile> | null | undefined): UserProfile {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_DEMO_USER, stores: [...DEFAULT_DEMO_STORES] };
  }

  const rawEmail = (raw.email || '').trim().toLowerCase();
  const isSuperAdmin = rawEmail === SUPER_ADMIN_EMAIL.toLowerCase();

  const fallbackShopName = (raw.shopName || '').trim() || (isSuperAdmin ? SUPER_ADMIN_USER.shopName : DEFAULT_DEMO_USER.shopName);
  const fallbackSellerCode = (raw.sellerCode || '').trim() || (isSuperAdmin ? 'EP-ADMIN-01' : generateSellerCode());
  const createdAt = raw.createdAt || new Date().toISOString();

  let stores: MerchantStore[] = Array.isArray(raw.stores)
    ? raw.stores.filter(s => s && typeof s === 'object' && s.id && s.name)
    : [];

  if (stores.length === 0) {
    if (isSuperAdmin) {
      stores = [...DEFAULT_DEMO_STORES];
    } else if (raw.id === DEFAULT_DEMO_USER.id || rawEmail === DEFAULT_DEMO_USER.email) {
      stores = [...DEFAULT_DEMO_STORES];
    } else {
      stores = [
        {
          id: `store_${raw.id || 'default'}_1`,
          name: fallbackShopName,
          sellerCode: fallbackSellerCode.startsWith('EP-') ? fallbackSellerCode : `EP-${fallbackSellerCode.replace(/\D/g, '').slice(-5) || '10820'}`,
          createdAt,
          isVerified: true,
          subscriptionTier: 'pro'
        }
      ];
    }
  }

  const activeStore =
    stores.find(s => s.id === raw.activeStoreId) ||
    stores.find(s => s.name === raw.shopName) ||
    stores[0];

  // Role and approval status resolution
  const resolvedRole = isSuperAdmin ? 'admin' : (raw.role || 'seller');
  const resolvedStatus: UserApprovalStatus = isSuperAdmin
    ? 'approved'
    : (rawEmail === DEFAULT_DEMO_USER.email.toLowerCase() ? 'approved' : (raw.status || 'pending_approval'));

  const isDemo = Boolean(
    raw.isDemo ||
    rawEmail === DEFAULT_DEMO_USER.email.toLowerCase() ||
    raw.id === DEFAULT_DEMO_USER.id ||
    raw.sellerCode === 'EP-DEMO'
  );

  return {
    id: raw.id || `usr_${Date.now()}`,
    email: raw.email || (isSuperAdmin ? SUPER_ADMIN_EMAIL : DEFAULT_DEMO_USER.email),
    name: raw.name || (isSuperAdmin ? SUPER_ADMIN_USER.name : DEFAULT_DEMO_USER.name),
    shopName: activeStore.name,
    sellerCode: activeStore.sellerCode,
    phone: raw.phone,
    role: resolvedRole,
    status: resolvedStatus,
    approvalToken: raw.approvalToken,
    approvedAt: raw.approvedAt,
    rejectedAt: raw.rejectedAt,
    adminNotes: raw.adminNotes,
    avatarUrl: raw.avatarUrl,
    createdAt,
    isFirebaseUser: Boolean(raw.isFirebaseUser),
    isDemo,
    stores,
    activeStoreId: activeStore.id
  };
}

export class AuthService {
  private static instance: AuthService;
  private currentUser: UserProfile | null = null;
  private listeners: Array<(user: UserProfile | null) => void> = [];

  private constructor() {
    this.initStorage();
    this.initFirebaseAuthListener();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private initStorage(): void {
    try {
      const existingAccountsStr = localStorage.getItem(REGISTERED_USERS_STORAGE_KEY);
      let accounts: Record<string, StoredAccount> = {};
      if (existingAccountsStr) {
        try {
          accounts = JSON.parse(existingAccountsStr);
        } catch {
          accounts = {};
        }
      }

      // Ensure Super Admin account is pre-seeded
      if (!accounts[SUPER_ADMIN_EMAIL.toLowerCase()]) {
        accounts[SUPER_ADMIN_EMAIL.toLowerCase()] = {
          user: SUPER_ADMIN_USER,
          passwordHash: SUPER_ADMIN_PASSWORD
        };
      } else {
        // Ensure role & status are always admin & approved
        accounts[SUPER_ADMIN_EMAIL.toLowerCase()].user = {
          ...accounts[SUPER_ADMIN_EMAIL.toLowerCase()].user,
          role: 'admin',
          status: 'approved'
        };
      }

      // Ensure Default Demo Seller is available
      if (!accounts[DEFAULT_DEMO_USER.email.toLowerCase()]) {
        accounts[DEFAULT_DEMO_USER.email.toLowerCase()] = {
          user: DEFAULT_DEMO_USER,
          passwordHash: DEFAULT_DEMO_PASSWORD
        };
      }

      localStorage.setItem(REGISTERED_USERS_STORAGE_KEY, JSON.stringify(accounts));

      const savedUserStr = localStorage.getItem(AUTH_USER_STORAGE_KEY);
      if (savedUserStr) {
        const parsed = JSON.parse(savedUserStr);
        const normalized = normalizeUserProfile(parsed);
        this.currentUser = normalized;
        localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(normalized));
        localStorage.removeItem(EXPLICIT_LOGOUT_STORAGE_KEY);
      } else {
        const explicitLogout = localStorage.getItem(EXPLICIT_LOGOUT_STORAGE_KEY) === 'true';
        if (explicitLogout) {
          this.currentUser = null;
        } else {
          // If no user is logged in, start with null so Auth Guard asks for authentication
          this.currentUser = null;
        }
      }
    } catch (e) {
      console.warn('Failed to initialize auth storage:', e);
      this.currentUser = null;
    }
  }

  private initFirebaseAuthListener(): void {
    try {
      onAuthStateChanged(auth, async (fbUser) => {
        // Never clear currentUser when fbUser is null: local session in localStorage must stay active
        // unless the user explicitly clicked "Вийти" (logout).
        if (fbUser) {
          try {
            const synced = await syncFirebaseUserProfile(fbUser);
            const existingStores = this.currentUser?.stores;
            const existingActiveStoreId = this.currentUser?.activeStoreId;
            const profile = normalizeUserProfile({
              ...synced,
              stores: existingStores && existingStores.length > 0 ? existingStores : undefined,
              activeStoreId: existingActiveStoreId,
              isFirebaseUser: true
            });
            this.currentUser = profile;
            localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(profile));
            localStorage.removeItem(EXPLICIT_LOGOUT_STORAGE_KEY);
            this.notify();
          } catch (err) {
            console.warn('Error syncing Firebase user profile:', err);
          }
        }
      });
    } catch (err) {
      console.warn('Firebase Auth listener initialization notice:', err);
    }
  }

  public subscribe(listener: (user: UserProfile | null) => void): () => void {
    this.listeners.push(listener);
    listener(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentUser);
      } catch (e) {
        console.warn('Auth listener error:', e);
      }
    });
  }

  public getCurrentUser(): UserProfile | null {
    if (!this.currentUser) {
      try {
        const savedUserStr = localStorage.getItem(AUTH_USER_STORAGE_KEY);
        if (savedUserStr) {
          this.currentUser = normalizeUserProfile(JSON.parse(savedUserStr));
        }
      } catch {
        // Ignore parse error
      }
    }
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  public getActiveStore(): MerchantStore | null {
    const user = this.getCurrentUser();
    if (!user || !Array.isArray(user.stores) || user.stores.length === 0) {
      return DEFAULT_DEMO_STORES[0];
    }
    return user.stores.find(s => s.id === user.activeStoreId) || user.stores[0];
  }

  public getActiveStoreId(): string {
    return this.getActiveStore()?.id || 'shop-electronics';
  }

  public setActiveStore(storeId: string): MerchantStore | null {
    const user = this.getCurrentUser();
    if (!user) return null;

    const targetStore = user.stores.find(s => s.id === storeId);
    if (!targetStore) return null;

    const updatedUser: UserProfile = {
      ...user,
      activeStoreId: targetStore.id,
      shopName: targetStore.name,
      sellerCode: targetStore.sellerCode
    };

    this.persistUser(updatedUser);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('epicentr_active_store_changed', {
          detail: { storeId: targetStore.id, store: targetStore }
        })
      );
    }
    return targetStore;
  }

  public addStore(
    storeName: string,
    customSellerCode?: string,
    subscriptionTier: 'free' | 'pro' | 'enterprise' = 'pro'
  ): MerchantStore {
    const cleanName = (storeName || '').trim();
    if (!cleanName) {
      throw new Error('Вкажіть назву нового магазину');
    }

    const user = this.getCurrentUser() || normalizeUserProfile(DEFAULT_DEMO_USER);
    const code = (customSellerCode || '').trim() || generateSellerCode();
    const newStore: MerchantStore = {
      id: `store_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      sellerCode: code.startsWith('EP-') ? code : `EP-${code}`,
      createdAt: new Date().toISOString(),
      isVerified: true,
      subscriptionTier
    };

    const updatedStores = [...(user.stores || []), newStore];
    const updatedUser: UserProfile = {
      ...user,
      stores: updatedStores,
      activeStoreId: newStore.id,
      shopName: newStore.name,
      sellerCode: newStore.sellerCode
    };

    this.persistUser(updatedUser);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('epicentr_active_store_changed', {
          detail: { storeId: newStore.id, store: newStore }
        })
      );
    }
    return newStore;
  }

  private persistUser(user: UserProfile): void {
    const normalized = normalizeUserProfile(user);
    this.currentUser = normalized;
    try {
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(normalized));
      localStorage.removeItem(EXPLICIT_LOGOUT_STORAGE_KEY);

      const accounts = this.getAccounts();
      const emailKey = normalized.email.toLowerCase();
      if (accounts[emailKey]) {
        accounts[emailKey].user = normalized;
        this.saveAccounts(accounts);
      }
    } catch (e) {
      console.warn('Failed to persist user profile:', e);
    }
    this.notify();
  }

  private getAccounts(): Record<string, StoredAccount> {
    try {
      const data = localStorage.getItem(REGISTERED_USERS_STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  private saveAccounts(accounts: Record<string, StoredAccount>): void {
    try {
      localStorage.setItem(REGISTERED_USERS_STORAGE_KEY, JSON.stringify(accounts));
    } catch (e) {
      console.warn('Failed to save accounts:', e);
    }
  }

  /**
   * Sign in with Google via Firebase Auth (signInWithPopup)
   */
  public async loginWithGoogle(): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    try {
      const profile = await signInWithGooglePopup();
      if (!profile) {
        return { success: false, error: 'Не отримано профіль користувача від Google' };
      }
      const userWithFlag = normalizeUserProfile({
        ...profile,
        isFirebaseUser: true
      });
      this.persistUser(userWithFlag);
      return { success: true, user: userWithFlag };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Не вдалося увійти через Google'
      };
    }
  }

  /**
   * Check if user is Super Administrator
   */
  public isSuperAdmin(user?: UserProfile | null): boolean {
    const target = user || this.getCurrentUser();
    if (!target) return false;
    return (target.email || '').trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  }

  /**
   * Check if user is approved to access full PIM platform
   */
  public isApproved(user?: UserProfile | null): boolean {
    const target = user || this.getCurrentUser();
    if (!target) return false;
    if (this.isSuperAdmin(target)) return true;
    return target.status === 'approved';
  }

  /**
   * Check if user is pending admin approval
   */
  public isPending(user?: UserProfile | null): boolean {
    const target = user || this.getCurrentUser();
    if (!target) return false;
    return target.status === 'pending_approval';
  }

  /**
   * Check if user was rejected
   */
  public isRejected(user?: UserProfile | null): boolean {
    const target = user || this.getCurrentUser();
    if (!target) return false;
    return target.status === 'rejected';
  }

  /**
   * 1-Click Super Admin Login (for project owner e.tambovskiy@gmail.com)
   */
  public async loginAsSuperAdmin(): Promise<{ success: boolean; user: UserProfile }> {
    const adminUser = normalizeUserProfile(SUPER_ADMIN_USER);
    this.persistUser(adminUser);
    return { success: true, user: adminUser };
  }

  /**
   * Get all registered users (for Admin Dashboard)
   */
  public getAllUsers(): UserProfile[] {
    const accounts = this.getAccounts();
    return Object.values(accounts).map(acc => normalizeUserProfile(acc.user));
  }

  /**
   * Get pending approval users
   */
  public getPendingUsers(): UserProfile[] {
    return this.getAllUsers().filter(u => u.status === 'pending_approval');
  }

  /**
   * Admin approves a user (by email or approval token)
   */
  public async approveUser(emailOrToken: string): Promise<{ success: boolean; message: string; user?: UserProfile }> {
    const cleanKey = (emailOrToken || '').trim().toLowerCase();
    const accounts = this.getAccounts();

    let targetEmail: string | null = null;
    if (accounts[cleanKey]) {
      targetEmail = cleanKey;
    } else {
      for (const [em, acc] of Object.entries(accounts)) {
        if (acc.user.approvalToken === emailOrToken || acc.user.id === emailOrToken) {
          targetEmail = em;
          break;
        }
      }
    }

    if (!targetEmail || !accounts[targetEmail]) {
      return { success: false, message: 'Користувача з таким ідентифікатором або токеном не знайдено' };
    }

    const updatedUser: UserProfile = {
      ...accounts[targetEmail].user,
      status: 'approved',
      approvedAt: new Date().toISOString()
    };

    accounts[targetEmail].user = updatedUser;
    this.saveAccounts(accounts);

    // If current logged-in user is the one approved, refresh session
    if (this.currentUser && this.currentUser.email.toLowerCase() === targetEmail.toLowerCase()) {
      this.persistUser(updatedUser);
    }

    // Sync with backend API
    try {
      await fetch('/api/admin/approve-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': SUPER_ADMIN_EMAIL
        },
        body: JSON.stringify({ email: targetEmail, adminEmail: SUPER_ADMIN_EMAIL })
      });
    } catch {
      // continue
    }

    return {
      success: true,
      message: `Користувача ${updatedUser.name} (${updatedUser.shopName}) успішно схвалено. Доступ відкрито!`,
      user: updatedUser
    };
  }

  /**
   * Admin rejects a user
   */
  public async rejectUser(email: string, reason?: string): Promise<{ success: boolean; message: string; user?: UserProfile }> {
    const cleanEmail = (email || '').trim().toLowerCase();
    const accounts = this.getAccounts();

    if (!accounts[cleanEmail]) {
      return { success: false, message: 'Користувача не знайдено' };
    }

    const updatedUser: UserProfile = {
      ...accounts[cleanEmail].user,
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      adminNotes: reason || 'Заявку відхилено адміністратором'
    };

    accounts[cleanEmail].user = updatedUser;
    this.saveAccounts(accounts);

    if (this.currentUser && this.currentUser.email.toLowerCase() === cleanEmail) {
      this.persistUser(updatedUser);
    }

    try {
      await fetch('/api/admin/reject-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': SUPER_ADMIN_EMAIL
        },
        body: JSON.stringify({ email: cleanEmail, reason, adminEmail: SUPER_ADMIN_EMAIL })
      });
    } catch {
      // continue
    }

    return {
      success: true,
      message: `Заявку користувача ${updatedUser.name} відхилено.`,
      user: updatedUser
    };
  }

  /**
   * Log in user with email and password
   */
  public async login(
    email: string,
    password: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string; status?: UserApprovalStatus }> {
    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanPassword = (password || '').trim();

      if (!cleanEmail || !cleanPassword) {
        return { success: false, error: 'Введіть коректні email та пароль' };
      }

      const accounts = this.getAccounts();
      let matchedAccount: StoredAccount | undefined;
      for (const [em, acc] of Object.entries(accounts)) {
        if (em.toLowerCase() === cleanEmail) {
          matchedAccount = acc;
          break;
        }
      }

      const isSuperAdmin = cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase();

      if (matchedAccount) {
        const isPasswordMatch =
          matchedAccount.passwordHash === cleanPassword ||
          (isSuperAdmin && cleanPassword === SUPER_ADMIN_PASSWORD);

        if (!isPasswordMatch) {
          return { success: false, error: 'Невірний пароль. Спробуйте ще раз або відновіть доступ' };
        }
        const normalized = normalizeUserProfile(matchedAccount.user);
        this.persistUser(normalized);
        return { success: true, user: normalized, status: normalized.status };
      }

      // Fallback for default hardcoded accounts if not yet customized in accounts storage
      if (isSuperAdmin && cleanPassword === SUPER_ADMIN_PASSWORD) {
        const adminUser = normalizeUserProfile(SUPER_ADMIN_USER);
        this.persistUser(adminUser);
        return { success: true, user: adminUser, status: 'approved' };
      }

      if (cleanEmail === DEFAULT_DEMO_USER.email.toLowerCase() && cleanPassword === DEFAULT_DEMO_PASSWORD) {
        const demoUser = normalizeUserProfile(DEFAULT_DEMO_USER);
        this.persistUser(demoUser);
        return { success: true, user: demoUser, status: 'approved' };
      }

      return { success: false, error: 'Користувача з такою електронною поштою не знайдено' };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Помилка входу до системи'
      };
    }
  }

  /**
   * 1-Click Demo Login
   */
  public async loginAsDemo(): Promise<{ success: boolean; user: UserProfile }> {
    const demoUser = normalizeUserProfile(DEFAULT_DEMO_USER);
    this.persistUser(demoUser);
    return { success: true, user: demoUser };
  }

  /**
   * Register new seller account with mandatory store name & admin approval flow
   */
  public async register(
    name: string,
    email: string,
    password: string,
    shopName: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string; status?: UserApprovalStatus }> {
    try {
      const cleanName = (name || '').trim();
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanPassword = (password || '').trim();
      const cleanShop = (shopName || '').trim();

      if (!cleanName) return { success: false, error: "Вкажіть ваше ім'я та прізвище" };
      if (!cleanShop) return { success: false, error: 'Вкажіть назву вашого магазину або компанії (обовʼязкове поле)' };
      if (!cleanEmail || !cleanEmail.includes('@')) return { success: false, error: 'Вкажіть коректний email' };
      if (cleanPassword.length < 6) return { success: false, error: 'Пароль має містити не менше 6 символів' };

      const accounts = this.getAccounts();
      if (accounts[cleanEmail]) {
        return { success: false, error: 'Користувач з таким email вже зареєстрований' };
      }

      const isSuperAdmin = cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase();
      const status: UserApprovalStatus = isSuperAdmin ? 'approved' : 'pending_approval';
      const role = isSuperAdmin ? 'admin' : 'seller';
      const sellerCode = isSuperAdmin ? 'EP-ADMIN-01' : generateSellerCode();
      const approvalToken = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const nowIso = new Date().toISOString();

      const initialStore: MerchantStore = {
        id: `store_${Date.now()}`,
        name: cleanShop,
        sellerCode,
        createdAt: nowIso,
        isVerified: true,
        subscriptionTier: 'pro'
      };

      const newUser: UserProfile = {
        id: `usr_${Date.now()}`,
        name: cleanName,
        email: cleanEmail,
        shopName: cleanShop,
        sellerCode,
        role,
        status,
        approvalToken,
        createdAt: nowIso,
        stores: [initialStore],
        activeStoreId: initialStore.id
      };

      accounts[cleanEmail] = {
        user: newUser,
        passwordHash: cleanPassword
      };
      this.saveAccounts(accounts);
      this.persistUser(newUser);

      // Asynchronously notify backend of registration
      try {
        fetch('/api/auth/notify-registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: newUser, approvalToken })
        }).catch(() => {});
      } catch {
        // ignore
      }

      return {
        success: true,
        user: newUser,
        status
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Не вдалося завершити реєстрацію магазину'
      };
    }
  }

  /**
   * Reads optional client-side Vite/process Resend env var ONLY to forward to our own same-origin
   * server API route (/api/auth/reset-password) if the user named the env var VITE_RESEND_API_KEY.
   * Never calls api.resend.com from the browser (prevents CORS errors and browser exposure).
   */
  private resolveEnvResendFallbackKey(): string {
    const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
    const procEnv = typeof process !== 'undefined' ? (process as any).env : undefined;
    const rawKey =
      metaEnv?.VITE_RESEND_API_KEY ||
      procEnv?.RESEND_API_KEY ||
      procEnv?.VITE_RESEND_API_KEY ||
      '';
    const trimmed = String(rawKey).trim();
    return trimmed && trimmed !== 're_xxxxxxxxx' ? trimmed : '';
  }

  /**
   * Request password reset with strictly 60 seconds TTL (1 minute)
   * Dispatches strictly via server-side API route (/api/auth/reset-password) to Resend REST API
   */
  public async requestPasswordReset(email: string): Promise<{
    success: boolean;
    message: string;
    expiresIn?: number;
    error?: string;
    details?: any;
    directToken?: string;
    isSuperAdmin?: boolean;
    firebaseEmailSent?: boolean;
    serverDispatched?: boolean;
  }> {
    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return { success: false, message: 'Введіть коректну адресу електронної пошти', error: 'INVALID_EMAIL' };
      }

      const accounts = this.getAccounts();
      const account = accounts[cleanEmail];

      // Enforce status check if account exists in local registry
      if (account) {
        const user = account.user;
        if (user.role !== 'admin' && user.status !== 'approved') {
          if (user.status === 'pending_approval') {
            return {
              success: false,
              message: 'Ваш обліковий запис очікує підтвердження адміністратором. Скидання пароля можливе лише для схвалених користувачів.',
              error: 'PENDING_APPROVAL'
            };
          }
          if (user.status === 'rejected') {
            return {
              success: false,
              message: 'Реєстрацію цього акаунта було відхилено адміністратором. Скидання пароля заблоковано.',
              error: 'REJECTED_USER'
            };
          }
        }
      }

      // 1. Optional Firebase Auth password reset email (if registered in Firebase)
      let firebaseEmailSent = false;
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
        firebaseEmailSent = true;
      } catch (fbErr: any) {
        console.warn('Firebase sendPasswordResetEmail note:', fbErr?.message || fbErr);
      }

      // 2. Server-side dispatch via /api/auth/reset-password (Vercel Serverless / Express)
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        const fallbackEnvKey = this.resolveEnvResendFallbackKey();
        if (fallbackEnvKey) {
          headers['X-Resend-Api-Key'] = fallbackEnvKey;
        }

        const clientOrigin = typeof window !== 'undefined' ? window.location.origin : '';
        const clientUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';

        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'request',
            email: cleanEmail,
            clientOrigin,
            clientUrl,
            ttlSeconds: 900
          })
        });

        let data: any = {};
        const responseText = await res.text();
        try {
          data = JSON.parse(responseText);
        } catch {
          data = { rawText: responseText };
        }

        if (!res.ok || data?.success === false) {
          const exactErr = {
            status: res.status,
            error: data?.error,
            message: data?.message,
            details: data?.details || data?.rawText
          };
          console.error('[Resend Password Reset Error]:', exactErr);

          if (res.status === 404) {
            return {
              success: false,
              message: 'Помилка 404 (Not Found): Серверний роут /api/auth/reset-password не знайдено. Перевірте деплой або виконайте Redeploy у Vercel.',
              error: 'ENDPOINT_404',
              details: exactErr
            };
          }

          if (data?.error === 'RESEND_API_KEY_NOT_CONFIGURED') {
            return {
              success: false,
              message:
                data?.message ||
                'Ключ RESEND_API_KEY (або VITE_RESEND_API_KEY) не знайдено на сервері. Додайте ключ у змінні середовища та зробіть Redeploy.',
              error: 'RESEND_API_KEY_NOT_CONFIGURED',
              details: exactErr
            };
          }

          return {
            success: false,
            message:
              data?.message ||
              data?.error ||
              `Помилка сервера HTTP ${res.status}: ${data?.rawText?.slice(0, 180) || 'Не вдалося надіслати лист через Resend'}`,
            error: data?.error || `HTTP_${res.status}`,
            details: exactErr
          };
        }

        return {
          success: true,
          firebaseEmailSent,
          serverDispatched: true,
          message:
            data?.message ||
            'Лист із захищеним посиланням для зміни пароля надіслано на вашу електронну пошту через Resend. Будь ласка, перевірте поштову скриньку (та папку Спам).'
        };
      } catch (err: any) {
        console.error('[Resend Password Reset Network Exception]:', err);
        return {
          success: false,
          message: err?.message || 'Мережева помилка при зверненні до серверного роуту /api/auth/reset-password',
          error: 'NETWORK_ERROR',
          details: err
        };
      }
    } catch (err: any) {
      console.error('[Password Reset Unexpected Exception]:', err);
      return {
        success: false,
        message: err?.message || 'Помилка запиту на відновлення пароля',
        error: 'SERVER_ERROR',
        details: err
      };
    }
  }

  /**
   * Asynchronously verify password reset token via server (/api/auth/reset-password) or local cache
   */
  public async verifyResetTokenAsync(token: string): Promise<{
    valid: boolean;
    email?: string;
    remainingSeconds: number;
    error?: string;
  }> {
    if (!token) return { valid: false, remainingSeconds: 0, error: 'Токен відсутній' };

    // 1. Authoritative server check via unified /api/auth/reset-password
    try {
      const resp = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', token })
      });
      const data = await resp.json();
      if (resp.ok && data.valid) {
        return {
          valid: true,
          email: data.email,
          remainingSeconds: data.remainingSeconds || 900
        };
      }
      if (resp.status === 410) {
        return { valid: false, remainingSeconds: 0, error: 'Час дії посилання (15 хв) вичерпано. Згенеруйте нове.' };
      }
    } catch (err) {
      console.error('[verifyResetTokenAsync Error]:', err);
    }

    // 2. Fallback to local cache verification
    return this.verifyResetToken(token);
  }

  /**
   * Verify password reset token status and calculate remaining seconds
   */
  public verifyResetToken(token: string): {
    valid: boolean;
    email?: string;
    remainingSeconds: number;
    error?: string;
  } {
    if (!token) return { valid: false, remainingSeconds: 0, error: 'Токен відсутній' };

    try {
      const storedTokensStr = localStorage.getItem('epicentr_reset_tokens');
      const tokens: Record<string, { email: string; expiresAt: number; token: string }> = storedTokensStr
        ? JSON.parse(storedTokensStr)
        : {};
      const record = tokens[token];

      if (!record) {
        return { valid: false, remainingSeconds: 0, error: 'Посилання для скидання пароля не знайдено або воно вже використано' };
      }

      const now = Date.now();
      const remainingMs = record.expiresAt - now;

      if (remainingMs <= 0) {
        return { valid: false, remainingSeconds: 0, error: 'Час дії посилання (60 сек) вичерпано. Згенеруйте нове посилання.' };
      }

      const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
      return { valid: true, email: record.email, remainingSeconds };
    } catch {
      return { valid: false, remainingSeconds: 0, error: 'Помилка перевірки токена' };
    }
  }

  /**
   * Submit new password with validated 60-second token
   */
  public async resetPasswordWithToken(
    token: string,
    newPass: string,
    confirmPass: string
  ): Promise<{ success: boolean; message: string; error?: string }> {
    const cleanNewPass = (newPass || '').trim();
    const cleanConfirmPass = (confirmPass || '').trim();

    if (cleanNewPass.length < 6) {
      return {
        success: false,
        message: 'Новий пароль повинен містити не менше 6 символів',
        error: 'SHORT_PASSWORD'
      };
    }

    if (cleanNewPass !== cleanConfirmPass) {
      return {
        success: false,
        message: 'Паролі не збігаються. Будь ласка, перевірте правильність введення',
        error: 'PASSWORDS_MISMATCH'
      };
    }

    if (!token) {
      return {
        success: false,
        message: 'Токен скидання пароля відсутній',
        error: 'INVALID_TOKEN'
      };
    }

    let resolvedEmail: string | undefined;

    // 1. Submit reset directly to backend server (which authoritative owns the 60-second memory tokens)
    try {
      const resp = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: cleanNewPass })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return {
          success: false,
          message: data.error || data.message || 'Посилання для скидання пароля не знайдено або його час (60 сек) вичерпано',
          error: resp.status === 410 ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
        };
      }
      resolvedEmail = data.email;
    } catch {
      // 2. Fallback to local cache verification if backend is temporarily unreachable
      const localVerification = this.verifyResetToken(token);
      if (!localVerification.valid || !localVerification.email) {
        return {
          success: false,
          message: localVerification.error || 'Час дії посилання (60 сек) вичерпано. Згенеруйте новий запит на зміну пароля.',
          error: 'TOKEN_EXPIRED'
        };
      }
      resolvedEmail = localVerification.email;
    }

    // 3. Sync new password in local accounts cache so user can immediately log in in this or new tabs
    if (resolvedEmail) {
      const emailKey = resolvedEmail.toLowerCase().trim();
      const accounts = this.getAccounts();
      if (accounts[emailKey]) {
        accounts[emailKey].passwordHash = cleanNewPass;
      } else if (emailKey === SUPER_ADMIN_EMAIL.toLowerCase()) {
        accounts[emailKey] = {
          user: { ...SUPER_ADMIN_USER },
          passwordHash: cleanNewPass
        };
      } else if (emailKey === DEFAULT_DEMO_USER.email.toLowerCase()) {
        accounts[emailKey] = {
          user: { ...DEFAULT_DEMO_USER },
          passwordHash: cleanNewPass
        };
      } else {
        const storeId = `store_${Date.now()}`;
        const sCode = generateSellerCode();
        accounts[emailKey] = {
          user: {
            id: `usr_${Date.now()}`,
            email: emailKey,
            name: emailKey.split('@')[0],
            shopName: 'Мій Магазин',
            sellerCode: sCode,
            role: 'seller',
            status: 'approved',
            activeStoreId: storeId,
            stores: [{
              id: storeId,
              name: 'Мій Магазин',
              sellerCode: sCode,
              createdAt: new Date().toISOString(),
              isVerified: true,
              subscriptionTier: 'pro'
            }],
            createdAt: new Date().toISOString()
          },
          passwordHash: cleanNewPass
        };
      }
      this.saveAccounts(accounts);
    }

    // 4. Invalidate local token cache if present
    try {
      const storedTokensStr = localStorage.getItem('epicentr_reset_tokens');
      if (storedTokensStr) {
        const tokens = JSON.parse(storedTokensStr);
        delete tokens[token];
        localStorage.setItem('epicentr_reset_tokens', JSON.stringify(tokens));
      }
    } catch {
      // continue
    }

    return {
      success: true,
      message: 'Пароль успішно оновлено! Тепер ви можете увійти до кабінету з новим паролем.'
    };
  }

  /**
   * Update profile information (also persists to Firestore if signed in with Firebase Auth)
   */
  public async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    if (!this.currentUser) {
      throw new Error('Користувач не авторизований');
    }

    const updatedStores = [...(this.currentUser.stores || [])];
    if (updates.shopName && updates.shopName.trim()) {
      const activeIdx = updatedStores.findIndex(s => s.id === this.currentUser?.activeStoreId);
      if (activeIdx >= 0) {
        updatedStores[activeIdx] = {
          ...updatedStores[activeIdx],
          name: updates.shopName.trim()
        };
      }
    }

    const updated: UserProfile = normalizeUserProfile({
      ...this.currentUser,
      ...updates,
      stores: updates.stores || updatedStores
    });

    if (auth.currentUser && auth.currentUser.uid === updated.id) {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      try {
        const snap = await getDoc(userRef);
        const existingCreatedAt = snap.exists() && snap.data().createdAt ? snap.data().createdAt : Timestamp.now();
        await setDoc(userRef, {
          uid: auth.currentUser.uid,
          email: snap.exists() ? snap.data().email : updated.email,
          name: (updated.name || 'Селер Епіцентр').slice(0, 120),
          shopName: (updated.shopName || 'Кабінет Епіцентр').slice(0, 150),
          sellerCode: (updated.sellerCode || 'EP-10001').slice(0, 50),
          role: snap.exists() ? snap.data().role : updated.role,
          ...(updated.avatarUrl ? { avatarUrl: updated.avatarUrl.slice(0, 2048) } : {}),
          createdAt: existingCreatedAt,
          updatedAt: Timestamp.now()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
      }
    }

    this.persistUser(updated);
    return updated;
  }

  /**
   * Change user password
   */
  public async changePassword(
    oldPass: string,
    newPass: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUser) {
      return { success: false, error: 'Користувач не авторизований' };
    }

    const accounts = this.getAccounts();
    const emailKey = this.currentUser.email.toLowerCase();
    const account = accounts[emailKey];

    if (!account) {
      return { success: false, error: 'Обліковий запис не знайдено' };
    }

    if (account.passwordHash !== oldPass.trim()) {
      return { success: false, error: 'Поточний пароль вказано невірно' };
    }

    if (newPass.trim().length < 6) {
      return { success: false, error: 'Новий пароль повинен мати мінімум 6 символів' };
    }

    account.passwordHash = newPass.trim();
    this.saveAccounts(accounts);
    return { success: true };
  }

  /**
   * Log out user explicitly
   */
  public logout(): void {
    signOutFirebase().catch(() => {});
    this.currentUser = null;
    try {
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      localStorage.setItem(EXPLICIT_LOGOUT_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
    this.notify();
  }
}

export const authService = AuthService.getInstance();
