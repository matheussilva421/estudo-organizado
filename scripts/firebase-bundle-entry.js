export { initializeApp, getApps } from 'firebase/app';
export {
  getAuth,
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from 'firebase/auth';
export {
  doc,
  getDoc,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
export {
  initializeAppCheck,
  ReCaptchaV3Provider
} from 'firebase/app-check';
