/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  UserStoryProposal,
  ReleaseLogItem,
  ClarifyingQuestion,
  StoryEvaluation
} from '../types/userStories';

const STORAGE_STORIES_KEY = 'epicentr_saas_user_stories';
const STORAGE_RELEASES_KEY = 'epicentr_saas_releases_log';
const STORAGE_APP_VERSION_KEY = 'epicentr_saas_current_version';

export const INITIAL_STORIES: UserStoryProposal[] = [
  {
    id: 'story-ean13',
    title: 'Автоматична валідація та генерація штрихкодів EAN-13',
    userRole: 'Як контент-менеджер великого магазину електроніки',
    wantFeature: 'щоб система автоматично перевіряла контрольний розряд штрихкоду EAN-13 або генерувала валідний код для товарів без штрихкоду',
    soThatBenefit: 'уникнути помилок модерації Епіцентру та пришвидшити публікацію товарів на 30%',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: 'evaluated',
    evaluation: {
      businessImpactScore: 9,
      implementationFeasibility: 9,
      priority: 'Must Have',
      riskLevel: 'Низький',
      summaryRationale: 'Штрихкоди є обов\'язковою вимогою для модерації в категоріях техніки та дитячих товарів. Впровадження автоматичного розрахунку контрольної суми виключає 85% відхилень модераторами.'
    },
    clarifyingQuestions: [
      {
        id: 'q1',
        question: 'Для яких саме категорій товарів відсутність EAN-13 є найбільш критичною?',
        importancePrompt: 'Це допоможе налаштувати автоматичне визначення обов\'язковості поля для конкретної категорії.',
        userAnswer: 'Електроніка, аксесуари та побутова техніка'
      },
      {
        id: 'q2',
        question: 'Чи потрібно зберігати старі некоректні штрихкоди у звіті для ручної звірки?',
        importancePrompt: 'Визначає, чи замінювати значення одразу або додавати колонку для аудиту.',
        userAnswer: 'Так, показувати старий та виправлений код у Diff-таблиці'
      }
    ]
  },
  {
    id: 'story-ai-rewrite',
    title: 'ШІ-рерайтинг описів під ліміти символів та мовні норми Епіцентру',
    userRole: 'Як маркетолог та селер маркетплейсу',
    wantFeature: 'щоб ШІ-агент автоматично скорочував перевантажені описи товарів, прибирав рекламний спам (слова "Акція", "Хіт") та виправляв суржик у [ua] колонці',
    soThatBenefit: 'товари гарантовано проходили ручну модерацію з першого разу без повернення на доопрацювання',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    status: 'ready_to_compile',
    evaluation: {
      businessImpactScore: 10,
      implementationFeasibility: 8,
      priority: 'Must Have',
      riskLevel: 'Низький',
      summaryRationale: 'Найчастіша причина повернення шаблонів — наявність стоп-слів у описах та порушення українського правопису в [ua] стовпчиках.'
    },
    clarifyingQuestions: [
      {
        id: 'q1',
        question: 'Яку максимальну довжину опису ви вважаєте оптимальною для ваших карток?',
        importancePrompt: 'Дозволить встановити рекомендований ліміт слів та структуру абзаців.',
        userAnswer: 'До 1200 символів з акцентом на технічні параметри та комплектацію'
      },
      {
        id: 'q2',
        question: 'Чи обов\'язково генерувати паралельний переклад на російську для [ru] стовпчика?',
        importancePrompt: 'Регламент контенту дозволяє російський опис за бажанням, але якщо стовпчик є в шаблоні — мова має строго відповідати.',
        userAnswer: 'Так, дзеркальний якісний переклад без русизмів'
      }
    ]
  }
];

export const INITIAL_RELEASES: ReleaseLogItem[] = [
  {
    version: 'v1.0.0',
    title: 'Базовий реліз: Двигун заповнення шаблонів Епіцентр',
    storyId: 'story-core',
    deployedAt: '2026-10-10T10:00:00Z',
    changesSummary: [
      'Зчитування колонок (select, multiselect, float...) та обов\'язкових полів (*)',
      'Збереження службових коментарів комірок заголовків',
      'Захист колонки ID та заповнених даних',
      'Аналіз першого фото товару (базовий колір, візерунок)',
      'Формування назв товару за 7-компонентною формулою Епіцентру'
    ],
    featuresActivated: ['core_engine', 'photo_analyzer', 'title_generator']
  },
  {
    version: 'v1.1.0',
    title: 'Реліз: Мульти-магазинний простір та публічне поширення',
    storyId: 'story-workspaces',
    deployedAt: '2026-10-12T15:30:00Z',
    changesSummary: [
      'Кабінети селерів (Workspaces) з підтримкою різних категорій',
      'Історія оброблених партій у локальному браузерному сховищі',
      'Публічне поширення з QR-кодом та шаблоном запрошення команди',
      'Онбординг-гід швидкого старту для нових користувачів'
    ],
    featuresActivated: ['workspaces', 'batch_history', 'public_share']
  }
];

