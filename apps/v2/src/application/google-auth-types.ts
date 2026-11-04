/**
 * Minimal identity contract shared by the UI, sync and tests. `uid` is the
 * Google/Firebase account identifier; it is never the local profileId.
 */
export type GoogleIdentity = {
  uid: string;
  email: string | null;
};

export type GoogleAuthErrorCode = 'AUTH_UNAVAILABLE' | 'AUTH_CANCELLED' | 'AUTH_FAILED';

export class GoogleAuthError extends Error {
  readonly code: GoogleAuthErrorCode;

  constructor(code: GoogleAuthErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'GoogleAuthError';
    this.code = code;
  }
}

export type GoogleAuthPort = {
  signIn(): Promise<GoogleIdentity>;
  signOut(): Promise<void>;
  current(): Promise<GoogleIdentity | null>;
  getIdToken(): Promise<string | null>;
  subscribe(listener: (identity: GoogleIdentity | null) => void): () => void;
};
