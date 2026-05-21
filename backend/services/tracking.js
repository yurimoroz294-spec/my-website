const CARRIERS = [
  {
    name: 'Zásilkovna',
    id:   'zasilkovna',
    pattern: /^[ZzBb]\d{8,12}$|^Z\d{9}$|^\d{10}$/,
    url: n => `https://tracking.packeta.com/?id=${n}`,
  },
  {
    name: 'PPL',
    id:   'ppl',
    pattern: /^[18]\d{17}$|^PPL\d+$/i,
    url: n => `https://www.ppl.cz/main2.aspx?cls=Package&idSearch=${n}`,
  },
  {
    name: 'DPD',
    id:   'dpd',
    pattern: /^0\d{13,17}$/,
    url: n => `https://tracking.dpd.cz/parcelstatus?query=${n}&lang=cs_CZ`,
  },
  {
    name: 'Česká pošta',
    id:   'ceskaposta',
    pattern: /^[A-Z]{2}\d{9}[A-Z]{2}$|^[A-Z]\d{12}$/,
    url: n => `https://www.postaonline.cz/trackandtrace/-/zasilka/cislo/${n}`,
  },
  {
    name: 'GLS',
    id:   'gls',
    pattern: /^\d{11}$/,
    url: n => `https://gls-group.eu/track/${n}`,
  },
];

// Extract potential tracking number from a message and identify carrier
function detect(message) {
  const candidates = message.match(/[A-Z]{0,2}\d{8,18}[A-Z]{0,2}/gi) || [];

  for (const candidate of candidates) {
    const upper = candidate.toUpperCase();
    for (const c of CARRIERS) {
      if (c.pattern.test(upper)) return { number: upper, carrier: c.id, carrierName: c.name };
    }
  }

  // User mentions package without a number
  if (/zásilk|balíčk|doručen|tracking|kde je|sledov/i.test(message)) {
    return { number: null, carrier: null, carrierName: null, needsNumber: true };
  }

  return null;
}

function getStatus(number, carrierId) {
  if (!number) {
    return { number: null, carrier: null, status: 'Sdělte prosím číslo zásilky.', url: null, needsNumber: true };
  }
  const c = CARRIERS.find(x => x.id === carrierId);
  if (!c) return { number, carrier: 'Neznámý', status: `Zásilka ${number} — přepravce nerozpoznán.`, url: null };

  return {
    number,
    carrier: c.name,
    status:  `Zásilka ${number} je u přepravce ${c.name}. Aktuální stav sledujte na odkazu.`,
    url:     c.url(number),
  };
}

module.exports = { detect, getStatus };
