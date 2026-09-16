import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service';
import { parsePlatformSettings } from '../../modules/platform/dto/platform-settings.dto';

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

interface SmtpConfig {
  host?: string;
  port: number;
  user?: string;
  pass?: string;
  from?: string;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transport: nodemailer.Transporter | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** SMTP config: platform settings (admin Settings page) take priority, then env vars. */
  async smtpConfig(): Promise<SmtpConfig> {
    let settings: ReturnType<typeof parsePlatformSettings> = {};
    try {
      const configRecord = await this.prisma.platformConfig.findUnique({
        where: { id: 'platform' },
      });
      settings = parsePlatformSettings(configRecord?.data);
    } catch {
      // ignore settings lookup failures; fall back to env vars
    }

    const host =
      settings.smtpHost?.trim() || this.config.get<string>('EMAIL_HOST') || '';
    const port =
      settings.smtpPort ?? this.config.get<number>('EMAIL_PORT') ?? 587;
    const user =
      settings.smtpUser?.trim() || this.config.get<string>('EMAIL_USER') || '';
    const pass =
      (settings.smtpPassword ?? '') ||
      this.config.get<string>('EMAIL_PASSWORD') ||
      '';
    const from =
      settings.smtpFromEmail?.trim() ||
      this.config.get<string>('EMAIL_FROM') ||
      'TGManager <no-reply@tgmanager.example>';

    return { host, port, user, pass, from };
  }

  get enabled(): Promise<boolean> {
    return this.smtpConfig().then((c) => Boolean(c.host));
  }

  async send(input: SendMailInput): Promise<boolean> {
    const smtp = await this.smtpConfig();
    if (!smtp.host) {
      this.logger.warn(
        `Email not sent to ${input.to} because no SMTP host is configured (set it in Platform Settings or EMAIL_HOST)`,
      );
      return false;
    }

    try {
      const transporter = this.getTransport(smtp);
      await transporter.sendMail({
        from: `${smtp.from}`,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${input.to}`,
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<boolean> {
    return this.send({
      to,
      subject: 'Reset your TGManager password',
      text:
        'A password reset was requested for your TGManager account. Open ' +
        'the link below to choose a new password:\n\n' +
        `${resetUrl}\n\n` +
        'If you did not request this, you can safely ignore this email.',
      html:
        '<p>A password reset was requested for your TGManager account. ' +
        'Click the link below to choose a new password:</p>' +
        `<p><a href="${resetUrl}">${resetUrl}</a></p>` +
        '<p>If you did not request this, you can safely ignore this email.</p>',
    });
  }

  private getTransport(smtp: SmtpConfig): nodemailer.Transporter {
    if (!this.transport) {
      this.transport = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
      });
    }
    return this.transport;
  }
}
