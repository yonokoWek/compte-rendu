import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Telegram Webhook - receives updates when users message the bot
 * Stores the mapping: telegram username → chat_id
 */
export async function POST(request: Request) {
  try {
    if (!BOT_TOKEN) {
      console.error('[TELEGRAM WEBHOOK] TELEGRAM_BOT_TOKEN not set');
      return NextResponse.json({ error: 'Bot not configured' }, { status: 500 });
    }

    const update = await request.json();

    // Verify this is from Telegram (optional but recommended)
    // In production, you should verify the secret token

    const message = update.message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const from = message.from;
    const text = message.text || '';

    console.log(`[TELEGRAM] Message from @${from.username || 'unknown'} (${chatId}): ${text}`);

    // Store or update the user's Telegram info
    if (from) {
      const username = from.username?.toLowerCase();
      if (username) {
        await db.telegramChat.upsert({
          where: { username },
          create: {
            chatId,
            username,
            firstName: from.first_name || '',
            lastName: from.last_name || '',
          },
          update: {
            chatId,
            firstName: from.first_name || '',
            lastName: from.last_name || '',
          },
        });
      }
    }

    // Handle /start command
    if (text === '/start') {
      await sendMessage(
        chatId,
        `👋 Bienvenue sur *Compte Rendu* !\n\n` +
        `Votre compte Telegram est maintenant lié.\n` +
        `Vous pouvez vous inscrire sur l'application et entrer votre username Telegram pour recevoir vos codes de vérification ici.\n\n` +
        `🔗 *Votre username* : @${from?.username || 'non défini'}\n\n` +
        `ℹ️ Si vous n'avez pas de username Telegram, allez dans Paramètres > Username et créez-en un.`,
        'Markdown'
      );
    }
    // Handle /help command
    else if (text === '/help') {
      await sendMessage(
        chatId,
        `📖 *Aide Compte Rendu Bot*\n\n` +
        `Ce bot vous permet de recevoir vos codes de vérification par Telegram.\n\n` +
        `📋 *Étapes pour vous inscrire :*\n` +
        `1. Allez sur l'application Compte Rendu\n` +
        `2. Choisissez "Telegram" comme méthode\n` +
        `3. Entrez votre username Telegram (ex: @monnom)\n` +
        `4. Le code de vérification vous sera envoyé ici\n\n` +
        `⚠️ Vous devez avoir un username Telegram défini.`,
        'Markdown'
      );
    }
    // Handle /myid command
    else if (text === '/myid') {
      await sendMessage(
        chatId,
        `🔢 *Vos informations :*\n\n` +
        `• Chat ID : \`${chatId}\`\n` +
        `• Username : @${from?.username || 'non défini'}\n` +
        `• Nom : ${from?.first_name || ''} ${from?.last_name || ''}`,
        'Markdown'
      );
    }
    // Default response
    else {
      await sendMessage(
        chatId,
        `✅ Votre compte est lié (Chat ID: ${chatId}).\n\n` +
        `Vous pouvez maintenant utiliser @${from?.username || 'votre username'} pour recevoir vos codes de vérification sur l'application.`,
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[TELEGRAM WEBHOOK] Error:', error);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}

/**
 * GET - Used by Telegram to verify the webhook is set up
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    message: 'Telegram webhook is running',
  });
}

/**
 * Helper: Send a message via Telegram Bot API
 */
async function sendMessage(
  chatId: number,
  text: string,
  parseMode?: string
): Promise<void> {
  if (!BOT_TOKEN) return;

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode || undefined,
      }),
    });
  } catch (err) {
    console.error('[TELEGRAM] Send error:', err);
  }
}
