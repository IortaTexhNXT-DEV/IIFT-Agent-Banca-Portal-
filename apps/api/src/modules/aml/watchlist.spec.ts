import { parseCsv } from './watchlist.service.js';

describe('parseCsv', () => {
  it('handles quoted fields, escaped quotes and CRLF line endings', () => {
    const rows = parseCsv('list_name,full_name\r\nUN,"Doe, John ""JJ"""\r\nLOCAL,Ali\n');
    expect(rows).toEqual([
      ['list_name', 'full_name'],
      ['UN', 'Doe, John "JJ"'],
      ['LOCAL', 'Ali'],
    ]);
  });
});
