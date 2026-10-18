/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type LanguageMode = 'ua' | 'en';

export const THEME_STORAGE_KEY = 'epicentr_theme_preference';
export const LANG_STORAGE_KEY = 'epicentr_lang_preference';

export interface Translations {
  [key: string]: {
    ua: string;
    en: string;
  };
}

export const DICTIONARY: Translations = {
  // Brand & Nav
  'brand.title': { ua: 'Епіцентр', en: 'Epicentr' },
  'brand.marketplace': { ua: 'Маркетплейс', en: 'Marketplace' },
  'brand.cabinet': { ua: 'Кабінет селера', en: 'Seller Portal' },
  'nav.signIn': { ua: 'Увійти', en: 'Sign In' },
  'nav.guest': { ua: 'Гість', en: 'Guest' },
  'nav.profile': { ua: 'Мій профіль', en: 'My Profile' },
  'nav.settings': { ua: 'Налаштування', en: 'Settings' },
  'nav.logout': { ua: 'Вийти', en: 'Sign Out' },
  'nav.xmlFeed': { ua: 'XML-фід', en: 'XML Feed' },
  'nav.validator': { ua: 'Валідатор назв', en: 'Title Validator' },
  'nav.regulations': { ua: 'Регламент', en: 'Regulations' },
  'nav.history': { ua: 'Історія', en: 'History' },
  'nav.lab': { ua: 'Лабораторія змін', en: 'Release Lab' },
  'nav.quickStart': { ua: 'Швидкий старт', en: 'Quick Start' },
  'nav.share': { ua: 'Надати доступ', en: 'Share Access' },
  'nav.autoSaved': { ua: 'Автозбережено', en: 'Auto-saved' },
  'nav.syncing': { ua: 'Синхронізація...', en: 'Syncing...' },

  // Tabs
  'tab.report': { ua: 'Підсумок та звіт', en: 'Summary & Report' },
  'tab.table': { ua: 'Таблиця змін', en: 'Diff Table' },
  'tab.monitor': { ua: 'Моніторинг помилок', en: 'Error Monitor' },
  'tab.converter': { ua: 'Генератор XML-фідів', en: 'XML Feed Converter' },
  'tab.upload': { ua: 'Завантажити інший файл', en: 'Upload Another File' },

  // Drawer & Profile
  'drawer.title': { ua: 'Профіль та налаштування', en: 'Profile & Settings' },
  'drawer.personalInfo': { ua: 'Особисті дані продавця', en: 'Seller Information' },
  'drawer.name': { ua: 'Повне ім\'я', en: 'Full Name' },
  'drawer.shopName': { ua: 'Назва магазину / кабінету', en: 'Shop / Company Name' },
  'drawer.email': { ua: 'Email адреса', en: 'Email Address' },
  'drawer.phone': { ua: 'Номер телефону', en: 'Phone Number' },
  'drawer.sellerCode': { ua: 'Код селера в системі', en: 'System Seller Code' },
  'drawer.saveChanges': { ua: 'Зберегти зміни', en: 'Save Changes' },
  'drawer.saved': { ua: 'Успішно збережено!', en: 'Saved Successfully!' },

  // Password change
  'drawer.changePassword': { ua: 'Зміна пароля', en: 'Change Password' },
  'drawer.currentPassword': { ua: 'Поточний пароль', en: 'Current Password' },
  'drawer.newPassword': { ua: 'Новий пароль', en: 'New Password' },
  'drawer.confirmPassword': { ua: 'Підтвердження нового пароля', en: 'Confirm New Password' },
  'drawer.updatePasswordBtn': { ua: 'Оновити пароль', en: 'Update Password' },

  // API Token
  'drawer.merchantApi': { ua: 'Epicentr Merchant API', en: 'Epicentr Merchant API' },
  'drawer.apiTokenDesc': { ua: 'Bearer Token для доступу до PIM категорій та атрибутів', en: 'Bearer Token for PIM categories and attribute sets' },
  'drawer.testConnection': { ua: 'Перевірити з\'єднання', en: 'Test Connection' },

  // UI Settings
  'drawer.appearance': { ua: 'Оформлення та інтерфейс', en: 'Appearance & UI' },
  'drawer.theme': { ua: 'Тема інтерфейсу', en: 'Interface Theme' },
  'drawer.themeLight': { ua: 'Світла ☀️', en: 'Light ☀️' },
  'drawer.themeDark': { ua: 'Темна 🌙', en: 'Dark 🌙' },
  'drawer.themeSystem': { ua: 'Системна 💻 (Авто)', en: 'System 💻 (Auto)' },
  'drawer.language': { ua: 'Мова застосунку', en: 'Language' },
  'drawer.langUa': { ua: 'Українська', en: 'Ukrainian' },
  'drawer.langEn': { ua: 'English', en: 'English' },

  // Auth Modal
  'auth.signInTitle': { ua: 'Вхід до кабінету селера', en: 'Sign in to Seller Portal' },
  'auth.registerTitle': { ua: 'Реєстрація нового продавця', en: 'Register New Seller' },
  'auth.forgotTitle': { ua: 'Відновлення доступу', en: 'Reset Password' },
  'auth.emailPlaceholder': { ua: 'seller@epicentr.ua', en: 'seller@epicentr.ua' },
  'auth.passwordPlaceholder': { ua: 'Введіть пароль', en: 'Enter your password' },
  'auth.signInBtn': { ua: 'Увійти в кабінет', en: 'Sign In' },
  'auth.registerBtn': { ua: 'Зареєструватися', en: 'Create Account' },
  'auth.forgotBtn': { ua: 'Надіслати інструкції', en: 'Send Instructions' },
  'auth.quickDemo': { ua: 'Швидкий демо-вхід в 1 клік', en: '1-Click Quick Demo Login' },
  'auth.noAccount': { ua: 'Немає акаунта?', en: 'Don\'t have an account?' },
  'auth.haveAccount': { ua: 'Вже зареєстровані?', en: 'Already have an account?' },
  // Bottom Nav & Sections
  'bottomNav.home': { ua: 'Головна', en: 'Dashboard' },
  'bottomNav.lab': { ua: 'Лабораторія', en: 'Lab' },
  'bottomNav.reports': { ua: 'Звіти', en: 'Reports' },
  'bottomNav.more': { ua: 'Ще', en: 'More' },

  // Dashboard Overview
  'pim.title': { ua: 'СТАТУС PIM-ФІДУ', en: 'PIM FEED STATUS' },
  'pim.active': { ua: 'Активно', en: 'Active' },
  'pim.products': { ua: 'товарів', en: 'products' },
  'pim.ready': { ua: 'готові до вивантаження', en: 'ready to export' },
  'pim.syncNow': { ua: 'Синхронізувати зараз', en: 'Sync Now' },
  'pim.lastSync': { ua: 'Остання синхронізація', en: 'Last Sync' },
  'pim.completeness': { ua: 'Заповненість атрибутів', en: 'Attribute completeness' },
  'pim.apiConnected': { ua: 'Merchant API підключено', en: 'Merchant API Connected' },
  
  // Quick Actions
  'actions.title': { ua: 'Швидкі дії', en: 'Quick Actions' },
  'actions.lab': { ua: 'Лабораторія змін', en: 'Changes Lab' },
  'actions.labDesc': { ua: 'AI-збагачення характеристик, виправлення помилок та таблиця', en: 'AI attribute enrichment, error fixes & diff table' },
  'actions.xml': { ua: 'XML-фід', en: 'XML Feed' },
  'actions.xmlDesc': { ua: 'Конвертація XML Prom / Rozetka у формат Епіцентру', en: 'Convert Prom / Rozetka XML to Epicentr format' },
  'actions.api': { ua: 'API-ключ', en: 'API Key' },
  'actions.apiDesc': { ua: 'Управління Bearer-токеном кабінету селера', en: 'Manage Epicentr Seller Bearer token' },
  'actions.proposals': { ua: 'Управління пропозиціями', en: 'Offer Management' },
  'actions.proposalsDesc': { ua: 'Валідація назв, формули, категорії та фото', en: 'Title validation, formulas, categories & media' },

  // Activity Feed
  'activity.title': { ua: 'Останні операції та фідбеки', en: 'Recent Operations & Feedback' },
  'activity.viewAll': { ua: 'Всі події', en: 'All Events' },

  // Upload bar
  'uploadBar.collapse': { ua: 'Згорнути панель файлів', en: 'Collapse Files Panel' },
  'uploadBar.expand': { ua: 'Розгорнути завантаження файлів', en: 'Expand File Upload' },
  'uploadBar.loaded': { ua: 'Файли завантажено', en: 'Files Loaded' },

  // Notifications
  'notifications.title': { ua: 'Сповіщення', en: 'Notifications' },
  'notifications.empty': { ua: 'Немає нових сповіщень', en: 'No new notifications' },
  'notifications.markAllRead': { ua: 'Прочитати всі', en: 'Mark all as read' }
};