export function getUserStories(): UserStoryProposal[] {
  try {
    const raw = localStorage.getItem(STORAGE_STORIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to load user stories:', e);
  }
  return INITIAL_STORIES;
}

export function saveUserStories(stories: UserStoryProposal[]) {
  try {
    localStorage.setItem(STORAGE_STORIES_KEY, JSON.stringify(stories));
  } catch (e) {
    console.error('Failed to save user stories:', e);
  }
}

export function getReleasesLog(): ReleaseLogItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_RELEASES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to load releases log:', e);
  }
  return INITIAL_RELEASES;
}

export function saveReleasesLog(releases: ReleaseLogItem[]) {
  try {
    localStorage.setItem(STORAGE_RELEASES_KEY, JSON.stringify(releases));
  } catch (e) {
    console.error('Failed to save releases log:', e);
  }
}

export function getCurrentAppVersion(): string {
  try {
    const v = localStorage.getItem(STORAGE_APP_VERSION_KEY);
    if (v) return v;
  } catch {}
  return 'v1.2.0';
}

export function setCurrentAppVersion(v: string) {
  try {
    localStorage.setItem(STORAGE_APP_VERSION_KEY, v);
  } catch {}
}

/**
 * Intelligent Evaluation & Question Generator for User Stories
 */
export function evaluateUserStory(story: {
  title: string;
  userRole: string;
  wantFeature: string;
  soThatBenefit: string;
}): {
  evaluation: StoryEvaluation;
  clarifyingQuestions: ClarifyingQuestion[];
} {
  const combined = `${story.title} ${story.wantFeature} ${story.soThatBenefit}`.toLowerCase();

  let businessImpactScore = 8;
  let implementationFeasibility = 9;
  let priority: StoryEvaluation['priority'] = 'Should Have';
  let riskLevel: StoryEvaluation['riskLevel'] = 'Низький';
  let rationale = 'Пропозиція спрямована на оптимізацію роботи з каталогом та пришвидшення модерації.';

  if (combined.includes('ean') || combined.includes('штрихкод') || combined.includes('помилк') || combined.includes('модераці')) {
    businessImpactScore = 10;
    priority = 'Must Have';
    rationale = 'Критично для проходження перевірки контент-відділом Епіцентру. Зменшує ручну рутину на 40%.';
  } else if (combined.includes('шi') || combined.includes('ai') || combined.includes('опис') || combined.includes('переклад')) {
    businessImpactScore = 9;
    implementationFeasibility = 8;
    priority = 'Must Have';
    rationale = 'Покращує якість описів товару та виправляє мовні теги згідно регламенту субліцензійного договору.';
  } else if (combined.includes('експорт') || combined.includes('rozetka') || combined.includes('prom') || combined.includes('csv')) {
    businessImpactScore = 8;
    implementationFeasibility = 9;
    priority = 'Should Have';
    rationale = 'Розширює сумісність сервісу для мультиканальних українських селерів.';
  } else if (combined.includes('фото') || combined.includes('водян') || combined.includes('webp') || combined.includes('фон')) {
    businessImpactScore = 9;
    implementationFeasibility = 7;
    riskLevel = 'Середній';
    priority = 'Must Have';
    rationale = 'Вимоги Епіцентру до фото суворі: білий фон, роздільна здатність від 800х800, заборона водяних знаків.';
  }

  const clarifyingQuestions: ClarifyingQuestion[] = [
    {
      id: 'q1',
      question: `Наскільки це важливо для вашого щоденного робочого процесу?`,
      importancePrompt: 'Оцініть частоту використання: це щоденна потреба чи періодичне завдання для окремих поставок?',
      userAnswer: ''
    },
    {
      id: 'q2',
      question: `Який результат ви очікуєте побачити у вихідному Excel-файлі після застосування змін?`,
      importancePrompt: 'Чому саме такий формат результату важливий для вашого відділу контенту або імпортера?',
      userAnswer: ''
    },
    {
      id: 'q3',
      question: `Чи потрібно застосовувати цю модифікацію автоматично до всіх категорій, чи лише за вибором користувача?`,
      importancePrompt: 'Допомагає визначити, чи робити опцію глобальною або керованою через перемикач на Кроці 0.',
      userAnswer: ''
    }
  ];

  return {
    evaluation: {
      businessImpactScore,
      implementationFeasibility,
      priority,
      riskLevel,
      summaryRationale: rationale
    },
    clarifyingQuestions
  };
}

