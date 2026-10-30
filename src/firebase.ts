import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
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
  window.addEventListener(
    'unhandledrejection',
    (event) => {
      const reason = event?.reason;
      const msg = String(reason?.message || reason || '').toLowerCase();
      const stack = String(reason?.stack || '').toLowerCase();
      if (
        reason?.name === 'AbortError' ||
        msg.includes('signal is aborted without reason') ||
        msg.includes('the user aborted a request') ||
        msg.includes('websocket') ||
        msg.includes('closed without opened') ||
        stack.includes('@vite/client') ||
        stack.includes('vite/client')
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true
  );
}

// Initialize Firebase SDK with long-polling to avoid FetchXmlHttp AbortController stream aborts in iframe environments
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function initDb(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = initDb();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

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

    let snap;
    try {
      snap = await getDoc(userRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }

    const now = Timestamp.now();

    if (!snap.exists()) {
      const sellerSuffix = Math.floor(10000 + Math.random() * 90000);
      const isBootstrapAdmin = fbUser.email === 'e.tambovskiy@gmail.com' && fbUser.emailVerified;
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

      return {
        id: fbUser.uid,
        email: newProfile.email as string,
        name: newProfile.name as string,
        shopName: newProfile.shopName as string,
        sellerCode: newProfile.sellerCode as string,
        role: newProfile.role as 'seller' | 'admin' | 'manager',
        avatarUrl: fbUser.photoURL || undefined,
        createdAt: now.toDate().toISOString()
      };
    } else {
      const data = snap.data();
      return {
        id: fbUser.uid,
        email: data.email || fbUser.email || 'user@epicentr.ua',
        name: data.name || fbUser.displayName || 'Селер Епіцентр',
        shopName: data.shopName || 'Кабінет Епіцентр Маркетплейс',
        sellerCode: data.sellerCode || 'EP-10001',
        role: (data.role || 'seller') as 'seller' | 'admin' | 'manager',
        avatarUrl: data.avatarUrl || fbUser.photoURL || undefined,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()
      };
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
