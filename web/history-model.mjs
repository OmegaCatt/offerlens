import { FIELD_KEYS, importReport } from './engine.mjs';
import { validateRequirement } from './workspace.mjs';

export const LIMITS = Object.freeze({ cases: 20, revisions: 10, bytes: 10_000_000, snapshotBytes: 1_000_000 });
const byteSize = value => new TextEncoder().encode(JSON.stringify(value)).length;
const isId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);

export function cleanSnapshot(requirements, offers) {
  const checkedRequirement = validateRequirement(requirements);
  if (!Array.isArray(offers) || offers.length > 30) throw Error('Případ smí mít nejvýše 30 nabídek.');
  const checked = importReport(JSON.stringify({ version: 1, requirements: checkedRequirement, offers }), checkedRequirement);
  const ids = new Set();
  const snapshot = {
    format: 'offerlens-workspace', version: 1, requirements: checkedRequirement,
    offers: checked.map((offer, index) => {
      const original = offers[index];
      if (!isId(original.id) || ids.has(original.id)) throw Error('Nabídky vyžadují jedinečná stabilní ID.');
      ids.add(original.id);
      return { id: original.id, origin: ['prepared','manual','ai','imported'].includes(original.origin) ? original.origin : 'imported',
        raw: offer.raw, fields: offer.fields, evidence: offer.evidence,
        reviewed: original.reviewed === true, productMatch: typeof original.productMatch === 'boolean' ? original.productMatch : null };
    })
  };
  if (byteSize(snapshot) > LIMITS.snapshotBytes) throw Error('Limit jednoho případu je 1 MB.');
  return snapshot;
}

export function restoreSnapshot(snapshot) {
  if (snapshot?.format !== 'offerlens-workspace' || snapshot.version !== 1) throw Error('Nepodporovaná uložená verze.');
  const checked = cleanSnapshot(snapshot.requirements, snapshot.offers);
  const offers = importReport(JSON.stringify({ version: 1, requirements: checked.requirements, offers: checked.offers }), checked.requirements);
  offers.forEach((offer, index) => { offer.id = checked.offers[index].id; });
  return { requirements: checked.requirements, offers };
}

export async function prepareSnapshot(requirements, offers) {
  const snapshot = cleanSnapshot(requirements, offers);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(snapshot)));
  return { snapshot, fingerprint: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('') };
}

export function diffSnapshots(previous, current) {
  const changes = [];
  const add = (path, before, after) => { if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ path, before: before ?? null, after: after ?? null }); };
  if (!previous) return [{ path: 'case.created', before: null, after: 'První zachovaná verze' }];
  for (const key of Object.keys(current.requirements)) add('requirements.' + key, previous.requirements[key], current.requirements[key]);
  const oldOffers = new Map(previous.offers.map(offer => [offer.id, offer]));
  const newOffers = new Map(current.offers.map(offer => [offer.id, offer]));
  for (const id of new Set([...oldOffers.keys(), ...newOffers.keys()])) {
    const before = oldOffers.get(id), after = newOffers.get(id);
    if (!before || !after) { add('offers.' + id, before, after); continue; }
    for (const key of FIELD_KEYS) add(`offers.${id}.fields.${key}`, before.fields[key], after.fields[key]);
    for (const key of ['raw','evidence','reviewed','productMatch']) add(`offers.${id}.${key}`, before[key], after[key]);
  }
  return changes;
}

function titleValue(title) {
  if (typeof title !== 'string' || title.trim().length < 2 || title.length > 100 || /[\u0000-\u001f]/.test(title)) throw Error('Název musí mít 2–100 znaků bez řídicích znaků.');
  return title.trim();
}

export function nextRevision(existing, prepared, { id, title, message, expectedRevision }, now = new Date().toISOString()) {
  title = titleValue(title);
  if (!isId(id) || !/^[a-f0-9]{64}$/.test(prepared.fingerprint)) throw Error('Neplatný identifikátor nebo otisk případu.');
  if (typeof message !== 'string' || message.trim().length < 5 || message.length > 300 || /[\u0000-\u001f]/.test(message)) throw Error('Důvod uložení musí mít 5–300 znaků bez řídicích znaků.');
  if (!Number.isFinite(Date.parse(now))) throw Error('Neplatný čas verze.');
  const snapshot = cleanSnapshot(prepared.snapshot.requirements, prepared.snapshot.offers);
  if (existing && (existing.id !== id || existing.version !== 1 || !Number.isSafeInteger(existing.revision) || !Array.isArray(existing.revisions) || !existing.revisions.length)) throw Error('Uložený případ je poškozený.');
  if ((existing?.revision ?? 0) !== expectedRevision) throw Error('Případ mezitím změnila jiná karta. Otevřete aktuální verzi nebo uložte svou práci jako kopii.');
  const last = existing?.revisions.at(-1);
  if (last?.fingerprint === prepared.fingerprint && existing.title === title) return { record: existing, unchanged: true };
  const number = (existing?.revision ?? 0) + 1;
  if (!Number.isSafeInteger(number)) throw Error('Číslo verze překročilo limit.');
  const revisions = [...(existing?.revisions ?? []), { number, title, savedAt: now, message: message.trim(), fingerprint: prepared.fingerprint, snapshot }].slice(-LIMITS.revisions);
  return { record: { id, version: 1, title, createdAt: existing?.createdAt ?? now, updatedAt: now, revision: number, revisions }, unchanged: false };
}

export function enforceStorageBudget(records) {
  if (records.length > LIMITS.cases) throw Error('Limit je 20 místních poptávek. Exportujte a odstraňte nepotřebný případ.');
  if (byteSize(records) > LIMITS.bytes) throw Error('Místní historie překročila 10 MB. Exportujte a odstraňte nepotřebné případy.');
}
