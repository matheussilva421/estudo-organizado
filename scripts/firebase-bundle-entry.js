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
  collection,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  serverTimestamp,
  setDoc,
  writeBatch
} from 'firebase/firestore';
export {
  initializeAppCheck,
  ReCaptchaV3Provider
} from 'firebase/app-check';
