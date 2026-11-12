import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  User as FirebaseUser
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  Firestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
  getDocs
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Suppress benign WebChannel / fetch AbortError notifications and Vite HMR WebSocket errors
if (typeof window !== 'undefined') {
  const isBenignStreamAbort = (err: any, msg?: string, stack?: string) => {
    const name = String(err?.name || '').toLowerCase();
    const message = String(err?.message || msg || err || '').toLowerCase();
    const trace = String(err?.stack || stack || '').toLowerCase();

    return (
      name === 'aborterror' ||
      message.includes('signal is aborted') ||
      message.includes('the user aborted a request') ||
      message.includes('user aborted') ||
      message.includes('aborterror') ||
      message.includes('websocket') ||
      message.includes('closed without opened') ||
      trace.includes('firebase_firestore') ||
      trace.includes('streambridge') ||
      trace.includes('@vite/client') ||
      trace.includes('vite/client')
    );
  };

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      if (isBenignStreamAbort(event?.reason)) {
        event.preventDefault();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        if (event.stopPropagation) event.stopPropagation();
      }
    },
    true
  );

  window.addEventListener(
    'error',
    (event) => {
      if (isBenignStreamAbort(event?.error, event?.message, event?.filename)) {
        event.preventDefault();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        if (event.stopPropagation) event.stopPropagation();
      }
    },
    true
  );
}

// Initialize Firebase SDK with long-polling to avoid FetchXmlHttp AbortController stream aborts in iframe environments
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function initDb(): Firestore {
  const dbId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
  try {
    return initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
      },
      dbId
    );
  } catch {
    return dbId ? getFirestore(app, dbId) : getFirestore(app);
  }
}

export const db = initDb();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Scopes provisioned for Gmail integration in Google Cloud Project useful-parity-wvr20
export const GMAIL_SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.labels'
];

GMAIL_SCOPES.forEach((scope) => {
  googleProvider.addScope(scope);
});
// Request offline access prompt to ensure fresh token exchange
googleProvider.setCustomParameters({
  prompt: 'consent'
});

// Workspace Integration Rule: Cache OAuth access tokens strictly IN-MEMORY only (NEVER localStorage or sessionStorage)
let inMemoryGmailAccessToken: string | null = null;
let inMemoryTokenExpiresAt: number = 0;

export function getGmailAccessToken(): string | null {
  if (inMemoryGmailAccessToken && Date.now() < inMemoryTokenExpiresAt) {
    return inMemoryGmailAccessToken;
  }
  return null;
}

export function setGmailAccessToken(token: string | null, expiresInSeconds = 3500) {
  inMemoryGmailAccessToken = token;
  inMemoryTokenExpiresAt = token ? Date.now() + expiresInSeconds * 1000 : 0;
}

export function clearGmailAccessToken() {
  inMemoryGmailAccessToken = null;
  inMemoryTokenExpiresAt = 0;
}

export async function signInWithGoogleForGmail(): Promise<{
  user: FirebaseUser;
  accessToken: string;
}> {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;

  if (!accessToken) {
    throw new Error(
      'Не вдалося отримати OAuth Access Token для Gmail. Перевірте дозволи у вікні авторизації Google.'
    );
  }

  setGmailAccessToken(accessToken);
  await syncFirebaseUserProfile(result.user);

  return {
    user: result.user,
    accessToken
  };
}

