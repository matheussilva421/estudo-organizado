// Mock Firebase stub — replaces firebase-runtime-config.js in mock mode
// Loaded as a plain <script> tag, no imports/exports

window.ESTUDO_FIREBASE_CONFIG = null;
window.__MOCK_FIREBASE_STUB__ = true;

// Stub Firebase modules to prevent runtime errors when the app
// attempts to access Firebase APIs that are not available in mock mode

window.firebase = {
  initializeApp: function () {
    return { name: '[mock]' };
  },
  app: function () {
    return { name: '[mock]' };
  },
  auth: function () {
    return {
      currentUser: null,
      onAuthStateChanged: function (cb) {
        if (cb) cb(null);
        return function unsubscribe() {};
      },
      signInWithPopup: function () {
        return Promise.reject(new Error('[mock] Firebase auth unavailable'));
      },
      signOut: function () {
        return Promise.resolve();
      },
    };
  },
  firestore: function () {
    return {
      collection: function () {
        return {
          doc: function () {
            return {
              get: function () {
                return Promise.reject(new Error('[mock] Firestore unavailable'));
              },
              set: function () {
                return Promise.resolve();
              },
              update: function () {
                return Promise.resolve();
              },
              delete: function () {
                return Promise.resolve();
              },
            };
          },
          add: function () {
            return Promise.reject(new Error('[mock] Firestore unavailable'));
          },
          where: function () {
            return this;
          },
          orderBy: function () {
            return this;
          },
          limit: function () {
            return this;
          },
          get: function () {
            return Promise.resolve({ empty: true, docs: [], forEach: function () {} });
          },
          onSnapshot: function (_, errCb) {
            if (errCb) errCb(new Error('[mock] Firestore unavailable'));
            return function unsubscribe() {};
          },
        };
      },
      doc: function () {
        return {
          get: function () {
            return Promise.reject(new Error('[mock] Firestore unavailable'));
          },
          set: function () {
            return Promise.resolve();
          },
          update: function () {
            return Promise.resolve();
          },
        };
      },
      runTransaction: function (_fn) {
        return Promise.reject(new Error('[mock] Firestore unavailable'));
      },
      batch: function () {
        return {
          set: function () {},
          update: function () {},
          delete: function () {},
          commit: function () {
            return Promise.resolve();
          },
        };
      },
    };
  },
  appCheck: function () {
    return {
      getToken: function () {
        return Promise.resolve({ token: '[mock-token]' });
      },
    };
  },
};
