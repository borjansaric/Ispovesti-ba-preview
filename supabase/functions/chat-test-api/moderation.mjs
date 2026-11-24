// Free, deterministic review signals for the Ispovesti.ba test chat.
// These rules only flag messages for an administrator; they never hide or delete content.
const normalize = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('sr-Latn');

export function classifyChatMessage(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  const text = normalize(raw);
  const flags = [];

  if (/\b(?:ubicu te|ubit cu te|ubiti cu te|zaklacu te|znam gdje zivis|znam gdje stanujes)\b/.test(text)) {
    flags.push('possible_threat');
  }
  if (/\b(?:brza zarada|garantovana zarada|sigurna zarada|zarada bez rada|laka zarada|uplati odmah|investiraj odmah|bonus bez depozita|posao preko telegrama)\b/.test(text)) {
    flags.push('promotional_spam');
  }

  const digits = (raw.match(/\d/g) || []).length;
  if (digits >= 9 && digits <= 15 && /\+?\d(?:[\s().-]*\d){7,}/.test(raw)) {
    flags.push('possible_phone_number');
  }

  const letters = raw.match(/\p{L}/gu) || [];
  const uppercase = raw.match(/\p{Lu}/gu) || [];
  if (letters.length >= 24 && uppercase.length / letters.length >= 0.88) {
    flags.push('excessive_caps');
  }

  if (/\b([\p{L}\p{N}]{2,}(?:\s+[\p{L}\p{N}]{2,}){0,2})\b(?:\s+\1){2,}/iu.test(text)) {
    flags.push('repeated_phrase');
  }

  return [...new Set(flags)];
}
