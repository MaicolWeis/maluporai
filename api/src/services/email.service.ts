import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface EmailDriver {
  send(message: EmailMessage): Promise<void>;
}

/** Driver de dev/test: nunca envia de verdade, só loga (sem dado sensível). */
class ConsoleEmailDriver implements EmailDriver {
  async send(message: EmailMessage): Promise<void> {
    logger.info({ to: message.to, subject: message.subject }, '[email:console] e-mail simulado');
    // eslint-disable-next-line no-console
    console.log(`\n--- e-mail (driver console) ---\nPara: ${message.to}\nAssunto: ${message.subject}\n${message.html}\n---\n`);
  }
}

class ResendEmailDriver implements EmailDriver {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
      }),
    });

    if (!res.ok) {
      logger.error({ status: res.status }, 'Falha ao enviar e-mail via Resend');
      throw new Error('Falha ao enviar e-mail');
    }
  }
}

export const emailService: EmailDriver =
  env.NODE_ENV === 'production' && env.RESEND_API_KEY && env.EMAIL_FROM
    ? new ResendEmailDriver(env.RESEND_API_KEY, env.EMAIL_FROM)
    : new ConsoleEmailDriver();
