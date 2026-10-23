function copy(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function namedError(name, message = name) {
  const error = new Error(message);
  error.name = name;
  return error;
}

export function createTransactionalIdb({
  stores = {},
  commitGate = null,
  version = 1,
  keyPaths = {},
} = {}) {
  const backing = new Map();
  const definitions = new Map();
  const createdStores = [];
  const openVersions = [];
  let currentVersion = version;
  for (const [name, entries] of Object.entries(stores)) {
    backing.set(
      name,
      new Map(entries instanceof Map ? entries : Object.entries(entries)),
    );
    const keyPath = Object.hasOwn(keyPaths, name)
      ? keyPaths[name]
      : name === 'reta_final_drafts'
        ? 'draftId'
        : name === 'reta_final_journal'
          ? 'id'
          : null;
    definitions.set(name, { keyPath });
  }

  let nextWriteFailure = null;
  const writeFailuresByStore = new Map();
  const syncWriteFailuresByStore = new Map();
  let nextCommitGate = null;
  let lastTransaction = null;
  let readwriteTail = Promise.resolve();

  function connect() {
    let closed = false;
    return {
      get objectStoreNames() {
        return {
          contains: (name) => backing.has(name),
          get length() {
            return backing.size;
          },
          item: (index) => [...backing.keys()][index] ?? null,
          [Symbol.iterator]: function* () {
            yield* backing.keys();
          },
        };
      },
      createObjectStore(name, options = {}) {
        if (backing.has(name))
          throw namedError('ConstraintError', 'Store already exists');
        backing.set(name, new Map());
        definitions.set(name, { keyPath: options.keyPath ?? null });
        createdStores.push({ name, keyPath: options.keyPath ?? null });
        return { name, keyPath: options.keyPath ?? null };
      },
      transaction(storeNames, mode = 'readonly') {
        if (closed)
          throw namedError(
            'InvalidStateError',
            'Database connection is closed',
          );
        const names = Array.isArray(storeNames) ? storeNames : [storeNames];
        for (const name of names) {
          if (!backing.has(name))
            throw namedError('NotFoundError', 'Object store not found');
        }

        const staged = new Map(names.map((name) => [name, new Map()]));
        const removed = new Map(names.map((name) => [name, new Set()]));
        let pending = 0;
        let issued = false;
        let finishScheduled = false;
        let aborted = false;
        let completed = false;
        let releaseReadwrite;
        let releasedReadwrite = false;
        const previousReadwrite = mode === 'readwrite' ? readwriteTail : Promise.resolve();
        if (mode === 'readwrite') {
          readwriteTail = new Promise((resolve) => {
            releaseReadwrite = resolve;
          });
        }
        const releaseTurn = () => {
          if (mode !== 'readwrite' || releasedReadwrite) return;
          releasedReadwrite = true;
          releaseReadwrite();
        };
        const tx = {
          error: null,
          oncomplete: null,
          onerror: null,
          onabort: null,
          objectStore(name) {
            if (!names.includes(name))
              throw namedError('NotFoundError', 'Store not in transaction');
            return {
              get(key) {
                return enqueue((request) => {
                  const value = staged.get(name).has(key)
                    ? staged.get(name).get(key)
                    : removed.get(name).has(key)
                      ? undefined
                      : backing.get(name).get(key);
                  request.result = copy(value);
                }, false, name);
              },
              getAll() {
                return enqueue((request) => {
                  const records = new Map(backing.get(name));
                  for (const key of removed.get(name)) records.delete(key);
                  for (const [key, value] of staged.get(name)) records.set(key, value);
                  request.result = copy([...records.values()]);
                }, false, name);
              },
              put(value, explicitKey) {
                const syncFailure = syncWriteFailuresByStore.get(name);
                if (syncFailure) {
                  syncWriteFailuresByStore.delete(name);
                  throw syncFailure;
                }
                return enqueue((request) => {
                  const keyPath = definitions.get(name)?.keyPath;
                  const key =
                    explicitKey ?? (keyPath ? value?.[keyPath] : undefined);
                  if (key === undefined)
                    throw namedError('DataError', 'A record key is required');
                  removed.get(name).delete(key);
                  staged.get(name).set(key, copy(value));
                  request.result = key;
                }, true, name);
              },
              delete(key) {
                return enqueue(() => {
                  staged.get(name).delete(key);
                  removed.get(name).add(key);
                }, true, name);
              },
            };
          },
          abort() {
            if (completed || aborted) return;
            aborted = true;
            completed = true;
            tx.error ||= namedError('AbortError', 'Transaction interrupted');
            tx.onabort?.({ target: tx });
            previousReadwrite.then(releaseTurn);
          },
        };
        lastTransaction = tx;

        function enqueue(action, isWrite = false, storeName) {
          const request = {
            onsuccess: null,
            onerror: null,
            result: undefined,
            error: null,
          };
          issued = true;
          pending += 1;
          previousReadwrite.then(() => queueMicrotask(() => {
            if (aborted) return;
            const storeFailure = writeFailuresByStore.get(storeName);
            if (isWrite && (storeFailure || nextWriteFailure)) {
              const error = storeFailure || nextWriteFailure;
              if (storeFailure) writeFailuresByStore.delete(storeName);
              else nextWriteFailure = null;
              request.error = error;
              tx.error = error;
              request.onerror?.({ target: request, preventDefault() {} });
              tx.onerror?.({ target: tx, preventDefault() {} });
              tx.abort();
              return;
            }
            try {
              action(request);
              request.onsuccess?.({ target: request });
              pending -= 1;
              finishIfIdle();
            } catch (error) {
              request.error = error;
              tx.error = error;
              request.onerror?.({ target: request, preventDefault() {} });
              tx.onerror?.({ target: tx, preventDefault() {} });
              tx.abort();
            }
          }));
          return request;
        }

        function finishIfIdle() {
          if (!issued || pending !== 0 || finishScheduled || completed) return;
          finishScheduled = true;
          queueMicrotask(async () => {
            if (aborted || completed) return;
            if (mode === 'readwrite') {
              const gate = nextCommitGate || commitGate;
              nextCommitGate = null;
              if (gate) await gate;
            }
            if (aborted || completed) return;
            if (mode === 'readwrite') {
              for (const name of names) {
                for (const key of removed.get(name))
                  backing.get(name).delete(key);
                for (const [key, value] of staged.get(name))
                  backing.get(name).set(key, copy(value));
              }
            }
            completed = true;
            tx.oncomplete?.({ target: tx });
            releaseTurn();
          });
        }

        return tx;
      },
      close() {
        closed = true;
      },
    };
  }

  const database = connect();

  function open(_name, requestedVersion) {
    const targetVersion = requestedVersion ?? currentVersion;
    const request = {
      error: null,
      result: undefined,
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
    };
    openVersions.push(targetVersion);
    queueMicrotask(() => {
      if (targetVersion < currentVersion) {
        request.error = namedError('VersionError', 'Requested version is older');
        request.onerror?.({ target: request, preventDefault() {} });
        return;
      }
      request.result = connect();
      if (targetVersion > currentVersion) {
        const oldVersion = currentVersion;
        try {
          request.onupgradeneeded?.({
            target: request,
            oldVersion,
            newVersion: targetVersion,
          });
          currentVersion = targetVersion;
        } catch (error) {
          request.error = error;
          request.onerror?.({ target: request, preventDefault() {} });
          return;
        }
      }
      request.onsuccess?.({ target: request });
    });
    return request;
  }

  return {
    database,
    reopen: connect,
    indexedDB: { open },
    get version() {
      return currentVersion;
    },
    get openVersions() {
      return [...openVersions];
    },
    get createdStores() {
      return createdStores.map(({ name, keyPath }) => ({ name, keyPath }));
    },
    failNextWrite(
      error = namedError('QuotaExceededError', 'Storage quota exceeded'),
    ) {
      nextWriteFailure = error;
    },
    failNextWriteInStore(
      name,
      error = namedError('QuotaExceededError', `Storage quota exceeded in ${name}`),
    ) {
      writeFailuresByStore.set(name, error);
    },
    throwNextWriteInStore(name, error = namedError('DataCloneError', `Synchronous write failure in ${name}`)) {
      syncWriteFailuresByStore.set(name, error);
    },
    holdNextCommit(gate) {
      nextCommitGate = gate;
    },
    get lastTransaction() {
      return lastTransaction;
    },
    getRecord(storeName, key) {
      return copy(backing.get(storeName)?.get(key));
    },
    setRecord(storeName, key, value) {
      backing.get(storeName)?.set(key, copy(value));
    },
    storeNames() {
      return [...backing.keys()];
    },
    keyPath(storeName) {
      return definitions.get(storeName)?.keyPath ?? null;
    },
    journalKeys() {
      return [...(backing.get('reta_final_journal')?.keys() || [])];
    },
  };
}

export { namedError };
