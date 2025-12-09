import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface LmsUserInfo {
  id: string;
  name: string;
  email?: string;
  company?: string;
  department?: string;
  currentCourseId?: string;
  currentCourseName?: string;
  progress?: number;
  lastAccessedAt?: Date;
}

export interface LmsCourseInfo {
  id: string;
  name: string;
  description?: string;
  totalLessons: number;
  completedLessons: number;
  progress: number;
  status: 'not_started' | 'in_progress' | 'completed';
}

@Injectable()
export class LmsService {
  private logger = new Logger('LmsService');
  private lmsApiUrl: string | undefined;
  private lmsApiKey: string | undefined;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.lmsApiUrl = this.configService.get<string>('LMS_API_URL');
    this.lmsApiKey = this.configService.get<string>('LMS_API_KEY');
  }

  /**
   * LMSユーザー情報をDBに保存/更新
   */
  async syncLmsUser(lmsUserInfo: LmsUserInfo): Promise<void> {
    try {
      // lmsUserIdで既存ユーザーを検索
      const existingUser = await this.prisma.user.findFirst({
        where: { lmsUserId: lmsUserInfo.id },
      });

      const userData = {
        name: lmsUserInfo.name,
        email: lmsUserInfo.email,
        company: lmsUserInfo.company,
        metadata: {
          lms: {
            currentCourseId: lmsUserInfo.currentCourseId,
            currentCourseName: lmsUserInfo.currentCourseName,
            progress: lmsUserInfo.progress,
            lastAccessedAt: lmsUserInfo.lastAccessedAt,
            syncedAt: new Date(),
          },
        },
      };

      if (existingUser) {
        // 既存ユーザーを更新
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            ...userData,
            metadata: {
              ...(existingUser.metadata as object || {}),
              ...userData.metadata,
            },
          },
        });
        this.logger.log(`LMSユーザー同期完了: ${lmsUserInfo.id} (更新)`);
      } else {
        // 新規ユーザーは作成しない（ウィジェットからのJOINで作成）
        this.logger.log(`LMSユーザー同期: ${lmsUserInfo.id} (既存ユーザーなし)`);
      }
    } catch (error) {
      this.logger.error(`LMSユーザー同期エラー: ${lmsUserInfo.id}`, error);
      throw error;
    }
  }

  /**
   * LMS IDからユーザーを検索
   */
  async findUserByLmsId(lmsUserId: string) {
    return this.prisma.user.findFirst({
      where: { lmsUserId },
      include: {
        conversations: {
          orderBy: { updatedAt: 'desc' },
          take: 5,
        },
      },
    });
  }

  /**
   * LMSからユーザー情報を取得（外部API連携）
   */
  async fetchLmsUserInfo(lmsUserId: string): Promise<LmsUserInfo | null> {
    if (!this.lmsApiUrl || !this.lmsApiKey) {
      this.logger.warn('LMS API設定がありません');
      return null;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.lmsApiUrl}/users/${lmsUserId}`, {
          headers: {
            'Authorization': `Bearer ${this.lmsApiKey}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      return response.data as LmsUserInfo;
    } catch (error) {
      this.logger.error(`LMS API呼び出しエラー: ${lmsUserId}`, error);
      return null;
    }
  }

  /**
   * LMSからコース情報を取得
   */
  async fetchUserCourses(lmsUserId: string): Promise<LmsCourseInfo[]> {
    if (!this.lmsApiUrl || !this.lmsApiKey) {
      this.logger.warn('LMS API設定がありません');
      return [];
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.lmsApiUrl}/users/${lmsUserId}/courses`, {
          headers: {
            'Authorization': `Bearer ${this.lmsApiKey}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      return response.data as LmsCourseInfo[];
    } catch (error) {
      this.logger.error(`LMSコース取得エラー: ${lmsUserId}`, error);
      return [];
    }
  }

  /**
   * ユーザーのLMS進捗を取得（ローカルDB）
   */
  async getUserLmsProgress(userId: string): Promise<{
    currentCourse?: string;
    progress?: number;
    lastAccessedAt?: Date;
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.metadata) return null;

    const metadata = user.metadata as Record<string, unknown>;
    const lmsData = metadata.lms as Record<string, unknown> | undefined;

    if (!lmsData) return null;

    return {
      currentCourse: lmsData.currentCourseName as string | undefined,
      progress: lmsData.progress as number | undefined,
      lastAccessedAt: lmsData.lastAccessedAt as Date | undefined,
    };
  }

  /**
   * LMSイベントをログに記録
   */
  async logLmsEvent(data: {
    lmsUserId: string;
    eventType: 'course_start' | 'lesson_complete' | 'course_complete' | 'quiz_submit' | 'help_request';
    courseId?: string;
    lessonId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      // 訪問ログとして記録
      const user = await this.findUserByLmsId(data.lmsUserId);
      if (user) {
        await this.prisma.visitLog.create({
          data: {
            userId: user.id,
            url: `lms://${data.eventType}${data.courseId ? `/${data.courseId}` : ''}${data.lessonId ? `/${data.lessonId}` : ''}`,
            pageTitle: `LMS Event: ${data.eventType}`,
            referrer: JSON.stringify(data.metadata || {}),
          },
        });
      }
      this.logger.log(`LMSイベント記録: ${data.eventType} - ${data.lmsUserId}`);
    } catch (error) {
      this.logger.error('LMSイベント記録エラー:', error);
    }
  }

  /**
   * LMS連携が有効かどうかチェック
   */
  isLmsEnabled(): boolean {
    return !!(this.lmsApiUrl && this.lmsApiKey);
  }
}
