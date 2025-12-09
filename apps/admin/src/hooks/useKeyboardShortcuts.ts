import { useEffect } from 'react';

type ShortcutHandler = () => void;

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: ShortcutHandler;
  description: string;
}

// ショートカット登録用配列（将来の拡張用）
// const registeredShortcuts: Shortcut[] = [];

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 入力フォーカス中は無視
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          shortcut.handler();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

// チャット画面用のショートカット
export function useChatShortcuts(handlers: {
  onSend?: () => void;
  onClose?: () => void;
  onAssign?: () => void;
  onTemplate?: () => void;
  onEscape?: () => void;
  onNextConversation?: () => void;
  onPrevConversation?: () => void;
}) {
  const shortcuts: Shortcut[] = [];

  if (handlers.onSend) {
    shortcuts.push({
      key: 'Enter',
      ctrl: true,
      handler: handlers.onSend,
      description: 'メッセージ送信',
    });
  }

  if (handlers.onClose) {
    shortcuts.push({
      key: 'e',
      ctrl: true,
      handler: handlers.onClose,
      description: '会話を終了',
    });
  }

  if (handlers.onAssign) {
    shortcuts.push({
      key: 'a',
      ctrl: true,
      handler: handlers.onAssign,
      description: '担当者アサイン',
    });
  }

  if (handlers.onTemplate) {
    shortcuts.push({
      key: 't',
      ctrl: true,
      handler: handlers.onTemplate,
      description: 'テンプレート選択',
    });
  }

  if (handlers.onEscape) {
    shortcuts.push({
      key: 'Escape',
      handler: handlers.onEscape,
      description: 'キャンセル/閉じる',
    });
  }

  if (handlers.onNextConversation) {
    shortcuts.push({
      key: 'ArrowDown',
      alt: true,
      handler: handlers.onNextConversation,
      description: '次の会話',
    });
  }

  if (handlers.onPrevConversation) {
    shortcuts.push({
      key: 'ArrowUp',
      alt: true,
      handler: handlers.onPrevConversation,
      description: '前の会話',
    });
  }

  useKeyboardShortcuts(shortcuts);
}

// グローバルショートカット
export function useGlobalShortcuts(handlers: {
  onSearch?: () => void;
  onHelp?: () => void;
  onSettings?: () => void;
}) {
  const shortcuts: Shortcut[] = [];

  if (handlers.onSearch) {
    shortcuts.push({
      key: 'k',
      ctrl: true,
      handler: handlers.onSearch,
      description: '検索',
    });
  }

  if (handlers.onHelp) {
    shortcuts.push({
      key: '?',
      shift: true,
      handler: handlers.onHelp,
      description: 'ヘルプ表示',
    });
  }

  if (handlers.onSettings) {
    shortcuts.push({
      key: ',',
      ctrl: true,
      handler: handlers.onSettings,
      description: '設定',
    });
  }

  useKeyboardShortcuts(shortcuts);
}

// ショートカット一覧表示用
export function getShortcutsList(): { key: string; description: string }[] {
  return [
    { key: 'Ctrl+Enter', description: 'メッセージ送信' },
    { key: 'Ctrl+E', description: '会話を終了' },
    { key: 'Ctrl+A', description: '担当者アサイン' },
    { key: 'Ctrl+T', description: 'テンプレート選択' },
    { key: 'Alt+↓', description: '次の会話' },
    { key: 'Alt+↑', description: '前の会話' },
    { key: 'Ctrl+K', description: '検索' },
    { key: 'Shift+?', description: 'ヘルプ表示' },
    { key: 'Esc', description: 'キャンセル/閉じる' },
  ];
}
