import { mailgunSendMail } from "./mailgun-client";

export type EmailMessage = {
  to: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
};

// Thin interface in front of the Mailgun client — call sites depend only on
// this, so the underlying provider can be swapped without touching them.
export async function sendEmail(message: EmailMessage): Promise<void> {
  await mailgunSendMail(message);
}
