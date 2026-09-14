export type MailgunMailMessage = {
  to: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
};

// Sends via Mailgun's HTTP API. MAILGUN_DOMAIN must be a domain verified in
// Mailgun (SPF/DKIM DNS records added) before it can send mail.
export async function mailgunSendMail(message: MailgunMailMessage): Promise<void> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.MAILGUN_FROM;
  // EU-region Mailgun accounts must use api.eu.mailgun.net instead.
  const baseUrl = process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";
  if (!apiKey || !domain || !from) {
    throw new Error("Mailgun credentials are not configured");
  }

  const body = new URLSearchParams();
  body.set("from", from);
  for (const recipient of message.to) body.append("to", recipient);
  for (const recipient of message.bcc ?? []) body.append("bcc", recipient);
  body.set("subject", message.subject);
  body.set("html", message.html);
  if (message.text) body.set("text", message.text);

  const response = await fetch(`${baseUrl}/v3/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`api:${apiKey}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Mailgun sendMail failed: ${response.status} ${await response.text()}`);
  }
}

export function isMailgunConfigured(): boolean {
  return Boolean(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN && process.env.MAILGUN_FROM);
}
