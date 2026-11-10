import { enforceStorageBudget, nextRevision } from './history-model.mjs';

export const DATABASE_NAME = 'offerlens-local-v1';
export function createHistoryStore({databaseName=DATABASE_NAME,revisionBuilder=nextRevision,budgetChecker=enforceStorageBudget}={}){
const STORE = 'cases';

async function openDatabase() {
  if (!globalThis.indexedDB) throw Error('Tento prohlížeč nepodporuje místní historii. Použijte export JSON.');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(Error('Místní historii nelze otevřít. Použijte export JSON.'));
    request.onblocked = () => reject(Error('Úložiště blokuje jiná otevřená karta. Zavřete ji a zkuste znovu.'));
  });
}

async function transaction(mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, mode), store = tx.objectStore(STORE);
    let value, error;
    const set = next => { value = next; };
    const fail = caught => { error = caught; tx.abort(); };
    tx.oncomplete = () => { database.close(); resolve(value); };
    tx.onabort = () => { database.close(); reject(error || Error('Místní zápis selhal; původní historie zůstala zachovaná.')); };
    tx.onerror = () => { error ||= Error('Úložiště není dostupné nebo je plné. Použijte export JSON.'); };
    try { operation(store, set, fail); } catch (caught) { fail(caught); }
  });
}

async function listCases() {
  return transaction('readonly', (store, set, fail) => {
    const request = store.getAll();
    request.onsuccess = () => {
      try { set(request.result.map(({ id, title, revision, updatedAt }) => ({ id, title, revision, updatedAt })).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))); }
      catch { fail(Error('Místní seznam je poškozený. Použijte svůj export JSON.')); }
    };
  });
}

async function readCase(id) {
  return transaction('readonly', (store, set) => {
    const request = store.get(id);
    request.onsuccess = () => set(request.result ?? null);
  });
}

async function saveCase(prepared, options) {
  return transaction('readwrite', (store, set, fail) => {
    // No await inside this transaction: getAll + conflict check + write are atomic.
    const request = store.getAll();
    request.onsuccess = () => {
      try {
        const records = request.result;
        const existing = records.find(record => record.id === options.id);
        const result = revisionBuilder(existing, prepared, options);
        const updated = records.filter(record => record.id !== options.id).concat(result.record);
        budgetChecker(updated);
        if (!result.unchanged) store.put(result.record);
        set(result);
      } catch (caught) { fail(caught); }
    };
  });
}

async function removeCase(id, expectedRevision) {
  return transaction('readwrite', (store, set, fail) => {
    const request = store.get(id);
    request.onsuccess = () => {
      if (!request.result) { set(false); return; }
      if (request.result.revision !== expectedRevision) { fail(Error('Případ byl změněn v jiné kartě. Obnovte seznam před odstraněním.')); return; }
      store.delete(id); set(true);
    };
  });
}

return {listCases,readCase,saveCase,removeCase};
}
export const {listCases,readCase,saveCase,removeCase}=createHistoryStore();