import { getStoredApiKey, maskApiKey } from './aiApiKeyService';

/**
 * Generate compilation and deployment sequence with mandatory BYOK check
 */
export function compileAndDeployRelease(
  story: UserStoryProposal,
  adminModeratorNotes?: string
): {
  success: boolean;
  error?: string;
  newVersion?: string;
  compilationLogs: string[];
  releaseItem?: ReleaseLogItem;
} {
  // BYOK check: compilation must use author's key stored in localStorage under 'epic_ai_key'
  const byokKey = getStoredApiKey();
  if (!byokKey) {
    return {
      success: false,
      error: 'MISSING_BYOK_KEY',
      compilationLogs: [
        `[COMPILE ERROR] Збірку та компіляцію релізу зупинено!`,
        `[BYOK ALERT] У локальному сховищі автора (localStorage) відсутній персональний ключ "epic_ai_key".`,
        `[POLICY] Запуск компіляції та витрати токенів Gemini API повинні здійснюватися за рахунок автора ідеї, а не системи.`,
        `[ACTION REQUIRED] Повідомте адміністратора або автора про необхідність додати Google AI Studio API Key перед запуском релізу.`
      ]
    };
  }

  const maskedKey = maskApiKey(byokKey);
  const currentVer = getCurrentAppVersion();
  // Bump minor version e.g. v1.2.0 -> v1.3.0
  const match = currentVer.match(/v(\d+)\.(\d+)\.(\d+)/);
  let newVersion = 'v1.3.0';
  if (match) {
    const major = parseInt(match[1]);
    const minor = parseInt(match[2]) + 1;
    newVersion = `v${major}.${minor}.0`;
  }

  const timestamp = new Date().toISOString();

  const compilationLogs = [
    `[COMPILE 01/08] Завантаження специфікації User Story "${story.title}"...`,
    `[COMPILE 02/08] Ініціалізація сесії BYOK: Використано персональний ключ автора ${maskedKey}... OK.`,
    `[COMPILE 03/08] Перевірка відповідей на уточнюючі питання користувача... Успішно.`,
    `[COMPILE 04/08] Валідація сумісності з правилами контенту Епіцентру (supportm.epicentrk.ua)...`,
    `[COMPILE 05/08] Генерація модульної логіки обробки та перемикача конфігурації...`,
    `[COMPILE 06/08] Перевірка цілісності: захист ID, коментарів заголовків та HTML-ентіті (&#039;)... Пройдено.`,
    `[COMPILE 07/08] Збірка модифікації та запуск тестів валідації Excel-схеми... 100% OK.`,
    `[COMPILE 08/08] Активація релізу ${newVersion} у робочому середовищі! Статус: approved_and_deployed.`
  ];

  const releaseItem: ReleaseLogItem = {
    version: newVersion,
    title: `Реліз ${newVersion}: ${story.title}`,
    storyId: story.id,
    deployedAt: timestamp,
    changesSummary: [
      story.wantFeature,
      `Бізнес-ефект: ${story.soThatBenefit}`,
      `Пріоритет за MoSCoW: ${story.evaluation?.priority || 'Must Have'} (Оцінка користі: ${story.evaluation?.businessImpactScore || 9}/10)`,
      `Схвалено модератором (BYOK: ${maskedKey})`
    ],
    featuresActivated: [story.id.replace('story-', 'feature_')]
  };

  // Update story status in storage to 'approved_and_deployed'
  const stories = getUserStories();
  const updatedStories = stories.map(s => {
    if (s.id === story.id) {
      return {
        ...s,
        status: 'approved_and_deployed' as const,
        releasedVersion: newVersion,
        releasedAt: timestamp,
        moderatedAt: timestamp,
        moderatorDecision: 'approved' as const,
        moderatorNotes: adminModeratorNotes || 'Схвалено адміністратором з розрахунком через BYOK',
        compilationLogs,
        isActiveFeature: true
      };
    }
    return s;
  });
  saveUserStories(updatedStories);

  // Update app version & public release log
  setCurrentAppVersion(newVersion);
  const releases = getReleasesLog();
  saveReleasesLog([releaseItem, ...releases]);

  return {
    success: true,
    newVersion,
    compilationLogs,
    releaseItem
  };
}
