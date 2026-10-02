import { jaroWinkler, nameSimilarity, normaliseName } from './name-matching.js';

describe('name matching', () => {
  it('normalises case, punctuation, honorifics and common spellings', () => {
    expect(normaliseName('Hj. Mohd Ali bin Abu-Bakar')).toBe('MUHAMMAD ALI BIN ABU BAKAR');
  });

  it('scores identical names 100 regardless of honorific', () => {
    expect(nameSimilarity('Dato Ahmad Zulkifli Hamid', 'Ahmad Zulkifli Hamid')).toBe(100);
  });

  it('scores close transliterations above the default review threshold', () => {
    expect(nameSimilarity('Viktor Petrenkov', 'Viktor Petrenko')).toBeGreaterThanOrEqual(85);
    expect(nameSimilarity('Mohammad Rashid', 'Muhammad Rasheed')).toBeGreaterThanOrEqual(85);
  });

  it('scores unrelated names low', () => {
    expect(nameSimilarity('Siti Aminah binti Osman', 'Viktor Petrenko')).toBeLessThan(60);
  });

  it('implements Jaro-Winkler', () => {
    expect(jaroWinkler('MARTHA', 'MARHTA')).toBeCloseTo(0.961, 3);
    expect(jaroWinkler('ABC', 'XYZ')).toBe(0);
  });
});
