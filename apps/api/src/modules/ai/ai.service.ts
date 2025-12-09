import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface AISuggestion {
  id: string;
  text: string;
  confidence: number;
  source: 'template' | 'history' | 'ai';
}

interface OpenAIResponse {
  choices: Array<{
    message?: {
      content?: string;
    };
  }>;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async getSuggestions(
    conversationId: string,
    userMessage: string,
  ): Promise<AISuggestion[]> {
    const suggestions: AISuggestion[] = [];

    const templateSuggestions = await this.getTemplateSuggestions(userMessage);
    suggestions.push(...templateSuggestions);

    const historySuggestions = await this.getHistorySuggestions(userMessage);
    suggestions.push(...historySuggestions);

    const aiSuggestion = await this.getAISuggestion(conversationId, userMessage);
    if (aiSuggestion) {
      suggestions.push(aiSuggestion);
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  }

  private async getTemplateSuggestions(userMessage: string): Promise<AISuggestion[]> {
    const keywords = this.extractKeywords(userMessage);
    if (keywords.length === 0) return [];

    const templates = await this.prisma.template.findMany({
      where: {
        isActive: true,
        OR: keywords.map((keyword) => ({
          OR: [
            { name: { contains: keyword, mode: 'insensitive' as const } },
            { content: { contains: keyword, mode: 'insensitive' as const } },
          ],
        })),
      },
      take: 3,
    });

    return templates.map((template, index) => ({
      id: `template-${template.id}`,
      text: template.content,
      confidence: 0.8 - index * 0.1,
      source: 'template' as const,
    }));
  }

  private async getHistorySuggestions(userMessage: string): Promise<AISuggestion[]> {
    const keywords = this.extractKeywords(userMessage);
    if (keywords.length === 0) return [];

    const similarMessages = await this.prisma.message.findMany({
      where: {
        senderType: 'USER',
        contentType: 'TEXT',
        OR: keywords.map((keyword) => ({
          content: { contains: keyword, mode: 'insensitive' as const },
        })),
      },
      select: { conversationId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const responses: AISuggestion[] = [];
    for (const msg of similarMessages) {
      const nextMessage = await this.prisma.message.findFirst({
        where: {
          conversationId: msg.conversationId,
          senderType: 'ADMIN',
          contentType: 'TEXT',
          createdAt: { gt: msg.createdAt },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (nextMessage && nextMessage.content.length > 10) {
        if (!responses.some((r) => r.text === nextMessage.content)) {
          responses.push({
            id: `history-${nextMessage.id}`,
            text: nextMessage.content,
            confidence: 0.6,
            source: 'history',
          });
        }
      }
      if (responses.length >= 2) break;
    }

    return responses;
  }

  private async getAISuggestion(
    conversationId: string,
    _userMessage: string,
  ): Promise<AISuggestion | null> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) return null;

    try {
      const recentMessages = await this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const messages = [
        {
          role: 'system',
          content: 'あなたはカスタマーサポートのアシスタントです。ユーザーからの問い合わせに対する適切な回答を提案してください。',
        },
        ...recentMessages.reverse().map((msg) => ({
          role: msg.senderType === 'USER' ? 'user' : 'assistant',
          content: msg.content,
        })),
      ];

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages,
          max_tokens: 200,
          temperature: 0.7,
        }),
      });

      if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);

      const data = await response.json() as OpenAIResponse;
      const aiResponse = data.choices[0]?.message?.content;

      if (aiResponse) {
        return { id: 'ai-generated', text: aiResponse, confidence: 0.7, source: 'ai' };
      }
    } catch (error) {
      this.logger.error('AI suggestion failed', error);
    }

    return null;
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set(['です', 'ます', 'の', 'が', 'を', 'に', 'は', 'で', 'と']);
    const words = text
      .toLowerCase()
      .replace(/[、。！？\.,!?]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 2 && !stopWords.has(word));
    return [...new Set(words)].slice(0, 5);
  }

