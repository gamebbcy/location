import { useCallback, useEffect, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  getSensitiveWords as getStoredWords,
  setSensitiveWords as setStoredWords,
} from '@client/src/lib/storage';
import {
  BASE_SENSITIVE_WORDS,
  filterSensitiveWords,
  validateSensitiveWord,
} from '@client/src/lib/utils/sensitive';

export function useSensitiveWords() {
  const [customWords, setCustomWords] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = getStoredWords();
      setCustomWords(stored);
    } catch (err) {
      logger.error('load sensitive words failed', err);
    }
  }, []);

  /** 合并内置 + 自定义词库 */
  const words: string[] = [...BASE_SENSITIVE_WORDS, ...customWords];

  /** 添加自定义敏感词，成功返回 true */
  const addWord = useCallback((word: string): boolean => {
    if (!validateSensitiveWord(word)) return false;
    const trimmed = word.trim();
    if (BASE_SENSITIVE_WORDS.includes(trimmed)) return false;

    let success = false;
    setCustomWords((prev) => {
      if (prev.includes(trimmed)) return prev;
      const next = [...prev, trimmed];
      try {
        setStoredWords(next);
        success = true;
        return next;
      } catch (err) {
        logger.error('save sensitive word failed', err);
        return prev;
      }
    });
    return success;
  }, []);

  /** 删除自定义敏感词 */
  const removeWord = useCallback((word: string): void => {
    setCustomWords((prev) => {
      const next = prev.filter((w: string) => w !== word);
      try {
        setStoredWords(next);
      } catch (err) {
        logger.error('remove sensitive word failed', err);
      }
      return next;
    });
  }, []);

  /** 过滤文本中的敏感词 */
  const filter = useCallback(
    (text: string): string => {
      return filterSensitiveWords(text, customWords);
    },
    [customWords],
  );

  /** 保存时过滤（持久化前调用） */
  const filterOnSave = useCallback(
    (text: string): string => filter(text),
    [filter],
  );

  /** 展示时过滤（渲染前调用，用于双重保险） */
  const filterOnDisplay = useCallback(
    (text: string): string => filter(text),
    [filter],
  );

  return {
    words,
    addWord,
    removeWord,
    filter,
    filterOnSave,
    filterOnDisplay,
  };
}
