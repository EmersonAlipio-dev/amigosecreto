import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { roomId } = body;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const testChatId = process.env.TELEGRAM_TEST_CHAT_ID;

    if (!botToken) {
      return NextResponse.json({ error: 'Token do Telegram não configurado no servidor.' }, { status: 500 });
    }

    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: 'Sala não encontrada.' }, { status: 404 });
    }

    const { data: participants, error: partError } = await supabaseAdmin
      .from('participants')
      .select('*, gift_suggestions(*)')
      .eq('room_id', roomId);

    if (partError || !participants) {
      return NextResponse.json({ error: 'Erro ao buscar participantes.' }, { status: 500 });
    }

    if (participants.length < 3) {
      return NextResponse.json(
        { error: 'São necessários pelo menos 3 participantes na sala para sortear!' },
        { status: 400 }
      );
    }

    // Embaralhamento circular (ninguém tira a si mesmo)
    const shuffled = [...participants].sort(() => Math.random() - 0.5);

    for (let i = 0; i < shuffled.length; i++) {
      const giver = shuffled[i];
      const receiver = shuffled[(i + 1) % shuffled.length];

      await supabaseAdmin
        .from('participants')
        .update({ drawn_participant_id: receiver.id })
        .eq('id', giver.id);

      const giftsList = receiver.gift_suggestions
        .map((g: any, idx: number) => {
          const link = g.item_link ? ` (<a href="${g.item_link}">Link</a>)` : '';
          return `  ${idx + 1}. <b>${g.item_name}</b>${link}`;
        })
        .join('\n');

      const caption =
        `🎁 <b>Olá, ${giver.name}! Sorteio realizado na sala "${room.name}"!</b>\n\n` +
        `O seu Amigo Secreto é:\n` +
        `👤 <b>Nome:</b> ${receiver.name}\n` +
        `🎂 <b>Idade:</b> ${receiver.age} anos\n\n` +
        `✨ <b>Sugestões de Presentes:</b>\n${giftsList}\n\n` +
        `🤫 <i>Guarde segredo!</i>`;

      // Usa a URL oficial de produção que vamos configurar na Vercel
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL; 
      const ogUrl = `${baseUrl}/api/og?name=${encodeURIComponent(
        receiver.name
      )}&age=${receiver.age}&photo=${encodeURIComponent(
        receiver.photo_url
      )}&room=${encodeURIComponent(room.name)}`;

      // Agora usa exclusivamente o Chat ID de quem está a participar!
      const targetChatId = giver.telegram_chat_id;

      try {
        const imgRes = await fetch(ogUrl);
        
        if (!imgRes.ok) throw new Error(`Erro API OG: ${imgRes.status}`);

        const imgBuffer = await imgRes.arrayBuffer();
        const file = new File([imgBuffer], 'amigo-secreto.png', { type: 'image/png' });
        
        const formData = new FormData();
        formData.append('chat_id', targetChatId);
        formData.append('photo', file);
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');

        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: 'POST',
          body: formData,
        });

        if (!tgRes.ok) throw new Error('Telegram rejeitou a foto.');
        
      } catch (err) {
        console.error(`Erro na foto para ${giver.name}, a usar fallback de texto.`, err);
        
        // Fallback garantido
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: targetChatId,
              parse_mode: 'HTML',
              text: caption,
            }),
        });
      }
    }
    // Marca a sala como sorteada
    await supabaseAdmin.from('rooms').update({ status: 'drawn' }).eq('id', roomId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Erro na rota de sorteio:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}