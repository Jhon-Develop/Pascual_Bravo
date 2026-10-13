import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

export type EmailDelivery = { delivered: boolean; developmentUrl?: string };
export interface EmailService {
  sendPasswordReset(to: string, name: string, token: string): Promise<EmailDelivery>;
  sendGroupInvitation(to: string, groupName: string, invitationUrl: string, inviterName: string): Promise<void>;
}
export class ConfiguredEmailService implements EmailService {
  async sendGroupInvitation(to: string, groupName: string, invitationUrl: string, inviterName: string): Promise<void> {
    if (env.EMAIL_TRANSPORT !== 'smtp') return;
    const transporter = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 8000 });
    await transporter.sendMail({ from: env.EMAIL_FROM, to, subject: `Invitación a ${groupName} en Pazito`, text: `${inviterName} te invitó a participar en el grupo ${groupName}. Regístrate e ingresa con este enlace:\n${invitationUrl}\n\nSi no esperabas esta invitación, ignora este correo.`, html: `<p>${escapeHtml(inviterName)} te invitó a participar en <strong>${escapeHtml(groupName)}</strong> en Pazito.</p><p><a href="${invitationUrl}">Aceptar invitación</a></p><p>Si no esperabas esta invitación, ignora este correo.</p>` });
  }
  async sendPasswordReset(to: string, name: string, token: string): Promise<EmailDelivery> {
    const url = `${env.frontendOrigins[0] ?? 'http://localhost:4321'}/auth/reset?token=${encodeURIComponent(token)}`;
    if (env.EMAIL_TRANSPORT === 'disabled') return { delivered: false };
    if (env.EMAIL_TRANSPORT === 'log') {
      // Never log the reset token. In development only, caller may expose a local reset URL once in the HTTP response.
      return { delivered: false, ...(env.NODE_ENV === 'development' ? { developmentUrl: url } : {}) };
    }
    const transporter = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 8000 });
    await transporter.sendMail({ from: env.EMAIL_FROM, to, subject: 'Restablece tu contraseña de Pazito',
      text: `Hola ${name},\n\nPara restablecer tu contraseña abre este enlace (válido ${env.PASSWORD_RESET_TTL_MINUTES} minutos):\n${url}\n\nSi no lo solicitaste, ignora este mensaje.`,
      html: `<p>Hola ${escapeHtml(name)},</p><p>Solicitaste restablecer tu contraseña. El enlace caduca en ${env.PASSWORD_RESET_TTL_MINUTES} minutos.</p><p><a href="${url}">Restablecer contraseña</a></p><p>Si no lo solicitaste, ignora este mensaje.</p>` });
    return { delivered: true };
  }
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!); }
export const emailService: EmailService = new ConfiguredEmailService();
