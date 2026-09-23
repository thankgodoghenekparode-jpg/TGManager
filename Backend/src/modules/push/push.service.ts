import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';
import { PrismaService } from '../../prisma/prisma.service';
import { isExpoToken } from './dto/push.dto';

export interface PushMessage {
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh?: string;
  auth?: string;
  /** 'web' (browser Web Push) or 'expo' (native app token via Expo). */
  provider?: 'web' | 'expo';
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushResponse {
  status?: string;
  data?: { status?: string; message?: string };
}

/**
 * Push delivery for realtime (chat) notifications.
 *
 * Supports two channels:
 *  1. Web Push (browsers / installed PWAs) via VAPID keys.
 *  2. Expo push tokens (the native Android/iOS wrapper) via the Expo push
 *     service, which fans out to FCM (Android) and APNs (iOS).
 *
 * Enabled only when PUSH_ENABLED=true. Web Push additionally requires both
 * VAPID keys; Expo tokens do not need VAPID. Expired/revoked endpoints are
 * cleaned up on the fly (404/410 responses from the push service).
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly pushEnabled: boolean;
  private readonly webEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.pushEnabled = config.get<string>('PUSH_ENABLED') === 'true';
    const publicKey = config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = config.get<string>('VAPID_PRIVATE_KEY');
    this.webEnabled =
      this.pushEnabled && Boolean(publicKey) && Boolean(privateKey);
    if (this.webEnabled) {
      webpush.setVapidDetails(
        config.get<string>('VAPID_SUBJECT') ??
          'mailto:no-reply@tgmanager.example',
        publicKey as string,
        privateKey as string,
      );
    }
  }

  isEnabled(): boolean {
    return this.pushEnabled;
  }

  getPublicKey(): string | null {
    return this.webEnabled
      ? (this.config.get<string>('VAPID_PUBLIC_KEY') ?? null)
      : null;
  }

  async saveSubscription(
    userId: string,
    tenantId: string,
    subscription: PushSubscriptionInput,
    userAgent?: string,
  ) {
    const isExpo =
      subscription.provider === 'expo' || isExpoToken(subscription.endpoint);
    const existing = await this.prisma.pushSubscription.findUnique({
      where: { endpoint: subscription.endpoint },
    });
    const data = {
      userId,
      tenantId,
      p256dh: subscription.p256dh ?? '',
      auth: subscription.auth ?? '',
      userAgent: isExpo ? 'expo' : (userAgent ?? null),
    };
    if (existing) {
      return this.prisma.pushSubscription.update({
        where: { id: existing.id },
        data,
      });
    }
    return this.prisma.pushSubscription.create({
      data: {
        endpoint: subscription.endpoint,
        ...data,
      },
    });
  }

  async removeSubscription(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  /**
   * Best-effort push of `message` to every active subscription of `userId`.
   * Returns the number of successful sends.
   */
  async sendToUser(userId: string, message: PushMessage): Promise<number> {
    if (!this.pushEnabled) return 0;
    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    if (subs.length === 0) return 0;

    let sent = 0;
    for (const sub of subs) {
      if (isExpoToken(sub.endpoint)) {
        sent += (await this.sendExpo(sub, message)) ? 1 : 0;
      } else if (this.webEnabled && sub.p256dh && sub.auth) {
        sent += (await this.sendWeb(sub, message)) ? 1 : 0;
      }
    }
    return sent;
  }

  private async sendWeb(
    sub: { id: string; endpoint: string; p256dh: string; auth: string },
    message: PushMessage,
  ): Promise<boolean> {
    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      data: message.data,
    });
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      );
      return true;
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await this.prisma.pushSubscription
          .deleteMany({ where: { id: sub.id } })
          .catch(() => undefined);
      } else if (statusCode !== 429) {
        this.logger.warn(`Web push send failed: ${(err as Error)?.message}`);
      }
      return false;
    }
  }

  private async sendExpo(
    sub: { id: string; endpoint: string },
    message: PushMessage,
  ): Promise<boolean> {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify([
          {
            to: sub.endpoint,
            sound: 'default',
            title: message.title,
            body: message.body,
            data: message.data,
            _displayInForeground: false,
          },
        ]),
      });
      if (!res.ok) {
        this.logger.warn(`Expo push failed: HTTP ${res.status}`);
        return false;
      }
      const body = (await res.json()) as ExpoPushResponse | ExpoPushResponse[];
      const first = Array.isArray(body) ? body[0] : body;
      const status = first?.data?.status ?? first?.status;
      if (status === 'error') {
        const errorMsg = first?.data?.message ?? '';
        if (/DeviceNotRegistered/i.test(errorMsg)) {
          await this.prisma.pushSubscription
            .deleteMany({ where: { id: sub.id } })
            .catch(() => undefined);
        } else {
          this.logger.warn(`Expo push rejected: ${errorMsg}`);
        }
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(`Expo push request failed: ${(err as Error)?.message}`);
      return false;
    }
  }
}
