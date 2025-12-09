import { Controller, Get, Post, Body, Param, Query, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { LmsService, LmsUserInfo } from './lms.service';

@Controller('api/lms')
export class LmsController {
  private logger = new Logger('LmsController');

  constructor(private lmsService: LmsService) {}

  /**
   * LMS連携ステータスを確認
   */
  @Get('status')
  getStatus() {
    return {
      enabled: this.lmsService.isLmsEnabled(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * LMSユーザー情報を同期（LMSからのWebhook用）
   */
  @Post('sync-user')
  async syncUser(@Body() data: LmsUserInfo) {
    try {
      await this.lmsService.syncLmsUser(data);
      return { success: true, message: 'ユーザー情報を同期しました' };
    } catch (error) {
      this.logger.error('ユーザー同期エラー:', error);
      throw new HttpException('同期に失敗しました', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * LMS IDでユーザーを検索
   */
  @Get('users/:lmsUserId')
  async findUser(@Param('lmsUserId') lmsUserId: string) {
    const user = await this.lmsService.findUserByLmsId(lmsUserId);
    if (!user) {
      throw new HttpException('ユーザーが見つかりません', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  /**
   * ユーザーのLMS進捗を取得
   */
  @Get('users/:userId/progress')
  async getUserProgress(@Param('userId') userId: string) {
    const progress = await this.lmsService.getUserLmsProgress(userId);
    if (!progress) {
      return { message: 'LMS進捗情報がありません' };
    }
    return progress;
  }

  /**
   * LMSイベントを記録（LMSからのWebhook用）
   */
  @Post('events')
  async logEvent(
    @Body() data: {
      lmsUserId: string;
      eventType: 'course_start' | 'lesson_complete' | 'course_complete' | 'quiz_submit' | 'help_request';
      courseId?: string;
      lessonId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    try {
      await this.lmsService.logLmsEvent(data);
      return { success: true, message: 'イベントを記録しました' };
    } catch (error) {
      this.logger.error('イベント記録エラー:', error);
      throw new HttpException('記録に失敗しました', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * LMSからコース情報を取得（外部API連携）
   */
  @Get('users/:lmsUserId/courses')
  async getUserCourses(@Param('lmsUserId') lmsUserId: string) {
    const courses = await this.lmsService.fetchUserCourses(lmsUserId);
    return { courses };
  }

  /**
   * LMSからユーザー情報を取得して同期
   */
  @Post('users/:lmsUserId/fetch-and-sync')
  async fetchAndSync(@Param('lmsUserId') lmsUserId: string) {
    try {
      const lmsUserInfo = await this.lmsService.fetchLmsUserInfo(lmsUserId);
      if (!lmsUserInfo) {
        throw new HttpException('LMSからユーザー情報を取得できませんでした', HttpStatus.NOT_FOUND);
      }
      await this.lmsService.syncLmsUser(lmsUserInfo);
      return { success: true, user: lmsUserInfo };
    } catch (error) {
      this.logger.error('Fetch and sync エラー:', error);
      throw new HttpException('同期に失敗しました', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
