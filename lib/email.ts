import { Resend } from "resend";
import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL ?? "TLC Consultations <noreply@example.com>";
const TIMEZONE = "Asia/Singapore";

export async function sendBookingConfirmation(params: {
  to: string;
  name: string;
  slotStart: string;
  slotEnd: string;
}): Promise<void> {
  const { to, name, slotStart } = params;

  const slotDate = formatInTimeZone(parseISO(slotStart), TIMEZONE, "EEEE, d MMMM yyyy");
  const slotTime = formatInTimeZone(parseISO(slotStart), TIMEZONE, "h:mm a");
  const firstName = name.split(" ")[0];

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Booking Confirmed — The Loan Connection</title>
</head>
<body style="margin:0;padding:0;background:#f9f9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e8e8e4;border-radius:8px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:40px 48px 32px;border-bottom:1px solid #f0f0ec;">
              <p style="margin:0 0 24px;font-size:11px;font-weight:600;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;">The Loan Connection</p>
              <h1 style="margin:0;font-size:26px;font-weight:600;color:#111827;letter-spacing:-0.3px;line-height:1.3;">
                Your consultation is confirmed.
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 48px;">
              <p style="margin:0 0 28px;font-size:15px;color:#4b5563;line-height:1.7;">
                Hi ${firstName},<br/><br/>
                We look forward to speaking with you about your mortgage journey. Here are your booking details:
              </p>

              <!-- Details card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f7;border:1px solid #e8e8e4;border-radius:6px;margin-bottom:28px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:16px;">
                          <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.08em;color:#9ca3af;text-transform:uppercase;">Date</p>
                          <p style="margin:0;font-size:15px;font-weight:500;color:#111827;">${slotDate}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:16px;border-top:1px solid #e8e8e4;padding-top:16px;">
                          <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.08em;color:#9ca3af;text-transform:uppercase;">Time</p>
                          <p style="margin:0;font-size:15px;font-weight:500;color:#111827;">${slotTime} (Singapore Time)</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:0;border-top:1px solid #e8e8e4;padding-top:16px;">
                          <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.08em;color:#9ca3af;text-transform:uppercase;">Duration</p>
                          <p style="margin:0;font-size:15px;font-weight:500;color:#111827;">45 minutes</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                We will contact you with the meeting details. If you need to reschedule, simply reply to this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 48px;border-top:1px solid #f0f0ec;">
              <p style="margin:0;font-size:12px;color:#d1d5db;line-height:1.6;">
                The Loan Connection · Singapore<br/>
                This is an automated confirmation. Please do not reply directly to this message.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  await resend.emails.send({
    from: FROM,
    to,
    bcc: "dexter@theloanconnection.com.sg",
    subject: `Confirmed: Mortgage Consultation on ${slotDate}`,
    html,
  });
}
