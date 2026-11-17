import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();
    const cleanPhone = phone.replace(/\D/g, ''); // Apenas os números

    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
       return NextResponse.json({ error: "Faltam as variáveis do Telegram no ficheiro .env.local!" }, { status: 400 });
    }

    // 1. O TRUQUE: Ler as últimas mensagens recebidas pelo Bot para descobrir o Chat ID
    const updatesRes = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`);
    const updatesData = await updatesRes.json();
    
    let targetChatId = null;

    if (updatesData.ok && updatesData.result) {
      // Lemos de trás para a frente (as mais recentes primeiro)
      for (let i = updatesData.result.length - 1; i >= 0; i--) {
        const msg = updatesData.result[i].message;
        if (msg && msg.text) {
          // Limpamos o texto que a pessoa enviou no Telegram para deixar só números
          const textClean = msg.text.replace(/\D/g, '');
          
          // Se o que a pessoa enviou ao bot for igual ao número que digitou no site: BINGO!
          if (textClean === cleanPhone) {
            targetChatId = msg.chat.id;
            break;
          }
        }
      }
    }

    // Se o Bot não encontrou nenhuma mensagem com esse número
    if (!targetChatId) {
      return NextResponse.json({ 
        error: "O Bot não sabe quem tu és! Vai ao Telegram, escreve o teu número (ex: 41991131797) na conversa com o Bot e depois clica em Verificar novamente." 
      }, { status: 400 });
    }

    // 2. Gerar e guardar o código OTP no Supabase
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: dbError } = await supabaseAdmin
      .from('otp_codes')
      .upsert({ phone: cleanPhone, code, expires_at: expiresAt });

    if (dbError) {
        return NextResponse.json({ error: "Erro de base de dados: " + dbError.message }, { status: 500 });
    }

    // 3. Enviar o OTP pelo Telegram usando o Chat ID verdadeiro que acabámos de descobrir!
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        parse_mode: 'Markdown',
        text: `🔐 *Verificador Amigo Secreto*\n\nNúmero validado: \`${phone}\`\nO teu código de acesso é: *${code}*`,
      }),
    });

    const tgData = await tgRes.json();
    
    if (!tgData.ok) {
      return NextResponse.json({ error: "O Telegram recusou o envio. Tenta novamente." }, { status: 400 });
    }

    // Retornamos o Chat ID para o frontend guardar na base de dados (para o sorteio saber para onde enviar!)
    return NextResponse.json({ success: true, chatId: targetChatId });
  } catch (err: any) {
    console.error("Erro na API OTP:", err);
    return NextResponse.json({ error: "Erro interno: " + err.message }, { status: 500 });
  }
}