  async summarizeConversation(conversationId: string): Promise<string | null> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) return null;

    try {
      const messages = await this.prisma.message.findMany({
        where: { conversationId, contentType: 'TEXT' },
        orderBy: { createdAt: 'asc' },
      });

      if (messages.length < 3) return null;

      const conversationText = messages.map((m) => `${m.senderType}: ${m.content}`).join('\n');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'カスタマーサポートの会話を簡潔に要約してください。' },
            { role: 'user', content: conversationText },
          ],
          max_tokens: 150,
          temperature: 0.5,
        }),
      });

      if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);

      const data = await response.json() as OpenAIResponse;
      return data.choices[0]?.message?.content || null;
    } catch (error) {
      this.logger.error('Summarization failed', error);
      return null;
    }
  }

  /**
   * 会話履歴を取得
   */
  async getConversationHistory(conversationId: string, limit = 10): Promise<Array<{ role: string; content: string }>> {
    const messages = await this.prisma.message.findMany({
      where: { conversationId, contentType: 'TEXT' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.reverse().map((msg) => ({
      role: msg.senderType === 'USER' ? 'user' : 'assistant',
      content: msg.content,
    }));
  }

  /**
   * AIチャット応答を生成
   */
  async chat(params: {
    conversationId: string;
    userMessage: string;
    previousMessages: Array<{ role: string; content: string }>;
    userInfo?: { name?: string; email?: string; currentPage?: string };
  }): Promise<{ reply: string; needsEscalation: boolean; escalationReason?: string }> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    // APIキーがない場合はデフォルト応答
    if (!apiKey) {
      return {
        reply: 'ただいま混み合っております。オペレーターにお繋ぎいたしますので、少々お待ちください。',
        needsEscalation: true,
        escalationReason: 'AI unavailable',
      };
    }

    try {
      const systemPrompt = this.buildSystemPrompt(params.userInfo);

      const messages = [
        { role: 'system', content: systemPrompt },
        ...params.previousMessages,
        { role: 'user', content: params.userMessage },
      ];

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages,
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json() as OpenAIResponse;
      const aiReply = data.choices[0]?.message?.content || '';

      // エスカレーションキーワードをチェック
      const escalationResult = this.checkEscalationNeeded(params.userMessage, aiReply);

      return {
        reply: aiReply || '申し訳ございません。もう一度お試しください。',
        needsEscalation: escalationResult.needed,
        escalationReason: escalationResult.reason,
      };
    } catch (error) {
      this.logger.error('AI chat failed', error);
      return {
        reply: 'ただいま混み合っております。オペレーターにお繋ぎいたしますので、少々お待ちください。',
        needsEscalation: true,
        escalationReason: 'AI error',
      };
    }
  }

  private buildSystemPrompt(userInfo?: { name?: string; email?: string; currentPage?: string }): string {
    let prompt = `あなたはカスタマーサポートのチャットボットです。
以下のガイドラインに従って応答してください：
- 丁寧で親切な対応を心がける
- 回答は簡潔かつ明確にする
- わからない質問には「オペレーターにお繋ぎします」と答える
- 個人情報は決して聞き出さない`;

    if (userInfo?.name) {
      prompt += `\n\nユーザー名: ${userInfo.name}`;
    }
    if (userInfo?.currentPage) {
      prompt += `\n現在のページ: ${userInfo.currentPage}`;
    }

    return prompt;
  }

  private checkEscalationNeeded(userMessage: string, aiReply: string): { needed: boolean; reason?: string } {
    const escalationKeywords = [
      { keyword: 'オペレーター', reason: 'User requested operator' },
      { keyword: '担当者', reason: 'User requested staff' },
      { keyword: '人間', reason: 'User requested human' },
      { keyword: 'クレーム', reason: 'Complaint detected' },
      { keyword: '返金', reason: 'Refund request' },
      { keyword: '解約', reason: 'Cancellation request' },
      { keyword: 'キャンセル', reason: 'Cancellation request' },
      { keyword: '怒', reason: 'User frustration detected' },
      { keyword: '困', reason: 'User difficulty detected' },
    ];

    const combined = (userMessage + ' ' + aiReply).toLowerCase();
    for (const { keyword, reason } of escalationKeywords) {
      if (combined.includes(keyword.toLowerCase())) {
        return { needed: true, reason };
      }
    }
    return { needed: false };
  }
}
