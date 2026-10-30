export const FIELD_KEYS = ['supplier','product','quantity','unitPrice','priceVat','shippingPrice','shippingVat','vatRate','leadDays','warrantyMonths','currency'];
export const VAT_MODES = ['incl','excl','unknown'];
export function parseHalers(value) {
  if (value === null || value === undefined) return null;
  let s = String(value).trim().replace(/\u00a0/g, ' ').replace(/\s*Kč\s*$/i, '').replace(/(?<=\d)\s+(?=\d)/g, '');
  if (!/^\d{1,8}(?:[,.]\d{1,2})?$/.test(s)) return null;
  const [whole, fraction = ''] = s.replace(',', '.').split('.');
  const n = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return n > 0 || s === '0' || s === '0,00' || s === '0.00' ? n : null;
}
export const formatCzk = halers => halers === null ? '—' : `${new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(halers / 100)} Kč`;
const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
export function validateEvidence(raw, fields, evidence) {
  const safe = { ...fields }, flags = [];
  for (const key of FIELD_KEYS) {
    if (safe[key] === null || safe[key] === undefined || safe[key] === '' || safe[key] === 'unknown') continue;
    const quote = evidence?.[key];
    if (typeof quote !== 'string' || !quote.trim() || !raw.includes(quote.trim())) { safe[key] = null; flags.push(key); }
  }
  return { fields: safe, unsupported: flags };
}
export function evaluateOffer(offer, requirements) {
  const f = offer.fields;
  const issues = [], unknown = [];
  if (offer.productMatch === false) issues.push('Produkt neodpovídá poptávce');
  else if (offer.productMatch !== true) unknown.push('Shoda produktu s poptávkou není potvrzena');
  if (!f.product) unknown.push('Popis produktu chybí');
  if (f.currency !== requirements.currency) (f.currency ? issues : unknown).push('Měna není potvrzena v CZK');
  if (!integer(f.quantity, 1, 100000)) unknown.push('Počet kusů chybí');
  else if (f.quantity !== requirements.quantity) issues.push(`Počet kusů: ${f.quantity} místo ${requirements.quantity}`);
  if (!integer(f.leadDays, 0, 365)) unknown.push('Termín dodání není jednoznačný');
  else if (f.leadDays > requirements.maxDays) issues.push(`Dodání ${f.leadDays} dní překračuje limit ${requirements.maxDays}`);
  if (!integer(f.warrantyMonths, 0, 240)) unknown.push('Záruka není potvrzena');
  else if (f.warrantyMonths < requirements.minWarrantyMonths) issues.push(`Záruka ${f.warrantyMonths} měsíců je příliš krátká`);
  if (offer.origin !== 'prepared' && !offer.reviewed) unknown.push('Údaje čekají na lidské potvrzení');
  const unit = parseHalers(f.unitPrice), shipping = parseHalers(f.shippingPrice);
  if (unit === null) unknown.push('Jednotková cena chybí nebo má neplatný formát');
  if (shipping === null) unknown.push('Cena dopravy není potvrzena');
  if (!VAT_MODES.includes(f.priceVat) || f.priceVat === 'unknown') unknown.push('DPH u jednotkové ceny není potvrzena');
  if (shipping !== 0 && (!VAT_MODES.includes(f.shippingVat) || f.shippingVat === 'unknown')) unknown.push('DPH u dopravy není potvrzena');
  if (!integer(f.vatRate, 0, 30)) unknown.push('Sazba DPH není potvrzena');
  let totalHalers = null;
  if (unit !== null && shipping !== null && integer(f.quantity, 1, 100000) && integer(f.vatRate, 0, 30) && ['incl','excl'].includes(f.priceVat) && (shipping === 0 || ['incl','excl'].includes(f.shippingVat)) && f.currency === 'CZK') {
    const withVat = (v, mode) => mode === 'incl' ? v : Math.round(v * (100 + f.vatRate) / 100);
    totalHalers = withVat(unit * f.quantity, f.priceVat) + withVat(shipping, f.shippingVat);
    if (totalHalers > requirements.budgetHalers) issues.push(`Celkem ${formatCzk(totalHalers)} překračuje rozpočet ${formatCzk(requirements.budgetHalers)}`);
  }
  const status = issues.length ? 'blocked' : unknown.length || totalHalers === null ? 'review' : 'eligible';
  return { ...offer, totalHalers, status, issues, unknown };
}
export function compareOffers(offers, requirements) {
  const evaluated = offers.map(offer => evaluateOffer(offer, requirements));
  const eligible = evaluated.filter(x => x.status === 'eligible').sort((a,b) => a.totalHalers - b.totalHalers);
  return { offers: evaluated, recommendedId: eligible[0]?.id ?? null, eligibleCount: eligible.length, blockedCount: evaluated.filter(x => x.status === 'blocked').length, reviewCount: evaluated.filter(x => x.status === 'review').length };
}
const csvCell = value => {
  let text = String(value ?? '');
  // Spreadsheet programs may evaluate imported cells as formulas.
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
};
export function comparisonCsv(comparison) {
  const rows = [
    ['Dodavatel','Produkt','Počet','Cena za kus','DPH ceny','Doprava','DPH dopravy','Sazba DPH','Dodání (dny)','Záruka (měsíce)','Měna','Celkem včetně DPH (Kč)','Stav','Problémy','K ověření'],
    ...comparison.offers.map(o => [o.name,o.fields.product,o.fields.quantity,o.fields.unitPrice,o.fields.priceVat,o.fields.shippingPrice,o.fields.shippingVat,o.fields.vatRate,o.fields.leadDays,o.fields.warrantyMonths,o.fields.currency,o.totalHalers === null ? '' : (o.totalHalers / 100).toFixed(2).replace('.', ','),o.status,o.issues.join('; '),o.unknown.join('; ')])
  ];
  return '\ufeff' + rows.map(row => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}
export function validateAiPayload(raw, payload) {
  if (!payload || typeof payload !== 'object' || !payload.fields || !Array.isArray(payload.evidence)) throw new Error('AI vrátila neúplný výstup.');
  const fields = Object.fromEntries(FIELD_KEYS.map(k => [k, payload.fields[k] ?? null]));
  for (const k of ['priceVat','shippingVat']) if (!VAT_MODES.includes(fields[k])) fields[k] = 'unknown';
  for (const k of ['quantity','vatRate','leadDays','warrantyMonths']) if (fields[k] !== null && !integer(fields[k], 0, 100000)) fields[k] = null;
  const evidence = {};
  for (const item of payload.evidence.slice(0, 30)) if (FIELD_KEYS.includes(item?.field) && typeof item?.quote === 'string' && item.quote.length <= 200) evidence[item.field] = item.quote;
  const checked = validateEvidence(raw, fields, evidence);
  for (const key of checked.unsupported) delete evidence[key];
  return { fields: checked.fields, evidence, unsupported: checked.unsupported };
}
