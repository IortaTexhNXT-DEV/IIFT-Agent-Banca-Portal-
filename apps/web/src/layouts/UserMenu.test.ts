import { initials } from './UserMenu';

describe('initials', () => {
  it('uses the first two given names', () => {
    expect(initials('Nurul Huda binti Hassan')).toBe('NH');
  });

  it('skips honorifics and patronymic particles', () => {
    expect(initials('Hajah Siti Aminah binti Haji Osman')).toBe('SA');
    expect(initials('Haji Abdul Rahim bin Haji Salleh')).toBe('AR');
  });
});
