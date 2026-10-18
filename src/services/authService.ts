/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
}

export const AUTH_USER_STORAGE_KEY = 'epicentr_auth_user';
export const REGISTERED_USERS_STORAGE_KEY = 'epicentr_registered_users';

export const DEFAULT_DEMO_USER: UserProfile = {
  id: 'usr_seller_demo_01',
  email: 'seller@epicentr.ua',
  name: 'Олександр Мельник',
  shopName: 'Епіцентр Постач Трейд',
  sellerCode: 'EP-89214',
  phone: '+380 (67) 123-45-67',
  role: 'seller',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  createdAt: '2026-01-15T10:00:00Z'
};

const DEFAULT_DEMO_PASSWORD = 'epicentr2026';

interface StoredAccount {
  user: UserProfile;
  passwordHash: string;
}

export class AuthService {
  private static instance: AuthService;
  private currentUser: UserProfile | null = null;
  private listeners: Array<(user: UserProfile | null) => void> = [];

  private constructor() {
    this.initStorage();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private initStorage(): void {
    try {
      // Check if registered users initialized
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

      // Check for active logged in user
      const savedUserStr = localStorage.getItem(AUTH_USER_STORAGE_KEY);
      if (savedUserStr) {
        this.currentUser = JSON.parse(savedUserStr);
      } else {
        // Default to demo user for first visit convenience, or null
        this.currentUser = DEFAULT_DEMO_USER;
        localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(DEFAULT_DEMO_USER));
      }
    } catch (e) {
      console.warn('Failed to initialize auth storage:', e);
      this.currentUser = DEFAULT_DEMO_USER;
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
    this.listeners.forEach((listener) => listener(this.currentUser));
  }

  public getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null;
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
    localStorage.setItem(REGISTERED_USERS_STORAGE_KEY, JSON.stringify(accounts));
  }

  /**
   * Log in user with email and password
   */
  public async login(
    email: string,
    password: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      return { success: false, error: 'Введіть коректні email та пароль' };
    }

    const accounts = this.getAccounts();
    const account = accounts[cleanEmail];

    if (!account) {
      // If user logs in with demo credentials directly
      if (cleanEmail === DEFAULT_DEMO_USER.email.toLowerCase() && cleanPassword === DEFAULT_DEMO_PASSWORD) {
        this.currentUser = DEFAULT_DEMO_USER;
        localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(DEFAULT_DEMO_USER));
        this.notify();
        return { success: true, user: DEFAULT_DEMO_USER };
      }
      return { success: false, error: 'Користувача з такою електронною поштою не знайдено' };
    }

    if (account.passwordHash !== cleanPassword) {
      return { success: false, error: 'Невірний пароль. Спробуйте ще раз або відновіть доступ' };
    }

    this.currentUser = account.user;
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(account.user));
    this.notify();
    return { success: true, user: account.user };
  }

  /**
   * 1-Click Demo Login
   */
  public async loginAsDemo(): Promise<{ success: boolean; user: UserProfile }> {
    this.currentUser = DEFAULT_DEMO_USER;
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(DEFAULT_DEMO_USER));
    this.notify();
    return { success: true, user: DEFAULT_DEMO_USER };
  }

  /**
   * Register new seller account
   */
  public async register(
    name: string,
    email: string,
    password: string,
    shopName: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanShop = shopName.trim() || 'Мій кабінет Епіцентр';

    if (!cleanName) return { success: false, error: 'Вкажіть ваше ім\'я' };
    if (!cleanEmail || !cleanEmail.includes('@')) return { success: false, error: 'Вкажіть коректний email' };
    if (cleanPassword.length < 6) return { success: false, error: 'Пароль має містити не менше 6 символів' };

    const accounts = this.getAccounts();
    if (accounts[cleanEmail]) {
      return { success: false, error: 'Користувач з таким email вже зареєстрований' };
    }

    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const newUser: UserProfile = {
      id: `usr_${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      shopName: cleanShop,
      sellerCode: `EP-${randomSuffix}`,
      role: 'seller',
      createdAt: new Date().toISOString()
    };

    accounts[cleanEmail] = {
      user: newUser,
      passwordHash: cleanPassword
    };
    this.saveAccounts(accounts);

    this.currentUser = newUser;
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(newUser));
    this.notify();

    return { success: true, user: newUser };
  }

  /**
   * Request password reset (simulated)
   */
  public async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Введіть коректну адресу електронної пошти' };
    }

    // Simulate sending email instruction
    return {
      success: true,
      message: `Інструкцію для скидання пароля надіслано на ${cleanEmail}. Перевірте поштову скриньку.`
    };
  }

  /**
   * Update profile information
   */
  public async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    if (!this.currentUser) {
      throw new Error('Користувач не авторизований');
    }

    const updated: UserProfile = {
      ...this.currentUser,
      ...updates
    };

    this.currentUser = updated;
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(updated));

    // Update in registered accounts database
    const accounts = this.getAccounts();
    const emailKey = updated.email.toLowerCase();
    if (accounts[emailKey]) {
      accounts[emailKey].user = updated;
      this.saveAccounts(accounts);
    }

    this.notify();
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
   * Log out user
   */
  public logout(): void {
    this.currentUser = null;
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    this.notify();
  }
}

export const authService = AuthService.getInstance();
