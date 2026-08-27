/**
 * Messaging service - sends verification codes via Email (Resend) or Telegram (Bot API)
 */

interface SendCodeResult {
  success: boolean;
  message: string;
  debug?: string; // Only in development, shows where code was "sent"
}

/**
 * Send verification code via Email using Resend API
 */
export async function sendCodeViaEmail(email: string, code: string): Promise<SendCodeResult> {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.warn('[MESSAGING] RESEND_API_KEY not set, returning code directly (dev mode)');
    return {
      success: true,
      message: 'Code de vérification envoyé par email',
      debug: code,
    };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Compte Rendu <onboarding@resend.dev>',
        to: email,
        subject: '🔑 Votre code de vérification - Compte Rendu',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="width: 56px; height: 56px; background: #EA580C; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">
                <span style="color: white; font-size: 24px;">✝</span>
              </div>
            </div>
            <h2 style="text-align: center; color: #1F2937; margin-bottom: 8px;">Vérification de votre compte</h2>
            <p style="text-align: center; color: #6B7280; font-size: 14px;">Entrez ce code pour continuer votre inscription :</p>
            <div style="text-align: center; margin: 32px 0;">
              <span style="display: inline-block; font-size: 40px; font-weight: bold; letter-spacing: 12px; color: #EA580C; background: #FFF7ED; padding: 16px 32px; border-radius: 12px; border: 2px solid #FDBA74;">
                ${code}
              </span>
            </div>
            <p style="text-align: center; color: #9CA3AF; font-size: 12px;">
              Ce code expire dans <strong>10 minutes</strong>.<br>
              Si vous n'avez pas demandé ce code, ignorez cet email.
            </p>
            <hr style="border: none; border-top: 1px solid #F3F4F6; margin: 24px 0;">
            <p style="text-align: center; color: #9CA3AF; font-size: 11px;">
              Compte Rendu — Activités Spirituelles
            </p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[RESEND] Error:', errorData);
      return {
        success: false,
        message: "Impossible d'envoyer l'email",
      };
    }

    console.log('[RESEND] Verification email sent to:', email);
    return {
      success: true,
      message: 'Code de vérification envoyé par email',
    };
  } catch (error) {
    console.error('[RESEND] Send error:', error);
    return {
      success: false,
      message: "Erreur d'envoi d'email",
    };
  }
}

/**
 * Send verification code via Telegram Bot API
 * Requires the user to have previously messaged the bot (so we have their chat_id)
 */
export async function sendCodeViaTelegram(username: string, code: string): Promise<SendCodeResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.warn('[MESSAGING] TELEGRAM_BOT_TOKEN not set, returning code directly (dev mode)');
    return {
      success: true,
      message: 'Code de vérification envoyé par Telegram',
      debug: code,
    };
  }

  try {
    // Normalize username (remove @ prefix if present)
    const normalizedUsername = username.replace(/^@/, '').toLowerCase();

    // Look up chat_id from database
    const { db } = await import('@/lib/db');
    const telegramUser = await db.telegramChat.findUnique({
      where: { username: normalizedUsername },
    });

    if (!telegramUser) {
      return {
        success: false,
        message: 'Vous devez d\'abord envoyer un message à notre bot Telegram pour recevoir le code. Cherchez @CompteRenduBot sur Telegram et envoyez /start',
      };
    }

    // Send message via Telegram Bot API
    const message = `🔑 *Code de vérification Compte Rendu* : ${code}\n\n⏱ Ce code expire dans 10 minutes.`;

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramUser.chatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[TELEGRAM] Error:', errorData);
      return {
        success: false,
        message: 'Impossible d\'envoyer le message Telegram',
      };
    }

    console.log('[TELEGRAM] Verification code sent to @' + normalizedUsername);
    return {
      success: true,
      message: 'Code envoyé sur Telegram ! Vérifiez l\'app',
    };
  } catch (error) {
    console.error('[TELEGRAM] Send error:', error);
    return {
      success: false,
      message: 'Erreur d\'envoi Telegram',
    };
  }
}

/**
 * Send verification code based on contact type
 */
export async function sendVerificationCode(
  contactType: 'email' | 'telegram',
  contact: string,
  code: string
): Promise<SendCodeResult> {
  if (contactType === 'email') {
    return sendCodeViaEmail(contact, code);
  } else {
    return sendCodeViaTelegram(contact, code);
  }
}
