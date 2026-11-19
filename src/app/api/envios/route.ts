import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Presente = { item_name: string; item_link: string | null };

type Pessoa = {
  id: string;
  name: string;
  age: number;
  phone: string;
  drawn_participant_id: string | null;
  gift_suggestions: Presente[];
};

// wa.me aceita só dígitos, com DDI. Número brasileiro sem DDI (10 ou 11 dígitos) ganha o 55.
function numeroWhatsApp(telefone: string) {
  const digitos = telefone.replace(/\D/g, '');
  return digitos.length <= 11 ? `55${digitos}` : digitos;
}

function montarMensagem(recebedor: string, amigo: Pessoa) {
  const presentes = amigo.gift_suggestions
    .map((g, i) => `${i + 1}. ${g.item_name}${g.item_link ? `\n${g.item_link}` : ''}`)
    .join('\n');

  return [
    `🎁 Oi, ${recebedor}! No Amigo Secreto você tirou: *${amigo.name}*`,
    `🎂 Idade: ${amigo.age} anos`,
    '',
    '✨ Sugestões de presente:',
    presentes,
    '',
    '🤫 Guarde segredo!',
  ].join('\n');
}

export async function POST(req: Request) {
  try {
    const { roomId, hostToken } = await req.json();

    const { data: room } = await supabaseAdmin
      .from('rooms')
      .select('id, status, host_token')
      .eq('id', roomId)
      .single();

    if (!room || !hostToken || room.host_token !== hostToken) {
      return NextResponse.json({ error: 'Só o host pode ver os envios.' }, { status: 403 });
    }

    if (room.status !== 'drawn') {
      return NextResponse.json({ error: 'O sorteio ainda não foi realizado.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('participants')
      .select('id, name, age, phone, drawn_participant_id, gift_suggestions(item_name, item_link)')
      .eq('room_id', roomId);

    if (error || !data) {
      return NextResponse.json({ error: 'Erro ao buscar participantes.' }, { status: 500 });
    }

    const pessoas = data as Pessoa[];
    const porId = new Map(pessoas.map((p) => [p.id, p]));

    const envios = pessoas.flatMap((p) => {
      const amigo = p.drawn_participant_id ? porId.get(p.drawn_participant_id) : undefined;
      if (!amigo) return [];

      const texto = montarMensagem(p.name, amigo);

      return [
        {
          id: p.id,
          para: p.name,
          link: `https://wa.me/${numeroWhatsApp(p.phone)}?text=${encodeURIComponent(texto)}`,
        },
      ];
    });

    return NextResponse.json({ envios });
  } catch (err: any) {
    console.error('Erro ao montar os envios:', err);
    return NextResponse.json({ error: err.message ?? 'Erro interno.' }, { status: 500 });
  }
}