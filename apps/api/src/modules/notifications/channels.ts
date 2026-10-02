import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { AppConfig } from '../../config/app-config.js';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface DeliveryResult {
  simulated: boolean;
  reference?: string;
}

/** SMTP email channel (INT-07). Without SMTP configuration, messages are recorded but not sent. */
@Injectable()
export class EmailChannel {
  private readonly logger = new Logger(EmailChannel.name);
  private readonly transporter?: Transporter;
  private readonly from?: string;

  constructor(config: AppConfig) {
    if (config.smtp) {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        requireTLS: !config.smtp.secure,
        auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
      });
      this.from = config.smtp.from;
    }
  }

  async send(
    to: string,
    subject: string,
    text: string,
    attachments: EmailAttachment[] = [],
  ): Promise<DeliveryResult> {
    if (!this.transporter) {
      this.logger.debug(`Email not sent (SMTP not configured): "${subject}"`);
      return { simulated: true };
    }
    const info = await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      text,
      attachments,
    });
    return { simulated: false, reference: info.messageId };
  }
}

/**
 * SMS channel (INT-08) using the HTTP API of the approved SMS provider. The request
 * format below is the common JSON shape; it is adapted to the selected provider
 * during the integration phase.
 */
@Injectable()
export class SmsChannel {
  private readonly logger = new Logger(SmsChannel.name);

  constructor(private readonly config: AppConfig) {}

  async send(mobile: string, text: string): Promise<DeliveryResult> {
    const sms = this.config.integration.sms;
    if (!sms) {
      this.logger.debug('SMS not sent (SMS gateway not configured)');
      return { simulated: true };
    }
    const response = await fetch(`${sms.baseUrl}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${sms.apiKey}` },
      body: JSON.stringify({ from: sms.senderId, to: mobile, text }),
      signal: AbortSignal.timeout(sms.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`SMS gateway responded with HTTP ${response.status}`);
    }
    const body = (await response.json().catch(() => ({}))) as { id?: string };
    return { simulated: false, reference: body.id };
  }
}
