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

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  shopName: string;
  sellerCode: string;
  phone?: string;
  role: 'seller' | 'admin' | 'manager';
  avatarUrl?: string;
  createdAt: string;
  isFirebaseUser?: boolean;
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

export const DEFAULT_DEMO_USER: UserProfile = {
  id: 'usr_seller_demo_01',
  email: 'seller@epicentr.ua',
  name: 'Олександр Мельник',
  shopName: 'Епіцентр Постач Трейд',
  sellerCode: 'EP-89214',
  phone: '+380 (67) 123-45-67',
  role: 'seller',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?autoformat&fit=crop&w=200&q=80',
  createdAt: '2026-01-15T10:00:00Z',
  stores: DEFAULT_DEMO_STORES,
  activeStoreId: 'shop-electronics'
};

const DEFAULT_DEMO_PASSWORD = 'epicentr2026';

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

  const fallbackShopName = (raw.shopName || '').trim() || DEFAULT_DEMO_USER.shopName;
  const fallbackSellerCode = (raw.sellerCode || '').trim() || generateSellerCode();
  const createdAt = raw.createdAt || new Date().toISOString();

  let stores: MerchantStore[] = Array.isArray(raw.stores)
    ? raw.stores.filter(s => s && typeof s === 'object' && s.id && s.name)
    : [];

  if (stores.length === 0) {
    if (raw.id === DEFAULT_DEMO_USER.id || raw.email === DEFAULT_DEMO_USER.email) {
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

  return {
    id: raw.id || `usr_${Date.now()}`,
    email: raw.email || DEFAULT_DEMO_USER.email,
    name: raw.name || DEFAULT_DEMO_USER.name,
    shopName: activeStore.name,
    sellerCode: activeStore.sellerCode,
    phone: raw.phone,
    role: raw.role || 'seller',
    avatarUrl: raw.avatarUrl,
    createdAt,
    isFirebaseUser: Boolean(raw.isFirebaseUser),
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
      if (!existingAccountsStr) {
        const initialAccounts: Record<string, StoredAccount> = {
          [DEFAULT_DEMO_USER.email.toLowerCase()]: {
            user: DEFAULT_DEMO_USER,
            passwordHash: DEFAULT_DEMO_PASSWORD
          }
        };
        localStorage.setItem(REGISTERED_USERS_STORAGE_KEY, JSON.stringify(initialAccounts));
      }

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
          this.currentUser = DEFAULT_DEMO_USER;
          localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(DEFAULT_DEMO_USER));
        }
      }
    } catch (e) {
      console.warn('Failed to initialize auth storage:', e);
      this.currentUser = DEFAULT_DEMO_USER;
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
   * Log in user with email and password
   */
  public async login(
    email: string,
    password: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanPassword = (password || '').trim();

      if (!cleanEmail || !cleanPassword) {
        return { success: false, error: 'Введіть коректні email та пароль' };
      }

      const accounts = this.getAccounts();
      const account = accounts[cleanEmail];

      if (!account) {
        if (cleanEmail === DEFAULT_DEMO_USER.email.toLowerCase() && cleanPassword === DEFAULT_DEMO_PASSWORD) {
          const demoUser = normalizeUserProfile(DEFAULT_DEMO_USER);
          this.persistUser(demoUser);
          return { success: true, user: demoUser };
        }
        return { success: false, error: 'Користувача з такою електронною поштою не знайдено' };
      }

      if (account.passwordHash !== cleanPassword) {
        return { success: false, error: 'Невірний пароль. Спробуйте ще раз або відновіть доступ' };
      }

      const normalized = normalizeUserProfile(account.user);
      this.persistUser(normalized);
      return { success: true, user: normalized };
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
   * Register new seller account with mandatory store name
   */
  public async register(
    name: string,
    email: string,
    password: string,
    shopName: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
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

      const sellerCode = generateSellerCode();
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
        role: 'seller',
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

      return { success: true, user: newUser };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Не вдалося завершити реєстрацію магазину'
      };
    }
  }

  /**
   * Request password reset (simulated)
   */
  public async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return { success: false, message: 'Введіть коректну адресу електронної пошти' };
      }

      return {
        success: true,
        message: `Інструкцію для скидання пароля надіслано на ${cleanEmail}. Перевірте поштову скриньку.`
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Помилка запиту на відновлення пароля'
      };
    }
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
