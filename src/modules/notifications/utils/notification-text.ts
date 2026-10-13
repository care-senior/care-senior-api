const BRASILIA_DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
});

const BRASILIA_TIME = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  timeStyle: 'short',
});

// Notification texts are product content (Portuguese), and the clinics are
// all in Brasília time until a clinic time zone is modeled.
export function formatDateTime(date: Date): string {
  return BRASILIA_DATE_TIME.format(date);
}

export function formatTime(date: Date): string {
  return BRASILIA_TIME.format(date);
}

export function excerpt(text: string, maxLength = 140): string {
  return text.length <= maxLength
    ? text
    : `${text.slice(0, maxLength - 1).trimEnd()}…`;
}
