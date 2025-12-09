export interface Translations {
  chat: {
    placeholder: string;
    send: string;
    typing: string;
    operatorJoined: string;
    operatorLeft: string;
    surveyTitle: string;
    surveySubmit: string;
    surveyThankYou: string;
    close: string;
    minimize: string;
    newMessage: string;
    fileUpload: string;
    fileTooLarge: string;
    fileUploadError: string;
    networkError: string;
    reconnecting: string;
    reconnected: string;
    ratingQuestion: string;
  };
  common: {
    yes: string;
    no: string;
    cancel: string;
    confirm: string;
    error: string;
    success: string;
    loading: string;
  };
}

export const translations: Record<string, Translations> = {
  ja: {
    chat: {
      placeholder: 'メッセージを入力...',
      send: '送信',
      typing: '入力中...',
      operatorJoined: 'オペレーターが対応を開始しました',
      operatorLeft: 'オペレーターが退出しました',
      surveyTitle: '本日のサポートはいかがでしたか?',
      surveySubmit: '送信',
      surveyThankYou: 'ご意見ありがとうございました',
      close: '閉じる',
      minimize: '最小化',
      newMessage: '新しいメッセージ',
      fileUpload: 'ファイルを選択',
      fileTooLarge: 'ファイルサイズが大きすぎます',
      fileUploadError: 'ファイルのアップロードに失敗しました',
      networkError: 'ネットワークエラーが発生しました',
      reconnecting: '再接続中...',
      reconnected: '再接続しました',
      ratingQuestion: '満足度を教えてください',
    },
    common: {
      yes: 'はい',
      no: 'いいえ',
      cancel: 'キャンセル',
      confirm: '確認',
      error: 'エラー',
      success: '成功',
      loading: '読み込み中...',
    },
  },
  en: {
    chat: {
      placeholder: 'Type a message...',
      send: 'Send',
      typing: 'Typing...',
      operatorJoined: 'An operator has joined the chat',
      operatorLeft: 'Operator has left the chat',
      surveyTitle: 'How was your experience today?',
      surveySubmit: 'Submit',
      surveyThankYou: 'Thank you for your feedback',
      close: 'Close',
      minimize: 'Minimize',
      newMessage: 'New message',
      fileUpload: 'Choose file',
      fileTooLarge: 'File size is too large',
      fileUploadError: 'Failed to upload file',
      networkError: 'Network error occurred',
      reconnecting: 'Reconnecting...',
      reconnected: 'Reconnected',
      ratingQuestion: 'Please rate your experience',
    },
    common: {
      yes: 'Yes',
      no: 'No',
      cancel: 'Cancel',
      confirm: 'Confirm',
      error: 'Error',
      success: 'Success',
      loading: 'Loading...',
    },
  },
  zh: {
    chat: {
      placeholder: '输入消息...',
      send: '发送',
      typing: '正在输入...',
      operatorJoined: '客服已加入对话',
      operatorLeft: '客服已离开对话',
      surveyTitle: '今天的服务如何?',
      surveySubmit: '提交',
      surveyThankYou: '感谢您的反馈',
      close: '关闭',
      minimize: '最小化',
      newMessage: '新消息',
      fileUpload: '选择文件',
      fileTooLarge: '文件太大',
      fileUploadError: '文件上传失败',
      networkError: '网络错误',
      reconnecting: '重新连接中...',
      reconnected: '已重新连接',
      ratingQuestion: '请评价您的体验',
    },
    common: {
      yes: '是',
      no: '否',
      cancel: '取消',
      confirm: '确认',
      error: '错误',
      success: '成功',
      loading: '加载中...',
    },
  },
  ko: {
    chat: {
      placeholder: '메시지를 입력하세요...',
      send: '전송',
      typing: '입력 중...',
      operatorJoined: '상담원이 대화에 참여했습니다',
      operatorLeft: '상담원이 대화를 나갔습니다',
      surveyTitle: '오늘 서비스는 어떠셨나요?',
      surveySubmit: '제출',
      surveyThankYou: '피드백 감사합니다',
      close: '닫기',
      minimize: '최소화',
      newMessage: '새 메시지',
      fileUpload: '파일 선택',
      fileTooLarge: '파일 크기가 너무 큽니다',
      fileUploadError: '파일 업로드 실패',
      networkError: '네트워크 오류가 발생했습니다',
      reconnecting: '재연결 중...',
      reconnected: '재연결됨',
      ratingQuestion: '경험을 평가해 주세요',
    },
    common: {
      yes: '예',
      no: '아니요',
      cancel: '취소',
      confirm: '확인',
      error: '오류',
      success: '성공',
      loading: '로딩 중...',
    },
  },
};

export function getTranslation(locale: string): Translations {
  return translations[locale] || translations['ja'];
}

export function detectUserLocale(): string {
  if (typeof navigator === 'undefined') {
    return 'ja';
  }

  const browserLocale = navigator.language || (navigator as any).userLanguage;
  const locale = browserLocale.split('-')[0];

  if (translations[locale]) {
    return locale;
  }

  return 'ja';
}