export class UiPreferencesService {
  private static instance: UiPreferencesService;
  private theme: ThemeMode = 'system';
  private lang: LanguageMode = 'ua';
  private themeListeners: Array<(theme: ThemeMode) => void> = [];
  private langListeners: Array<(lang: LanguageMode) => void> = [];

  private constructor() {
    this.initPreferences();
  }

  public static getInstance(): UiPreferencesService {
    if (!UiPreferencesService.instance) {
      UiPreferencesService.instance = new UiPreferencesService();
    }
    return UiPreferencesService.instance;
  }

  private initPreferences(): void {
    // 1. Language
    const savedLang = localStorage.getItem(LANG_STORAGE_KEY) as LanguageMode;
    if (savedLang === 'ua' || savedLang === 'en') {
      this.lang = savedLang;
    } else {
      this.lang = 'ua';
    }

    // 2. Theme (defaults to system preference)
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode;
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
      this.theme = savedTheme;
    } else {
      this.theme = 'system';
    }

    this.applyTheme(this.theme);

    // Watch OS system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.theme === 'system') {
          this.applyTheme('system');
        }
      });
    }
  }

  public getTheme(): ThemeMode {
    return this.theme;
  }

  public setTheme(mode: ThemeMode): void {
    this.theme = mode;
    localStorage.setItem(THEME_STORAGE_KEY, mode);
    this.applyTheme(mode);
    this.themeListeners.forEach((l) => l(mode));
  }

  public subscribeTheme(listener: (theme: ThemeMode) => void): () => void {
    this.themeListeners.push(listener);
    listener(this.theme);
    return () => {
      this.themeListeners = this.themeListeners.filter((l) => l !== listener);
    };
  }

  private applyTheme(mode: ThemeMode): void {
    if (typeof document === 'undefined') return;

    let isDark = false;
    if (mode === 'dark') {
      isDark = true;
    } else if (mode === 'system') {
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  public getLanguage(): LanguageMode {
    return this.lang;
  }

  public setLanguage(lang: LanguageMode): void {
    this.lang = lang;
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    this.langListeners.forEach((l) => l(lang));
  }

  public subscribeLanguage(listener: (lang: LanguageMode) => void): () => void {
    this.langListeners.push(listener);
    listener(this.lang);
    return () => {
      this.langListeners = this.langListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Translate key into active language with fallback
   */
  public t(key: string, langOverride?: LanguageMode): string {
    const currentLang = langOverride || this.lang;
    const entry = DICTIONARY[key];
    if (!entry) return key;
    return entry[currentLang] || entry['ua'] || key;
  }
}

export const uiPreferences = UiPreferencesService.getInstance();
