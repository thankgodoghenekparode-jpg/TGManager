import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailerService } from '../../common/mailer/mailer.service';
import { ChatGateway } from '../chat/chat.gateway';

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ChatGateway,
    private readonly mailer: MailerService,
  ) {}

  async create(tenantId: string, input: CreateNotificationInput) {
    const notification = await this.persist(tenantId, input);
    this.gateway.emitToUser(input.userId, 'notification:new', notification);
    void this.emailIfConfigured(input);
    return notification;
  }

  async createMany(tenantId: string, inputs: CreateNotificationInput[]) {
    if (inputs.length === 0) return { count: 0 };
    const notifications = await Promise.all(
      inputs.map((input) => this.persist(tenantId, input)),
    );
    for (const notification of notifications) {
      this.gateway.emitToUser(
        notification.userId,
        'notification:new',
        notification,
      );
    }
    for (const input of inputs) {
      void this.emailIfConfigured(input);
    }
    return { count: notifications.length };
  }

  /**
   * Sends an email copy of the notification when SMTP is configured
   * (EMAIL_HOST set). In-app delivery (database + websocket) always happens;
   * email is best-effort and never blocks or fails the request.
   */
  private async emailIfConfigured(
    input: CreateNotificationInput,
  ): Promise<void> {
    if (!(await this.mailer.enabled)) return;
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true },
      });
      if (!user) return;
      await this.mailer.send({
        to: user.email,
        subject: input.title,
        text: input.body ?? input.title,
      });
    } catch {
      // Email is a best-effort side channel; ignore failures.
    }
  }

  private async persist(tenantId: string, input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        tenantId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        data: (input.data ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async list(tenantId: string, userId: string, limit = 50) {
    return this.prisma.notification.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  async unreadCount(tenantId: string, userId: string) {
    const count = await this.prisma.notification.count({
      where: { tenantId, userId, readAt: null },
    });
    return { count };
  }

  async markRead(tenantId: string, userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, tenantId, userId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.readAt) return notification;

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(tenantId: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { tenantId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      throw new BadRequestException('No unread notifications');
    }
    return { updated: result.count };
  }
}
