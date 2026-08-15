import { useState, type ChangeEvent, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { X, Plus } from 'lucide-react';
import {
  getSensitiveWords,
  setSensitiveWords,
} from '@client/src/lib/storage';
import { logger } from '@lark-apaas/client-toolkit/logger';

interface SensitiveWordsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// 内置敏感词数量（模拟）
const BUILTIN_COUNT = 50;

const SensitiveWordsDialog: React.FC<SensitiveWordsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [words, setWords] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState<string>('');

  // 打开时加载
  useEffect(() => {
    if (open) {
      setWords(getSensitiveWords());
      setInputValue('');
    }
  }, [open]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setInputValue(e.target.value.slice(0, 20));
  };

  const handleAdd = (): void => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (words.includes(trimmed)) {
      setInputValue('');
      return;
    }
    const next = [...words, trimmed];
    setWords(next);
    try {
      setSensitiveWords(next);
    } catch (err) {
      logger.error('save sensitive words failed', err);
    }
    setInputValue('');
  };

  const handleDelete = (word: string): void => {
    const next = words.filter((w: string) => w !== word);
    setWords(next);
    try {
      setSensitiveWords(next);
    } catch (err) {
      logger.error('save sensitive words failed', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-sm mx-4 max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>敏感词管理</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto flex-1">
          {/* 添加输入 */}
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="输入敏感词"
              maxLength={20}
              className="h-10 flex-1"
            />
            <Button
              onClick={handleAdd}
              disabled={!inputValue.trim()}
              className="h-10 rounded-xl"
            >
              <Plus className="w-4 h-4 mr-1" />
              添加
            </Button>
          </div>

          {/* 敏感词列表 */}
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {words.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                暂无自定义敏感词
              </p>
            ) : (
              words.map((word: string) => (
                <div
                  key={word}
                  className="flex items-center justify-between p-3 rounded-lg bg-accent/30"
                >
                  <span className="text-sm text-foreground">{word}</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(word)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    aria-label={`删除${word}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-3 text-xs text-muted-foreground text-center border-t border-border/50">
          内置敏感词库 {BUILTIN_COUNT} 个 + {words.length} 个自定义敏感词
        </div>

        <DialogFooter className="pt-3">
          <Button onClick={() => onOpenChange(false)} className="rounded-xl">
            完成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SensitiveWordsDialog;
