export const BASE_SENSITIVE_WORDS: string[] = [
  '傻逼',
  '操你妈',
  '草泥马',
  '去死',
  '废物',
  '滚蛋',
  '脑残',
  '白痴',
  '贱人',
  '王八蛋',
  '狗东西',
  '杂种',
];

export function filterSensitiveWords(
  text: string,
  customWords: string[],
): string {
  const allWords = [...BASE_SENSITIVE_WORDS, ...customWords].filter(Boolean);
  if (allWords.length === 0) return text;

  let result = text;
  for (const word of allWords) {
    if (!word) continue;
    const mask = '*'.repeat(word.length);
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    result = result.replace(regex, mask);
  }
  return result;
}

export function validateSensitiveWord(word: string): boolean {
  const trimmed = word.trim();
  if (trimmed.length < 1 || trimmed.length > 20) return false;
  // 不允许纯空格或仅符号
  if (!/[\u4e00-\u9fa5a-zA-Z0-9]/.test(trimmed)) return false;
  return true;
}
