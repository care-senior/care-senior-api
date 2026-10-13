import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { UserRole } from '../../../common/enums/index.js';
import type { Environment } from '../../../config/environment.js';

export interface InviteMail {
  to: string;
  name: string;
  inviteUrl: string;
  role: UserRole;
}

const INVITE_REASON: Record<UserRole, string> = {
  [UserRole.STAFF]:
    'Você foi cadastrado(a) na equipe de uma clínica no Care Senior.',
  [UserRole.GUARDIAN]:
    'Você foi cadastrado(a) como responsável de um idoso acompanhado por uma clínica no Care Senior.',
};

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

  async sendInvite({ to, name, inviteUrl, role }: InviteMail) {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Care Senior — crie sua senha de acesso',
      text: [
        `Olá, ${name}!`,
        '',
        INVITE_REASON[role],
        `Para criar sua senha de acesso, acesse: ${inviteUrl}`,
        '',
        'O link expira em 72 horas. Depois disso, use "Esqueci minha senha" na tela de login.',
      ].join('\n'),
    });
  }
}
