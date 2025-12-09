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
    :host {
      --primary-color: #F5A623;
    }

    #crossbot-app {
      --primary-color: #F5A623;
    }

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
      background: var(--primary-color, #F5A623);
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(245, 166, 35, 0.4);
      transition: transform 0.2s, box-shadow 0.2s;
      z-index: 9999;
    }

    .widget-launcher:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(245, 166, 35, 0.5);
    }

    .widget-launcher svg {
      width: 28px;
      height: 28px;
    }

    .widget-window {
      position: fixed;
      bottom: 90px;
      right: 20px;
      width: 380px;
      height: 560px;
      max-height: calc(100vh - 120px);
      max-width: calc(100vw - 40px);
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

    /* スマホ対応（768px以下） */
    @media (max-width: 768px) {
      .widget-launcher {
        bottom: 16px;
        right: 16px;
        width: 56px;
        height: 56px;
      }

      .widget-window {
        width: 100%;
        height: 100%;
        max-height: 100%;
        max-width: 100%;
        bottom: 0;
        right: 0;
        border-radius: 0;
        animation: slideUpMobile 0.3s ease-out;
      }

      @keyframes slideUpMobile {
        from {
          opacity: 0;
          transform: translateY(100%);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .widget-header {
        padding: 14px 16px;
        padding-top: max(14px, env(safe-area-inset-top));
      }

      .widget-timeline {
        padding: 12px;
        padding-bottom: max(12px, env(safe-area-inset-bottom));
      }

      .widget-input-area {
        padding: 12px 16px;
        padding-bottom: max(12px, env(safe-area-inset-bottom));
      }

      .message {
        max-width: 85%;
        font-size: 15px;
      }

      .option-button,
      .message-option-button {
        padding: 10px 14px;
        font-size: 15px;
        min-height: 44px;
      }

      .widget-input {
        font-size: 16px; /* iOS zoom対策 */
        min-height: 44px;
      }

      .widget-send-button,
      .widget-attach-button {
        width: 44px;
        height: 44px;
      }
    }

    /* 小さいスマホ（375px以下） */
    @media (max-width: 375px) {
      .message {
        max-width: 90%;
      }

      .message-options-container {
        max-width: 100%;
      }
    }

    .widget-header {
      background: var(--primary-color, #F5A623);
      color: white;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .widget-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .widget-header-avatar {
      width: 36px;
      height: 36px;
      background: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }

    .widget-header-title {
      font-size: 14px;
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

    .message-row {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      animation: messageSlideIn 0.3s ease-out;
    }

    @keyframes messageSlideIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .message-row-bot {
      justify-content: flex-start;
    }

    .message-row-user {
      justify-content: flex-end;
    }

    .message-avatar {
      width: 32px;
      height: 32px;
      background: #FFF8E1;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }

    .message {
      max-width: 75%;
      padding: 12px 16px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.5;
    }

    .message-user {
      background: var(--primary-color, #F5A623);
      color: white;
      border-bottom-right-radius: 4px;
    }

    .message-bot,
    .message-admin {
      background: #F1F1F1;
      color: #333;
      border-bottom-left-radius: 4px;
    }

    .message-system {
      background: #FFF3CD;
      color: #856404;
      font-size: 13px;
      text-align: center;
      margin: 0 auto;
    }

    .options-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px 16px 16px;
    }

    .option-button {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: white;
      border: 1px solid #E5E5E5;
      color: #333;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
      text-align: left;
    }

    .option-button:hover {
      background: #FFF8E1;
      border-color: var(--primary-color, #F5A623);
    }

    .option-button::after {
      content: '›';
      font-size: 18px;
      color: var(--primary-color, #F5A623);
      font-weight: bold;
    }

    .widget-input-area {
      padding: 12px 16px;
      border-top: 1px solid #E5E5E5;
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }

    .widget-input {
      flex: 1;
      padding: 10px 16px;
      border: 1px solid #E5E5E5;
      border-radius: 20px;
      font-size: 14px;
      outline: none;
      resize: none;
      min-height: 40px;
      max-height: 120px;
      line-height: 1.4;
      font-family: inherit;
      overflow-y: auto;
    }

    .widget-input:focus {
      border-color: var(--primary-color, #F5A623);
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
      background: var(--primary-color, #F5A623);
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

    /* メッセージ内のHTMLコンテンツ（dangerouslySetInnerHTMLで挿入された画像など） */
    .message img,
    .message-bot img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 8px 0;
      display: block;
    }

    .message div,
    .message-bot div {
      word-break: break-word;
      overflow-wrap: break-word;
    }

    .message a,
    .message-bot a {
      color: var(--primary-color, #F5A623);
      text-decoration: underline;
    }

    .message a:hover,
    .message-bot a:hover {
      text-decoration: none;
    }

    /* ==================== RICOH風 選択肢スタイル ==================== */

    .message-options-container {
      background: #f5f5f5;
      border-radius: 16px;
      border-bottom-left-radius: 4px;
      padding: 16px;
      max-width: 280px;
    }

    .message-back-button {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      margin-bottom: 12px;
      font-size: 13px;
      color: #666;
      background: white;
      border: 1px solid #ddd;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .message-back-button:hover {
      background: #f0f0f0;
      border-color: #ccc;
    }

    .message-options-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .message-option-button {
      display: block;
      width: 100%;
      padding: 5px 10px;
      font-size: 13px;
      text-align: center;
      color: var(--primary-color, #F5A623);
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      line-height: 1.4;
    }

    .message-option-button:hover {
      background: #FFF8E1;
      border-color: var(--primary-color, #F5A623);
    }

    .message-option-button:active {
      background: #FFE0B2;
    }

    /* リンクボタン用スタイル */
    .message-option-link {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      text-decoration: none;
      color: #2563eb;
      border-color: #93c5fd;
      background: #eff6ff;
    }

    .message-option-link:hover {
      background: #dbeafe;
      border-color: #3b82f6;
      color: #1d4ed8;
    }

    .message-option-link:active {
      background: #bfdbfe;
    }

    .message-option-link svg {
      flex-shrink: 0;
    }

    /* ==================== 動的フォーム ==================== */
    .dynamic-form-container {
      padding: 16px;
      background: #f9fafb;
      height: 100%;
      overflow-y: auto;
    }

    .dynamic-form-header {
      margin-bottom: 16px;
      text-align: center;
    }

    .dynamic-form-title {
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
      margin: 0 0 8px 0;
    }

    .dynamic-form-description {
      font-size: 13px;
      color: #6b7280;
      margin: 0;
    }

    .dynamic-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .dynamic-form-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .dynamic-form-label {
      font-size: 13px;
      font-weight: 500;
      color: #374151;
    }

    .dynamic-form-required {
      color: #ef4444;
      margin-left: 2px;
    }

    .dynamic-form-input {
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.2s, box-shadow 0.2s;
      background: white;
    }

    .dynamic-form-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .dynamic-form-input:disabled {
      background-color: #f3f4f6;
      cursor: not-allowed;
    }

    .dynamic-form-input-error {
      border-color: #ef4444;
    }

    textarea.dynamic-form-input {
      resize: vertical;
      min-height: 80px;
    }

    select.dynamic-form-input {
      cursor: pointer;
    }

    .dynamic-form-checkbox,
    .dynamic-form-radio {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 14px;
      color: #374151;
    }

    .dynamic-form-checkbox input,
    .dynamic-form-radio input {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }

    .dynamic-form-radio-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .dynamic-form-error {
      font-size: 12px;
      color: #ef4444;
    }

    .dynamic-form-actions {
      display: flex;
      gap: 12px;
      margin-top: 8px;
    }

    .dynamic-form-btn-primary,
    .dynamic-form-btn-secondary {
      flex: 1;
      padding: 10px 16px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .dynamic-form-btn-primary {
      background-color: #3b82f6;
      color: white;
    }

    .dynamic-form-btn-primary:hover:not(:disabled) {
      background-color: #2563eb;
    }

    .dynamic-form-btn-primary:disabled {
      background-color: #93c5fd;
      cursor: not-allowed;
    }

    .dynamic-form-btn-secondary {
      background-color: #e5e7eb;
      color: #374151;
    }

    .dynamic-form-btn-secondary:hover:not(:disabled) {
      background-color: #d1d5db;
    }

    /* ==================== 画像プレビュー ==================== */

    .cb-input-container {
      border-top: 1px solid #E5E5E5;
    }

    .cb-image-preview-container {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background-color: #f3f4f6;
      border-bottom: 1px solid #e5e7eb;
    }

    .cb-image-preview-wrapper {
      position: relative;
      flex-shrink: 0;
    }

    .cb-image-preview-thumb {
      width: 48px;
      height: 48px;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid #d1d5db;
    }

    .cb-image-preview-remove {
      position: absolute;
      top: -6px;
      right: -6px;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #ef4444;
      color: white;
      border: 2px solid white;
      border-radius: 50%;
      cursor: pointer;
      transition: background-color 0.2s;
      padding: 0;
    }

    .cb-image-preview-remove:hover {
      background-color: #dc2626;
    }

    .cb-image-preview-name {
      font-size: 12px;
      color: #6b7280;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }

    .cb-ai-prompt-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      font-size: 12px;
      color: #1e40af;
      background: linear-gradient(to right, #eff6ff, #eef2ff);
      border-bottom: 1px solid #bfdbfe;
    }

    .cb-ai-prompt-banner svg {
      flex-shrink: 0;
      color: #3b82f6;
    }

    /* ==================== 満足度アンケート ==================== */

    .survey-container {
      padding: 24px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
      overflow-y: auto;
    }

    .survey-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .survey-header h3 {
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
      margin: 0 0 8px 0;
    }

    .survey-header p {
      font-size: 13px;
      color: #6b7280;
      margin: 0;
    }

    .survey-rating {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    .survey-star {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      transition: transform 0.2s;
    }

    .survey-star:hover {
      transform: scale(1.2);
    }

    .survey-star:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .survey-labels {
      display: flex;
      justify-content: space-between;
      width: 200px;
      font-size: 11px;
      color: #9ca3af;
      margin-bottom: 24px;
    }

    .survey-skip {
      background: none;
      border: none;
      color: #6b7280;
      font-size: 13px;
      cursor: pointer;
      padding: 8px 16px;
    }

    .survey-skip:hover {
      color: #374151;
      text-decoration: underline;
    }

    .survey-categories {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
      justify-content: center;
    }

    .survey-category {
      padding: 8px 16px;
      border: 1px solid #d1d5db;
      border-radius: 20px;
      background: white;
      font-size: 13px;
      color: #374151;
      cursor: pointer;
      transition: all 0.2s;
    }

    .survey-category:hover {
      border-color: #9ca3af;
    }

    .survey-category.active {
      color: var(--primary-color, #F5A623);
    }

    .survey-feedback {
      width: 100%;
      margin-bottom: 16px;
    }

    .survey-feedback textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      resize: none;
      font-family: inherit;
    }

    .survey-feedback textarea:focus {
      outline: none;
      border-color: var(--primary-color, #F5A623);
    }

    .survey-actions {
      display: flex;
      gap: 12px;
      width: 100%;
    }

    .survey-back {
      flex: 1;
      padding: 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      background: white;
      font-size: 14px;
      cursor: pointer;
    }

    .survey-back:hover {
      background: #f3f4f6;
    }

    .survey-submit {
      flex: 2;
      padding: 12px;
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }

    .survey-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .survey-success {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 16px;
    }

    .survey-success p {
      font-size: 15px;
      color: #374151;
      margin: 0;
    }

    /* ==================== 開発用ロール切り替えパネル ==================== */

    .debug-panel {
      position: fixed;
      bottom: 90px;
      left: 20px;
      background: #1f2937;
      border-radius: 12px;
      padding: 12px;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .debug-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .debug-panel-title {
      font-size: 11px;
      font-weight: 600;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .debug-panel-toggle {
      background: none;
      border: none;
      color: #6b7280;
      cursor: pointer;
      padding: 2px;
      display: flex;
      align-items: center;
    }

    .debug-panel-toggle:hover {
      color: #9ca3af;
    }

    .debug-panel-content {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .debug-role-btn {
      padding: 8px 12px;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .debug-role-btn-inactive {
      background: #374151;
      color: #9ca3af;
    }

    .debug-role-btn-inactive:hover {
      background: #4b5563;
      color: white;
    }

    .debug-role-btn-active {
      background: #059669;
      color: white;
    }

    .debug-role-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .debug-role-indicator-active {
      background: #34d399;
    }

    .debug-role-indicator-inactive {
      background: #6b7280;
    }

    .debug-panel-minimized {
      padding: 8px;
    }

    .debug-panel-minimized .debug-panel-content {
      display: none;
    }

    @media (max-width: 768px) {
      .debug-panel {
        bottom: auto;
        top: 10px;
        left: 10px;
        right: auto;
      }
    }
  `;
}

// DOMContentLoadedで初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountWidget);
} else {
  mountWidget();
}
