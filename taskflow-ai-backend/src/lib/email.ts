import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 25),
  secure: false,
  auth: process.env.SMTP_PASSWORD
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    : undefined,
})

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  await transporter.sendMail({
    from: `"TaskFlow AI" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Restablecer contraseña — TaskFlow AI',
    html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e,#292944);padding:32px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:40px;height:40px;background:#2563eb;border-radius:10px;display:inline-block;vertical-align:middle;line-height:40px;text-align:center;">
                  <span style="color:#fff;font-size:20px;font-weight:bold;">⚡</span>
                </div>
                <span style="color:#ffffff;font-size:22px;font-weight:700;vertical-align:middle;margin-left:8px;">TaskFlow AI</span>
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Restablecer contraseña</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">Hola <strong>${name}</strong>,</p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta en TaskFlow AI.
                Hacé clic en el botón a continuación para crear una nueva contraseña.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${resetUrl}"
                   style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">
                  Restablecer contraseña
                </a>
              </div>
              <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;line-height:1.5;">
                Si no solicitaste este cambio, podés ignorar este correo. Tu contraseña no será modificada.
              </p>
              <p style="margin:0;font-size:13px;color:#9ca3af;">
                Este enlace expira en <strong>1 hora</strong>.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                © ${new Date().getFullYear()} TaskFlow AI · Este es un mensaje automático, no respondas este correo.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  })
}

export async function sendAlertEmail(
  to: string,
  name: string,
  title: string,
  body: string,
  taskUrl?: string,
) {
  await transporter.sendMail({
    from: `"TaskFlow AI" <${process.env.SMTP_USER}>`,
    to,
    subject: `${title} — TaskFlow AI`,
    html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e,#292944);padding:32px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:40px;height:40px;background:#2563eb;border-radius:10px;display:inline-block;vertical-align:middle;line-height:40px;text-align:center;">
                  <span style="color:#fff;font-size:20px;font-weight:bold;">⚡</span>
                </div>
                <span style="color:#ffffff;font-size:22px;font-weight:700;vertical-align:middle;margin-left:8px;">TaskFlow AI</span>
              </div>
            </td>
          </tr>
          <!-- Alert banner -->
          <tr>
            <td style="background:#fef3c7;border-bottom:3px solid #f59e0b;padding:16px 40px;">
              <p style="margin:0;font-size:13px;font-weight:600;color:#92400e;letter-spacing:0.05em;text-transform:uppercase;">
                🔔 Alerta de automatización
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">${title}</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">Hola <strong>${name}</strong>,</p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                Se disparó una automatización en tu espacio de trabajo:
              </p>
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #2563eb;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
                <p style="margin:0;font-size:15px;color:#1e293b;font-family:monospace;">${body}</p>
              </div>
              ${taskUrl ? `
              <div style="text-align:center;margin:24px 0 0;">
                <a href="${taskUrl}"
                   style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">
                  Ver tarea
                </a>
              </div>
              ` : ''}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                © ${new Date().getFullYear()} TaskFlow AI · Este es un mensaje automático generado por una automatización.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  })
}
