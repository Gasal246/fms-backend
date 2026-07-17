import nodemailer from "nodemailer";
import { env } from "../../config/env.config.js";
import { logger } from "../../shared/logger/logger.js";

export class CompanyMailService {
  private transporter = env.smtp.host ? nodemailer.createTransport({ host: env.smtp.host, port: env.smtp.port, secure: env.smtp.secure, auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined }) : null;

  async sendSetup(email: string, companyName: string, setupUrl: string) {
    if (!this.transporter) {
      logger.warn(`SMTP is not configured; company setup link must be shared manually for ${email}`);
      return { delivered: false, setupUrl };
    }
    try {
      await this.transporter.sendMail({ from: env.smtp.from, to: email, subject: `Set up ${companyName} Company Portal access`, text: `Complete your Company Portal setup: ${setupUrl}`, html: `<p>Complete your <strong>${companyName}</strong> Company Portal setup:</p><p><a href="${setupUrl}">Set up account</a></p>` });
      return { delivered: true, setupUrl };
    } catch (error) {
      logger.error(`Company setup email failed: ${error}`);
      return { delivered: false, setupUrl };
    }
  }

  async sendMembershipRequest(email: string, companyName: string, clientName: string) {
    if (!this.transporter) return { delivered: false };
    try {
      await this.transporter.sendMail({ from: env.smtp.from, to: email, subject: `${clientName} requested access to ${companyName}`, text: `${clientName} has requested a Company Portal membership. Sign in and review it from your profile.`, html: `<p><strong>${clientName}</strong> requested access to <strong>${companyName}</strong>.</p><p>Sign in and review the request from your Company profile.</p>` });
      return { delivered: true };
    } catch (error) {
      logger.error(`Membership request email failed: ${error}`);
      return { delivered: false };
    }
  }
}
