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
  getDocsFromServer,
  initializeFirestore,
  connectFirestoreEmulator,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch
} from 'firebase/firestore';
export {
  initializeAppCheck,
  ReCaptchaV3Provider
} from 'firebase/app-check';
