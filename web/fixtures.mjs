export const requirement = Object.freeze({ product: 'Kancelářský monitor 27″', quantity: 10, maxDays: 14, minWarrantyMonths: 24, budgetHalers: 9000000, currency: 'CZK' });

export const demoOffers = [
  {
    id: 'aurora', origin: 'prepared', productMatch: true, name: 'Aurora Office', raw: 'Aurora Office — nabídka AO-1047\nMonitor 27″ IPS, 10 kusů. Jednotková cena 6 900 Kč bez DPH. Doprava 790 Kč bez DPH. DPH 21 %. Dodání do 7 dnů. Záruka 36 měsíců.',
    fields: { supplier: 'Aurora Office', product: 'Monitor 27″ IPS', quantity: 10, unitPrice: '6 900 Kč', priceVat: 'excl', shippingPrice: '790 Kč', shippingVat: 'excl', vatRate: 21, leadDays: 7, warrantyMonths: 36, currency: 'CZK' },
    evidence: { supplier: 'Aurora Office', product: 'Monitor 27″ IPS', quantity: '10 kusů', unitPrice: '6 900 Kč bez DPH', priceVat: 'bez DPH', shippingPrice: 'Doprava 790 Kč bez DPH', shippingVat: 'Doprava 790 Kč bez DPH', vatRate: 'DPH 21 %', leadDays: 'Dodání do 7 dnů', warrantyMonths: 'Záruka 36 měsíců', currency: 'Kč' }
  },
  {
    id: 'nova', origin: 'prepared', productMatch: true, name: 'Nova Display', raw: 'Nova Display — nabídka ND-220\n10× Monitor 27″ IPS. Cena za kus 7 950 Kč včetně DPH 21 %. Doprava zdarma. Dodání do 21 dnů od objednávky. Záruka 24 měsíců.',
    fields: { supplier: 'Nova Display', product: 'Monitor 27″ IPS', quantity: 10, unitPrice: '7 950 Kč', priceVat: 'incl', shippingPrice: '0 Kč', shippingVat: 'incl', vatRate: 21, leadDays: 21, warrantyMonths: 24, currency: 'CZK' },
    evidence: { supplier: 'Nova Display', product: 'Monitor 27″ IPS', quantity: '10×', unitPrice: '7 950 Kč včetně DPH', priceVat: 'včetně DPH', shippingPrice: 'Doprava zdarma', shippingVat: 'Doprava zdarma', vatRate: 'DPH 21 %', leadDays: 'Dodání do 21 dnů', warrantyMonths: 'Záruka 24 měsíců', currency: 'Kč' }
  },
  {
    id: 'pixel', origin: 'prepared', productMatch: true, name: 'Pixel Trade', raw: 'Pixel Trade / PT-882\nMonitor 27″ IPS, 10 ks. 6 690 Kč za kus bez DPH, sazba DPH 21 %. Expedice do 5 pracovních dnů. Záruka 12 měsíců. Doprava bude upřesněna po potvrzení objednávky.',
    fields: { supplier: 'Pixel Trade', product: 'Monitor 27″ IPS', quantity: 10, unitPrice: '6 690 Kč', priceVat: 'excl', shippingPrice: null, shippingVat: 'unknown', vatRate: 21, leadDays: null, warrantyMonths: 12, currency: 'CZK' },
    evidence: { supplier: 'Pixel Trade', product: 'Monitor 27″ IPS', quantity: '10 ks', unitPrice: '6 690 Kč za kus bez DPH', priceVat: 'bez DPH', vatRate: 'DPH 21 %', warrantyMonths: 'Záruka 12 měsíců', currency: 'Kč' }
  }
];
