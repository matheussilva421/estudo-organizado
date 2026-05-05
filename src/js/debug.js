export function isDebugEnabled(scope) {
  try {
    return localStorage.getItem(`debug:${scope}`) === 'true';
  } catch {
    return false;
  }
}

export function debugLog(scope, ...args) {
  if (isDebugEnabled(scope)) {
    console.log(`[${scope}]`, ...args);
  }
}
