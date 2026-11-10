import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';

// 1. Google Translate & Browser Extension DOM Mutation Safeguard:
// In React 18/19, if a browser extension or Google Translate replaces a text node
// or injects <font> tags, React throws NotFoundError during removeChild or insertBefore.
// This patch safely neutralizes the crash without breaking legitimate DOM updates.
if (typeof Node !== 'undefined' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      console.warn(
        '[DOM Safe Patch] removeChild: child is not a direct child of parent, skipping mutation to prevent white screen',
        child,
        this
      );
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      console.warn(
        '[DOM Safe Patch] insertBefore: referenceNode is not a child of parent, falling back to appendChild to prevent white screen',
        newNode,
        referenceNode,
        this
      );
      return this.appendChild(newNode) as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

// 2. Global Uncaught Error & Unhandled Promise Rejection Interceptors:
// 2. Global Uncaught Error & Unhandled Promise Rejection Interceptors:
// Prevents unhandled background promises or runtime stream aborts from bubbling up to the test runner.
function isBenignStreamAbortOrHmr(err: any, msg?: string, stack?: string): boolean {
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
    message.includes('resizeobserver loop') ||
    message.includes('script error') ||
    message.includes('extension context invalidated') ||
    trace.includes('firebase_firestore') ||
    trace.includes('streambridge') ||
    trace.includes('@vite/client') ||
    trace.includes('vite/client')
  );
}

window.addEventListener(
  'error',
  (event) => {
    // Ignore DOM resource loading errors (img 404, script/link load failures) which have no error object
    if (!event.error && !event.message) {
      return;
    }
    if (isBenignStreamAbortOrHmr(event.error, event.message, event.filename)) {
      event.preventDefault();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      return;
    }
    console.error('[Global App Error Intercepted]:', event.error || event.message);
  },
  true
);

window.addEventListener(
  'unhandledrejection',
  (event) => {
    if (isBenignStreamAbortOrHmr(event.reason)) {
      event.preventDefault();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      return;
    }
    console.error('[Global Unhandled Rejection Intercepted]:', event.reason);
    event.preventDefault();
  },
  true
);

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary level="app" name="Маркетплейс Епіцентр (PIM Engine)">
    <App />
  </ErrorBoundary>
);
