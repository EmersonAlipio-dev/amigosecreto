import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();
    const cleanPhone = phone.replace(/\D/g, ''); // Limpa traços e parênteses
    
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    // Pega diretamente o número/ID que o familiar digitou no ecrã
    const chatId = cleanPhone;

    // Log para ver se as variáveis de ambiente carregaram bem
    console.log("Token do Bot carregado:", botToken ? "SIM" : "NÃO");
    console.log("Chat ID carregado:", chatId ? "SIM" : "NÃO");

    if (!botToken || !chatId) {
       return NextResponse.json({ error: "Faltam as variáveis do Telegram no ficheiro .env.local! Reiniciaste o servidor?" }, { status: 400 });
    }

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // 1. Tentar guardar no Supabase
    const { error: dbError } = await supabaseAdmin
      .from('otp_codes')
      .upsert({ phone: cleanPhone, code, expires_at: expiresAt });

    if (dbError) {
        console.error("Erro ao guardar no Supabase:", dbError);
        return NextResponse.json({ error: "Erro de banco de dados: " + dbError.message }, { status: 500 });
    }

    // 2. Tentar enviar para o Telegram
    console.log("A enviar para o Telegram o código:", code);
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        parse_mode: 'Markdown',
        text: `🔐 *Verificador Amigo Secreto*\n\nNúmero informado: \`${phone}\`\nSeu código de acesso é: *${code}*`,
      }),
    });

    const tgData = await tgRes.json();
    
    if (!tgData.ok) {
      console.error("O Telegram rejeitou o envio:", tgData);
      return NextResponse.json({ error: "O Telegram recusou a mensagem. Já abriste o Bot e clicaste em /start?" }, { status: 400 });
    }

    return NextResponse.json({ success: true, chatId });
  } catch (err: any) {
    console.error("Erro GERAL na API:", err);
    return NextResponse.json({ error: "Falha catastrófica: " + err.message }, { status: 500 });
  }
}