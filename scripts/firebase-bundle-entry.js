export { initializeApp, getApps } from 'firebase/app';
export {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
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
