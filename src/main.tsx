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
// Prevents unhandled background promises or runtime errors from crashing the page into a white screen.
window.addEventListener('error', (event) => {
  const msg = String(event?.message || '').toLowerCase();
  if (
    msg.includes('resizeobserver loop') ||
    msg.includes('script error') ||
    msg.includes('extension context invalidated')
  ) {
    return;
  }
  console.error('[Global App Error Intercepted]:', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Global Unhandled Rejection Intercepted]:', event.reason);
  // Prevent browser default crash behavior
  event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary level="app" name="Маркетплейс Епіцентр (PIM Engine)">
    <App />
  </ErrorBoundary>
);
