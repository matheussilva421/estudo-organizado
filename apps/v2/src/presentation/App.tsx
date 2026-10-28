import { useEffect, useState } from 'react';
import { openV2Database } from '../platform/indexeddb';

export function App() {
  const [databaseReady, setDatabaseReady] = useState(false);

  useEffect(() => {
    let active = true;
    openV2Database('local-default')
      .then(() => {
        if (active) setDatabaseReady(true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="app-shell" data-db-ready={databaseReady ? 'true' : 'false'}>
      <h1>Estudo Organizado V2</h1>
      <p>Fundação local isolada da V1.</p>
    </main>
  );
}