export { sendPasswordResetEmail, confirmPasswordReset, verifyPasswordResetCode };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: boolean | string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errName = error instanceof Error ? error.name : '';
  const msgLower = errMsg.toLowerCase();

  if (
    errName === 'AbortError' ||
    msgLower.includes('signal is aborted') ||
    msgLower.includes('user aborted') ||
    msgLower.includes('the user aborted a request') ||
    msgLower.includes('client is offline') ||
    msgLower.includes('failed to get document because the client is offline')
  ) {
    // Harmless stream abort or offline network transition, do not crash the app
    console.warn(`Firestore warning (${operationType} at ${path}): client is offline or request aborted.`);
    return undefined as never;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface FirestoreCatalogSession {
  id: string;
  uid: string;
  workspaceId: string;
  filename: string;
  categoryTitle: string;
  productsCount: number;
  mandatoryColumnsCount: number;
  newlyFilledCount: number;
  fillRatePercentage: number;
  unfilledMandatoryCount: number;
  createdAt: string;
}

export interface FirestoreGeneratedImage {
  id: string;
  uid: string;
  prompt: string;
  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  imageSize: '512px' | '1K' | '2K' | '4K';
  imageUrl: string;
  productTitle: string;
  createdAt: string;
}

export interface FirestoreChatMessage {
  id: string;
  uid: string;
  role: 'user' | 'model';
  text: string;
  model: string;
  createdAt: string;
}

/**
 * Compress a base64 image Data URL so it safely fits within Firestore's 1MB document limit
 * and the 900,000 char security rule limit.
 */
export async function compressImageForFirestore(dataUrl: string, maxDim = 960): Promise<string> {
  if (!dataUrl.startsWith('data:image/') || dataUrl.length < 650000) {
    return dataUrl;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl.slice(0, 850000));
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', 0.84);
      resolve(compressed);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const inFlightUserSync = new Map<string, Promise<{
  id: string;
  email: string;
  name: string;
  shopName: string;
  sellerCode: string;
  role: 'seller' | 'admin' | 'manager';
  avatarUrl?: string;
  createdAt: string;
}>>();

export async function syncFirebaseUserProfile(fbUser: FirebaseUser) {
  const existingPromise = inFlightUserSync.get(fbUser.uid);
  if (existingPromise) {
    return existingPromise;
  }

  const syncPromise = (async () => {
    const userRef = doc(db, 'users', fbUser.uid);
    const path = `users/${fbUser.uid}`;

    let snap: any = null;
    let isOffline = false;
    try {
      snap = await getDoc(userRef);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const isOfflineError = errMsg.toLowerCase().includes('client is offline') || errMsg.toLowerCase().includes('offline');
      if (isOfflineError) {
        isOffline = true;
        console.warn('Firestore offline during syncFirebaseUserProfile, using resilient local session.');
      } else {
        handleFirestoreError(error, OperationType.GET, path);
      }
    }

    const isBootstrapAdmin = fbUser.email === 'e.tambovskiy@gmail.com' && fbUser.emailVerified;
    const cacheKey = `epicentr_user_profile_${fbUser.uid}`;

    // If client is offline or document couldn't be fetched, recover from cache or derive profile
    if (isOffline || !snap) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.id === fbUser.uid) {
            return parsed;
          }
        }
      } catch {
        // Ignore localStorage error
      }

      const sellerSuffix = Math.floor(10000 + Math.random() * 90000);
      const localProfile = {
        id: fbUser.uid,
        email: fbUser.email || 'user@epicentr.ua',
        name: (fbUser.displayName || 'Селер Епіцентр').trim().slice(0, 120) || 'Селер Епіцентр',
        shopName: 'Кабінет Епіцентр Маркетплейс',
        sellerCode: `EP-${sellerSuffix}`,
        role: (isBootstrapAdmin ? 'admin' : 'seller') as 'seller' | 'admin' | 'manager',
        avatarUrl: fbUser.photoURL || undefined,
        createdAt: new Date().toISOString()
      };

      try {
        localStorage.setItem(cacheKey, JSON.stringify(localProfile));
      } catch {
        // Ignore localStorage error
      }
      return localProfile;
    }

    const now = Timestamp.now();

    if (!snap.exists()) {
      const sellerSuffix = Math.floor(10000 + Math.random() * 90000);
      const newProfile: Record<string, unknown> = {
        uid: fbUser.uid,
        email: (fbUser.email || 'user@epicentr.ua').trim(),
        name: (fbUser.displayName || 'Селер Епіцентр').trim().slice(0, 120) || 'Селер Епіцентр',
        shopName: 'Кабінет Епіцентр Маркетплейс',
        sellerCode: `EP-${sellerSuffix}`,
        role: isBootstrapAdmin ? 'admin' : 'seller',
        createdAt: now,
        updatedAt: now
      };
      if (fbUser.photoURL) {
        newProfile.avatarUrl = fbUser.photoURL.slice(0, 2048);
      }

      try {
        await setDoc(userRef, newProfile);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }

      const created = {
        id: fbUser.uid,
        email: newProfile.email as string,
        name: newProfile.name as string,
        shopName: newProfile.shopName as string,
        sellerCode: newProfile.sellerCode as string,
        role: newProfile.role as 'seller' | 'admin' | 'manager',
        avatarUrl: fbUser.photoURL || undefined,
        createdAt: now.toDate().toISOString()
      };
      try {
        localStorage.setItem(cacheKey, JSON.stringify(created));
      } catch {
        // Ignore storage errors
      }
      return created;
    } else {
      const data = snap.data();
      const existing = {
        id: fbUser.uid,
        email: data.email || fbUser.email || 'user@epicentr.ua',
        name: data.name || fbUser.displayName || 'Селер Епіцентр',
        shopName: data.shopName || 'Кабінет Епіцентр Маркетплейс',
        sellerCode: data.sellerCode || 'EP-10001',
        role: (data.role || 'seller') as 'seller' | 'admin' | 'manager',
        avatarUrl: data.avatarUrl || fbUser.photoURL || undefined,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()
      };
      try {
        localStorage.setItem(cacheKey, JSON.stringify(existing));
      } catch {
        // Ignore storage errors
      }
      return existing;
    }
  })().finally(() => {
    inFlightUserSync.delete(fbUser.uid);
  });

  inFlightUserSync.set(fbUser.uid, syncPromise);
  return syncPromise;
}

