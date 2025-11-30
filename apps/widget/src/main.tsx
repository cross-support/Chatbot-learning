import { render } from 'preact';
import { ChatWidget } from './components/ChatWidget';
import './styles/index.css';

// ウィジェットの設定
interface WidgetConfig {
  siteId?: string;
  apiUrl?: string;
  wsUrl?: string;
}

// グローバル設定を取得
function getConfig(): WidgetConfig {
  const script = document.querySelector('script[data-site-id]');
  return {
    siteId: script?.getAttribute('data-site-id') || 'default',
    apiUrl: script?.getAttribute('data-api-url') || 'http://localhost:3000',
    wsUrl: script?.getAttribute('data-ws-url') || 'http://localhost:3000',
  };
}

// Shadow DOMにウィジェットをマウント
function mountWidget() {
  // コンテナ要素を作成
  const container = document.createElement('div');
  container.id = 'crossbot-widget-container';
  document.body.appendChild(container);

  // Shadow DOMを作成（スタイル分離）
  const shadow = container.attachShadow({ mode: 'open' });

  // スタイルを注入
  const style = document.createElement('style');
  style.textContent = getWidgetStyles();
  shadow.appendChild(style);

  // アプリケーションのマウントポイント
  const mountPoint = document.createElement('div');
  mountPoint.id = 'crossbot-app';
  shadow.appendChild(mountPoint);

  // 設定を取得
  const config = getConfig();

  // Preactアプリケーションをレンダリング
  render(<ChatWidget config={config} />, mountPoint);
}

// ウィジェットのスタイル（Tailwind CSSのビルド後に置き換え）
function getWidgetStyles(): string {
  return `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .widget-launcher {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: #007AFF;
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 122, 255, 0.4);
      transition: transform 0.2s, box-shadow 0.2s;
      z-index: 9999;
    }

    .widget-launcher:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0, 122, 255, 0.5);
    }

    .widget-launcher svg {
      width: 28px;
      height: 28px;
    }

    .widget-window {
      position: fixed;
      bottom: 90px;
      right: 20px;
      width: 350px;
      height: 500px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 9998;
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (max-width: 480px) {
      .widget-window {
        width: 100%;
        height: 100%;
        bottom: 0;
        right: 0;
        border-radius: 0;
      }
    }

    .widget-header {
      background: #007AFF;
      color: white;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .widget-header-title {
      font-size: 16px;
      font-weight: 600;
    }

    .widget-header-close {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .widget-timeline {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message {
      max-width: 80%;
      padding: 12px 16px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.5;
    }

    .message-user {
      align-self: flex-end;
      background: #007AFF;
      color: white;
      border-bottom-right-radius: 4px;
    }

    .message-bot,
    .message-admin {
      align-self: flex-start;
      background: #F1F1F1;
      color: #333;
      border-bottom-left-radius: 4px;
    }

    .message-system {
      align-self: center;
      background: #FFF3CD;
      color: #856404;
      font-size: 13px;
      text-align: center;
    }

    .options-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 0 16px 16px;
    }

    .option-button {
      padding: 10px 16px;
      background: white;
      border: 1px solid #007AFF;
      color: #007AFF;
      border-radius: 20px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
    }

    .option-button:hover {
      background: #007AFF;
      color: white;
    }

    .widget-input-area {
      padding: 12px 16px;
      border-top: 1px solid #E5E5E5;
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .widget-input {
      flex: 1;
      padding: 10px 16px;
      border: 1px solid #E5E5E5;
      border-radius: 20px;
      font-size: 14px;
      outline: none;
    }

    .widget-input:focus {
      border-color: #007AFF;
    }

    .widget-input:disabled {
      background: #F5F5F5;
    }

    .widget-send-button,
    .widget-attach-button {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .widget-send-button {
      background: #007AFF;
      color: white;
    }

    .widget-send-button:disabled {
      background: #CCC;
      cursor: not-allowed;
    }

    .widget-attach-button {
      background: #F5F5F5;
      color: #666;
    }

    .widget-attach-button:hover {
      background: #E5E5E5;
    }

    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 8px 12px;
      background: #F1F1F1;
      border-radius: 16px;
      width: fit-content;
    }

    .typing-indicator span {
      width: 8px;
      height: 8px;
      background: #999;
      border-radius: 50%;
      animation: typing 1.4s infinite ease-in-out;
    }

    .typing-indicator span:nth-child(1) { animation-delay: 0s; }
    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typing {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-4px); }
    }

    .status-badge {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.2);
    }

    .image-preview {
      max-width: 200px;
      border-radius: 8px;
      cursor: pointer;
    }

    .image-message {
      padding: 4px;
    }
  `;
}

// DOMContentLoadedで初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountWidget);
} else {
  mountWidget();
}
