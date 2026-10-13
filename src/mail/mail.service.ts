import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Environment } from '../config/environment.js';

export interface PasswordResetMail {
  to: string;
  name: string;
  resetUrl: string;
}

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService<Environment, true>) {
    const port = config.get('SMTP_PORT', { infer: true });
    const user = config.get('SMTP_USER', { infer: true });
    this.from = config.get('SMTP_FROM', { infer: true });
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port,
      secure: port === 465,
      auth: user
        ? { user, pass: config.get('SMTP_PASSWORD', { infer: true }) }
        : undefined,
    });
  }

  async sendPasswordReset({ to, name, resetUrl }: PasswordResetMail) {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Care Senior — redefinição de senha',
      text: [
        `Olá, ${name}!`,
        '',
        'Recebemos um pedido para redefinir a sua senha no Care Senior.',
        `Para criar uma nova senha, acesse: ${resetUrl}`,
        '',
        'O link expira em 1 hora. Se você não fez esse pedido, ignore este e-mail.',
      ].join('\n'),
    });
  }
}
