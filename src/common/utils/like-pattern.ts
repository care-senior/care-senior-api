const LIKE_SPECIAL_CHARACTERS = /[\\%_]/g;

export function containsPattern(text: string): string {
  return `%${text.replace(LIKE_SPECIAL_CHARACTERS, '\\$&')}%`;
}
