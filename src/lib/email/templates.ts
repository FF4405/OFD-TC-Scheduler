function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Hex approximations of the app's --brand/--brand-dark oklch tokens (see
// globals.css) — email clients render inline HTML, not the app's CSS custom
// properties, so the brand color has to be restated here as a plain hex
// gradient. background-color is set separately from the background-image
// gradient so a client that can't parse the gradient value drops just that
// declaration and falls back to the solid color instead of losing the
// header color entirely.
const BRAND = "#b91c1c";
const BRAND_DARK = "#7f1d1d";

function emailLayout(bodyHtml: string): string {
  return `
    <div style="background-color:#f4f4f5;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
        <tr>
          <td style="background-color:${BRAND};background-image:linear-gradient(135deg, ${BRAND}, ${BRAND_DARK});padding:20px 28px;">
            <span style="font-size:17px;font-weight:600;color:#ffffff;">🔥 OFD TC Scheduler</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;color:#27272a;font-size:14px;line-height:1.6;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 28px;border-top:1px solid #e4e4e7;color:#a1a1aa;font-size:12px;">
            Oradell Fire Department · Truck Company Check Scheduler
          </td>
        </tr>
      </table>
    </div>
  `;
}

function button(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;padding:11px 20px;background-color:${BRAND};color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">${label}</a>`;
}

export function otpCodeEmail(params: { code: string }) {
  const subject = `${params.code} is your OFD TC Scheduler sign-in code`;
  const html = emailLayout(`
    <p style="margin:0 0 16px;">Here&apos;s your sign-in code:</p>
    <div style="margin:0 0 16px;padding:18px;background-color:#f4f4f5;border-radius:8px;text-align:center;">
      <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:${BRAND};">${escapeHtml(params.code)}</span>
    </div>
    <p style="margin:0;color:#71717a;font-size:13px;">
      This code expires in 10 minutes. If you didn&apos;t request this, you can ignore this email.
    </p>
  `);
  return { subject, html };
}

export function accessRequestSubmittedEmail(params: {
  requesterName: string;
  requesterEmail: string;
  reviewUrl: string;
}) {
  const subject = `Access request — ${params.requesterName}`;
  const html = emailLayout(`
    <p style="margin:0 0 16px;"><strong>${escapeHtml(params.requesterName)}</strong> (${escapeHtml(params.requesterEmail)}) asked to join OFD TC Scheduler.</p>
    <p style="margin:0;">${button(params.reviewUrl, "Review this request")}</p>
  `);
  return { subject, html };
}

export function accessRequestDecisionEmail(params: {
  status: "approved" | "denied";
  reviewNote?: string;
  appUrl: string;
}) {
  const subject = `Your access request was ${params.status}`;
  const html = emailLayout(`
    <p style="margin:0 0 16px;">Your request to join OFD TC Scheduler was <strong>${params.status}</strong>.</p>
    ${params.reviewNote ? `<p style="margin:0 0 16px;"><strong>Note:</strong> ${escapeHtml(params.reviewNote)}</p>` : ""}
    <p style="margin:0;">${button(params.appUrl, "Go to OFD TC Scheduler")}</p>
  `);
  return { subject, html };
}

// The check reminder — the one recurring email the pre-Cloudflare version
// of this app sent, manually or every Monday morning via cron.
export function checkReminderEmail(params: {
  memberName: string;
  apparatusName: string;
  slotType: string;
  weekDate: string;
  weekDateLabel: string;
  appUrl: string;
}) {
  const subject = `Reminder: ${params.apparatusName} ${params.slotType} Check Due by 7PM`;
  const text = [
    `Hi ${params.memberName},`,
    "",
    `This is a reminder that your ${params.apparatusName} ${params.slotType} check is due by 7PM this Monday (${params.weekDateLabel}).`,
    "",
    "Please log your completion in First Due.",
    "",
    "Thank you,",
    "Oradell Fire Department",
  ].join("\n");
  const html = emailLayout(`
    <p style="margin:0 0 12px;">Hi ${escapeHtml(params.memberName)},</p>
    <p style="margin:0 0 16px;">This is a reminder that your <strong>${escapeHtml(params.apparatusName)} ${escapeHtml(params.slotType)}</strong> check is due by <strong>7PM this Monday</strong> (${escapeHtml(params.weekDateLabel)}).</p>
    <p style="margin:0 0 16px;">Please log your completion in First Due.</p>
    <p style="margin:0;">${button(params.appUrl, "View the schedule")}</p>
  `);
  return { subject, html, text };
}