export async function signInWithGooglePopup() {
  const result = await signInWithPopup(auth, googleProvider);
  return syncFirebaseUserProfile(result.user);
}

export async function signOutFirebase() {
  await firebaseSignOut(auth);
}

export { onAuthStateChanged };
export type { FirebaseUser };

export async function saveCatalogSessionToFirestore(session: Omit<FirestoreCatalogSession, 'uid' | 'createdAt'>) {
  const user = auth.currentUser;
  if (!user) return;
  const cleanId = session.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const path = `sessions/${cleanId}`;
  try {
    await setDoc(doc(db, 'sessions', cleanId), {
      id: cleanId,
      uid: user.uid,
      workspaceId: (session.workspaceId || 'default').slice(0, 100),
      filename: (session.filename || 'Шаблон_Епіцентр.xlsx').slice(0, 255),
      categoryTitle: (session.categoryTitle || 'Епіцентр').slice(0, 200),
      productsCount: Math.max(0, Math.round(session.productsCount || 0)),
      mandatoryColumnsCount: Math.max(0, Math.round(session.mandatoryColumnsCount || 0)),
      newlyFilledCount: Math.max(0, Math.round(session.newlyFilledCount || 0)),
      fillRatePercentage: Math.min(100, Math.max(0, Number(session.fillRatePercentage || 0))),
      unfilledMandatoryCount: Math.max(0, Math.round(session.unfilledMandatoryCount || 0)),
      createdAt: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeUserSessions(
  uid: string,
  callback: (sessions: FirestoreCatalogSession[]) => void
): () => void {
  const q = query(collection(db, 'sessions'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: FirestoreCatalogSession[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: data.id,
          uid: data.uid,
          workspaceId: data.workspaceId,
          filename: data.filename,
          categoryTitle: data.categoryTitle,
          productsCount: data.productsCount,
          mandatoryColumnsCount: data.mandatoryColumnsCount,
          newlyFilledCount: data.newlyFilledCount,
          fillRatePercentage: data.fillRatePercentage,
          unfilledMandatoryCount: data.unfilledMandatoryCount,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()
        };
      });
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'sessions');
      } catch {
        // Logged via handleFirestoreError
      }
    }
  );
}

export async function saveGeneratedImageToFirestore(
  item: Omit<FirestoreGeneratedImage, 'uid' | 'createdAt'>
) {
  const user = auth.currentUser;
  if (!user) return;
  const cleanId = item.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const path = `images/${cleanId}`;
  try {
    const compressedUrl = await compressImageForFirestore(item.imageUrl);
    await setDoc(doc(db, 'images', cleanId), {
      id: cleanId,
      uid: user.uid,
      prompt: item.prompt.slice(0, 2000),
      aspectRatio: item.aspectRatio,
      imageSize: item.imageSize,
      imageUrl: compressedUrl.slice(0, 900000),
      productTitle: (item.productTitle || 'Товар каталогу').slice(0, 300),
      createdAt: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteGeneratedImageFromFirestore(imageId: string) {
  const user = auth.currentUser;
  if (!user) return;
  const path = `images/${imageId}`;
  try {
    await deleteDoc(doc(db, 'images', imageId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserImages(
  uid: string,
  callback: (images: FirestoreGeneratedImage[]) => void
): () => void {
  const q = query(collection(db, 'images'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: FirestoreGeneratedImage[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: data.id,
          uid: data.uid,
          prompt: data.prompt,
          aspectRatio: data.aspectRatio,
          imageSize: data.imageSize,
          imageUrl: data.imageUrl,
          productTitle: data.productTitle,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()
        };
      });
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'images');
      } catch {
        // Logged via handleFirestoreError
      }
    }
  );
}

export async function saveChatMessageToFirestore(
  msg: Omit<FirestoreChatMessage, 'uid' | 'createdAt'>
) {
  const user = auth.currentUser;
  if (!user) return;
  const cleanId = msg.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const path = `messages/${cleanId}`;
  try {
    await setDoc(doc(db, 'messages', cleanId), {
      id: cleanId,
      uid: user.uid,
      role: msg.role,
      text: msg.text.slice(0, 20000),
      model: msg.model.slice(0, 100),
      createdAt: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function clearUserChatMessagesFromFirestore(uid: string) {
  try {
    const q = query(collection(db, 'messages'), where('uid', '==', uid));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'messages', d.id))));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'messages');
  }
}

export function subscribeUserChatMessages(
  uid: string,
  callback: (messages: FirestoreChatMessage[]) => void
): () => void {
  const q = query(collection(db, 'messages'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: FirestoreChatMessage[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: data.id,
          uid: data.uid,
          role: data.role,
          text: data.text,
          model: data.model,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()
        };
      });
      items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      callback(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'messages');
      } catch {
        // Logged via handleFirestoreError
      }
    }
  );
}
