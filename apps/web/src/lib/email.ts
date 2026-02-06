import nodemailer from "nodemailer";
import { getEnv } from "./env";

const env = getEnv();

// Create reusable transporter
const transporter = env.EMAIL_SMTP_HOST
  ? nodemailer.createTransport({
      host: env.EMAIL_SMTP_HOST,
      port: parseInt(env.EMAIL_SMTP_PORT || "587"),
      secure: false, // STARTTLS
      auth: {
        user: env.EMAIL_SMTP_USER,
        pass: env.EMAIL_SMTP_PASS,
      },
    })
  : null;

// Email template styling based on design system
const emailStyles = {
  container: `
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-color: #020617;
    color: #f1f5f9;
    max-width: 600px;
    margin: 0 auto;
    padding: 40px 24px;
  `,
  card: `
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9));
    border: 1px solid rgba(148, 163, 184, 0.1);
    border-radius: 16px;
    padding: 32px;
    backdrop-filter: blur(10px);
  `,
  heading: `
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 28px;
    font-weight: 700;
    color: #f8fafc;
    margin: 0 0 8px 0;
    text-align: center;
  `,
  subheading: `
    font-size: 16px;
    color: #94a3b8;
    margin: 0 0 32px 0;
    text-align: center;
    line-height: 1.5;
  `,
  codeBox: `
    background: linear-gradient(135deg, #1e293b, #0f172a);
    border: 2px solid #3b82f6;
    border-radius: 12px;
    padding: 20px;
    text-align: center;
    margin: 24px 0;
  `,
  code: `
    font-family: 'Space Grotesk', 'SF Mono', 'Monaco', monospace;
    font-size: 36px;
    font-weight: 700;
    letter-spacing: 8px;
    color: #60a5fa;
    margin: 0;
  `,
  button: `
    display: inline-block;
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: #ffffff;
    font-size: 16px;
    font-weight: 600;
    text-decoration: none;
    padding: 14px 32px;
    border-radius: 9999px;
    margin: 16px 0;
  `,
  buttonContainer: `
    text-align: center;
    margin: 24px 0;
  `,
  divider: `
    border: none;
    border-top: 1px solid rgba(148, 163, 184, 0.2);
    margin: 24px 0;
  `,
  footer: `
    font-size: 13px;
    color: #64748b;
    text-align: center;
    margin-top: 24px;
    line-height: 1.6;
  `,
  logo: `
    text-align: center;
    margin-bottom: 24px;
  `,
  logoText: `
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 24px;
    font-weight: 700;
    background: linear-gradient(135deg, #3b82f6, #06b6d4);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0;
  `,
  logoBadge: `
    display: inline-block;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(6, 182, 212, 0.2));
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 8px;
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 600;
    color: #60a5fa;
    margin-left: 8px;
  `,
};

function createEmailTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PartyQuiz - Databridge360</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; background-color: #020617;">
  <div style="${emailStyles.container}">
    <div style="${emailStyles.logo}">
      <span style="${emailStyles.logoText}">PartyQuiz</span>
      <span style="${emailStyles.logoBadge}">by Databridge360</span>
    </div>
    <div style="${emailStyles.card}">
      ${content}
    </div>
    <div style="${emailStyles.footer}">
      © ${new Date().getFullYear()} <strong>Databridge360</strong> — PartyQuiz Platform<br>
      <span style="color: #475569;">Deze email is automatisch verzonden. Niet beantwoorden.</span>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export async function sendVerificationEmail(
  email: string,
  code: string,
  name?: string
): Promise<void> {
  if (!transporter) {
    console.warn("Email not configured, skipping verification email");
    return;
  }

  const content = `
    <h1 style="${emailStyles.heading}">Welkom bij PartyQuiz!</h1>
    <p style="${emailStyles.subheading}">
      ${name ? `Hoi ${name}, ` : ""}Gebruik onderstaande code om je email te verifiëren.
    </p>
    
    <div style="${emailStyles.codeBox}">
      <p style="${emailStyles.code}">${code}</p>
    </div>
    
    <p style="text-align: center; color: #94a3b8; font-size: 14px;">
      Deze code is 15 minuten geldig.
    </p>
    
    <hr style="${emailStyles.divider}">
    
    <p style="color: #64748b; font-size: 13px; text-align: center;">
      Heb je geen account aangemaakt? Dan kun je deze email veilig negeren.
    </p>
  `;

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: email,
    subject: "🎉 Verifieer je PartyQuiz account",
    html: createEmailTemplate(content),
  });
}

export async function sendPasswordResetEmail(
  email: string,
  code: string,
  resetUrl: string
): Promise<void> {
  if (!transporter) {
    console.warn("Email not configured, skipping password reset email");
    return;
  }

  const content = `
    <h1 style="${emailStyles.heading}">Wachtwoord resetten</h1>
    <p style="${emailStyles.subheading}">
      We hebben een aanvraag ontvangen om je wachtwoord te resetten.
    </p>
    
    <div style="${emailStyles.codeBox}">
      <p style="color: #94a3b8; font-size: 14px; margin: 0 0 8px 0;">Je verificatiecode:</p>
      <p style="${emailStyles.code}">${code}</p>
    </div>
    
    <div style="${emailStyles.buttonContainer}">
      <a href="${resetUrl}" style="${emailStyles.button}">Wachtwoord resetten</a>
    </div>
    
    <p style="text-align: center; color: #94a3b8; font-size: 14px;">
      Of kopieer deze link: <span style="color: #60a5fa;">${resetUrl}</span>
    </p>
    
    <hr style="${emailStyles.divider}">
    
    <p style="color: #64748b; font-size: 13px; text-align: center;">
      Deze link en code zijn 1 uur geldig.<br>
      Heb je geen wachtwoord reset aangevraagd? Dan kun je deze email veilig negeren.
    </p>
  `;

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: email,
    subject: "🔐 Reset je PartyQuiz wachtwoord",
    html: createEmailTemplate(content),
  });
}

export async function sendMagicLinkEmail(
  email: string,
  url: string
): Promise<void> {
  if (!transporter) {
    console.warn("Email not configured, skipping magic link email");
    return;
  }

  const content = `
    <h1 style="${emailStyles.heading}">Inloggen bij PartyQuiz</h1>
    <p style="${emailStyles.subheading}">
      Klik op de knop hieronder om direct in te loggen.
    </p>
    
    <div style="${emailStyles.buttonContainer}">
      <a href="${url}" style="${emailStyles.button}">Inloggen</a>
    </div>
    
    <p style="text-align: center; color: #94a3b8; font-size: 14px;">
      Of kopieer deze link: <span style="color: #60a5fa; word-break: break-all;">${url}</span>
    </p>
    
    <hr style="${emailStyles.divider}">
    
    <p style="color: #64748b; font-size: 13px; text-align: center;">
      Deze link is 24 uur geldig.<br>
      Heb je niet geprobeerd in te loggen? Dan kun je deze email veilig negeren.
    </p>
  `;

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: email,
    subject: "🎉 Log in bij PartyQuiz",
    html: createEmailTemplate(content),
  });
}

// Generate a 6-digit verification code
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate a secure random token
export function generateResetToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
