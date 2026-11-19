import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { roomId } = await req.json();

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
      .select('*')
      .eq('room_id', roomId);

    if (partError || !participants) {
      return NextResponse.json({ error: 'Erro ao buscar participantes.' }, { status: 500 });
    }

    // Alterado para aceitar a partir de 2 participantes
    if (participants.length < 2) {
      return NextResponse.json(
        { error: 'São necessários pelo menos 2 participantes na sala para sortear!' },
        { status: 400 }
      );
    }

    // Embaralhamento circular (garante que ninguém tira a si mesmo, mesmo com 2 pessoas)
    const shuffled = [...participants].sort(() => Math.random() - 0.5);

    for (let i = 0; i < shuffled.length; i++) {
      const giver = shuffled[i];
      const receiver = shuffled[(i + 1) % shuffled.length];

      await supabaseAdmin
        .from('participants')
        .update({ drawn_participant_id: receiver.id })
        .eq('id', giver.id);
    }

    await supabaseAdmin.from('rooms').update({ status: 'drawn' }).eq('id', roomId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Erro na rota de sorteio:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}