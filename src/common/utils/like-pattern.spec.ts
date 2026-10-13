import { containsPattern } from './like-pattern.js';

describe('containsPattern', () => {
  it('wraps the text with wildcards', () => {
    expect(containsPattern('vida plena')).toBe('%vida plena%');
  });

  it('escapes LIKE wildcards typed by the user', () => {
    expect(containsPattern('100%_off\\')).toBe('%100\\%\\_off\\\\%');
  });
});
