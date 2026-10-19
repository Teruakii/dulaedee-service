import nodemailer from 'nodemailer'
import type { Logger } from '../logs.js'

export type Mail = { to: string; subject: string; text: string }
export type Mailer = { send(m: Mail): Promise<void> }

// ยังไม่ตั้ง SMTP: พิมพ์อีเมลลง log แทน ใช้ทดสอบบนเครื่องได้โดยไม่ต้องสมัครบริการใด
export const logMailer = (logger: Logger): Mailer => ({
  async send(m) {
    logger.info('MAIL_NOT_SENT_SMTP_NOT_CONFIGURED', { to: m.to, subject: m.subject, text: m.text })
  },
})

// SMTP_URL เช่น smtps://you%40gmail.com:app-password@smtp.gmail.com:465 (Gmail + App Password ใช้ฟรี)
export const smtpMailer = (url: string, from: string): Mailer => {
  const transport = nodemailer.createTransport(url)
  return {
    async send(m) {
      await transport.sendMail({ from, ...m })
    },
  }
}
