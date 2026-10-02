import type { Nominee } from '../../api/types';
import { nomineeRows, toNomineeInputs } from './NomineesEditor';

const spouse: Nominee = {
  id: 'nominee-1',
  fullName: 'Siti Rahmah',
  relationship: 'SPOUSE',
  role: 'NOMINEE',
  sharePercent: '60.00',
  idNumberMasked: '00-****12',
};

describe('nomineeRows', () => {
  it('starts with a single full-share nominee row when there are no nominees', () => {
    expect(nomineeRows([])).toEqual([{ role: 'NOMINEE', sharePercent: 100 }]);
  });

  it('carries the id and masked ID number of existing nominees', () => {
    expect(nomineeRows([spouse])).toEqual([
      {
        id: 'nominee-1',
        fullName: 'Siti Rahmah',
        relationship: 'SPOUSE',
        role: 'NOMINEE',
        sharePercent: 60,
        idNumberMasked: '00-****12',
      },
    ]);
  });

  it('converts decimal-string shares to numbers', () => {
    const rows = nomineeRows([spouse, { ...spouse, id: 'nominee-2', sharePercent: '40.5' }]);
    expect(rows.map((row) => row.sharePercent)).toEqual([60, 40.5]);
  });
});

describe('toNomineeInputs', () => {
  it('returns no inputs when the form has no rows', () => {
    expect(toNomineeInputs(undefined)).toEqual([]);
  });

  it('keeps the id of an existing nominee and trims the text fields', () => {
    const [input] = toNomineeInputs([
      {
        id: 'nominee-1',
        fullName: '  Siti Rahmah ',
        idNumber: ' 01-234567 ',
        relationship: 'SPOUSE',
        role: 'BENEFICIARY',
        sharePercent: 100,
      },
    ]);
    expect(input).toEqual({
      id: 'nominee-1',
      fullName: 'Siti Rahmah',
      idNumber: '01-234567',
      relationship: 'SPOUSE',
      role: 'BENEFICIARY',
      sharePercent: 100,
    });
  });

  it('drops a blank ID number so the stored one is kept', () => {
    const [input] = toNomineeInputs([
      { id: 'nominee-1', fullName: 'Siti Rahmah', idNumber: '   ', idNumberMasked: '00-****12' },
    ]);
    expect(input.idNumber).toBeUndefined();
    expect(input).not.toHaveProperty('idNumberMasked');
  });

  it('sends new rows without an id and fills defaults for missing fields', () => {
    expect(toNomineeInputs([{ id: '', fullName: 'Ahmad' }])).toEqual([
      {
        id: undefined,
        fullName: 'Ahmad',
        idNumber: undefined,
        relationship: '',
        role: 'NOMINEE',
        sharePercent: 0,
      },
    ]);
  });

  it('round-trips existing nominees without changing them', () => {
    const [input] = toNomineeInputs(nomineeRows([spouse]));
    expect(input).toMatchObject({ id: 'nominee-1', sharePercent: 60, idNumber: undefined });
  });
});
