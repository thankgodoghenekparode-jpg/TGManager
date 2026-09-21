import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';
import { PrismaService } from '../../prisma/prisma.service';

export interface PushMessage {
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Web Push delivery for realtime (chat) notifications.
 *
 * Enabled only when PUSH_ENABLED=true and both VAPID keys are configured.
 * Subscriptions are stored per user; expired/revoked push endpoints are
 * cleaned up on the fly (410/404 responses from the push service).
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const publicKey = config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = config.get<string>('VAPID_PRIVATE_KEY');
    this.enabled =
      config.get<string>('PUSH_ENABLED') === 'true' &&
      Boolean(publicKey) &&
      Boolean(privateKey);
    if (this.enabled) {
      webpush.setVapidDetails(
        config.get<string>('VAPID_SUBJECT') ??
          'mailto:no-reply@tgmanager.example',
        publicKey as string,
        privateKey as string,
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getPublicKey(): string | null {
    return this.enabled
      ? (this.config.get<string>('VAPID_PUBLIC_KEY') ?? null)
      : null;
  }

  async saveSubscription(
    userId: string,
    tenantId: string,
    subscription: PushSubscriptionInput,
    userAgent?: string,
  ) {
    const existing = await this.prisma.pushSubscription.findUnique({
      where: { endpoint: subscription.endpoint },
    });
    if (existing) {
      return this.prisma.pushSubscription.update({
        where: { id: existing.id },
        data: {
          userId,
          tenantId,
          p256dh: subscription.p256dh,
          auth: subscription.auth,
          userAgent,
        },
      });
    }
    return this.prisma.pushSubscription.create({
      data: {
        userId,
        tenantId,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        userAgent,
      },
    });
  }

  async removeSubscription(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  /**
   * Best-effort push of `message` to every active subscription of `userId`.
   * Returns the number of successful sends.
   */
  async sendToUser(userId: string, message: PushMessage): Promise<number> {
    if (!this.enabled) return 0;
    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    if (subs.length === 0) return 0;

    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      data: message.data,
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        );
        sent += 1;
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await this.prisma.pushSubscription
            .deleteMany({ where: { id: sub.id } })
            .catch(() => undefined);
        } else if (statusCode !== 429) {
          this.logger.warn(
            `Push send failed for user ${userId}: ${(err as Error)?.message}`,
          );
        }
      }
    }
    return sent;
  }
}