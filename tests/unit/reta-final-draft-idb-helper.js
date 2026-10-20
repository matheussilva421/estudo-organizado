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
} = {}) {
  const backing = new Map();
  const definitions = new Map();
  for (const [name, entries] of Object.entries(stores)) {
    backing.set(
      name,
      new Map(entries instanceof Map ? entries : Object.entries(entries)),
    );
    const keyPath =
      name === 'reta_final_drafts'
        ? 'draftId'
        : name === 'reta_final_journal'
          ? 'id'
          : null;
    definitions.set(name, { keyPath });
  }

  let nextWriteFailure = null;
  let lastTransaction = null;

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
                });
              },
              put(value, explicitKey) {
                return enqueue((request) => {
                  const keyPath = definitions.get(name)?.keyPath;
                  const key =
                    explicitKey ?? (keyPath ? value?.[keyPath] : undefined);
                  if (key === undefined)
                    throw namedError('DataError', 'A record key is required');
                  removed.get(name).delete(key);
                  staged.get(name).set(key, copy(value));
                  request.result = key;
                }, true);
              },
              delete(key) {
                return enqueue(() => {
                  staged.get(name).delete(key);
                  removed.get(name).add(key);
                }, true);
              },
            };
          },
          abort() {
            if (completed || aborted) return;
            aborted = true;
            completed = true;
            tx.error ||= namedError('AbortError', 'Transaction interrupted');
            tx.onabort?.({ target: tx });
          },
        };
        lastTransaction = tx;

        function enqueue(action, isWrite = false) {
          const request = {
            onsuccess: null,
            onerror: null,
            result: undefined,
            error: null,
          };
          issued = true;
          pending += 1;
          queueMicrotask(() => {
            if (aborted) return;
            if (isWrite && nextWriteFailure) {
              const error = nextWriteFailure;
              nextWriteFailure = null;
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
          });
          return request;
        }

        function finishIfIdle() {
          if (!issued || pending !== 0 || finishScheduled || completed) return;
          finishScheduled = true;
          queueMicrotask(async () => {
            if (aborted || completed) return;
            if (mode === 'readwrite' && commitGate) await commitGate;
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
  return {
    database,
    reopen: connect,
    failNextWrite(
      error = namedError('QuotaExceededError', 'Storage quota exceeded'),
    ) {
      nextWriteFailure = error;
    },
    get lastTransaction() {
      return lastTransaction;
    },
    getRecord(storeName, key) {
      return copy(backing.get(storeName)?.get(key));
    },
    storeNames() {
      return [...backing.keys()];
    },
    keyPath(storeName) {
      return definitions.get(storeName)?.keyPath ?? null;
    },
  };
}

export { namedError };
