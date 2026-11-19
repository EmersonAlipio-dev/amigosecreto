'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { ArrowLeft, ExternalLink, Gift, Sparkles, Trees } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function RevealContent() {
  const params = useParams();
  const router = useRouter();
  const participantId = params?.id as string;

  const [giver, setGiver] = useState<any>(null);
  const [receiver, setReceiver] = useState<any>(null);
  const [gifts, setGifts] = useState<any[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!participantId) return;
    loadSecretMatch();
  }, [participantId]);

  async function loadSecretMatch() {
    try {
      const { data: giverData } = await supabase
        .from('participants')
        .select('*, rooms(*)')
        .eq('id', participantId)
        .single();

      if (giverData && giverData.drawn_participant_id) {
        setGiver(giverData);

        const { data: receiverData } = await supabase
          .from('participants')
          .select('*')
          .eq('id', giverData.drawn_participant_id)
          .single();

        const { data: giftsData } = await supabase
          .from('gift_suggestions')
          .select('*')
          .eq('participant_id', giverData.drawn_participant_id);

        setReceiver(receiverData);
        setGifts(giftsData || []);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleOpenGift() {
    setRevealed(true);
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#ef4444', '#10b981', '#fbbf24'],
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a0505] text-amber-100 flex items-center justify-center">
        🎄 A procurar o seu presente debaixo da árvore...
      </div>
    );
  }

  if (!giver || !receiver) {
    return (
      <div className="min-h-screen bg-[#1a0505] text-amber-100 flex flex-col items-center justify-center p-4 text-center space-y-4">
        <p>Ainda não há sorteio registado para este link!</p>
        <button
          onClick={() => router.push('/')}
          className="bg-amber-500 text-red-950 font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> Ir para o Menu Inicial
        </button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#2b0707] via-[#1a0505] to-[#071f12] text-white py-8 px-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md mb-3 flex items-center justify-between">
        <button
          onClick={() => router.push(giver.rooms?.code ? `/sala/${giver.rooms.code}` : '/')}
          className="flex items-center gap-1.5 text-xs font-semibold text-amber-200/80 hover:text-amber-300 bg-black/30 hover:bg-black/50 border border-amber-500/20 px-3 py-2 rounded-xl transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar para a Sala
        </button>
        <button
          onClick={() => router.push('/')}
          className="text-xs font-semibold text-amber-200/60 hover:text-amber-300 transition"
        >
          Menu Inicial
        </button>
      </div>

      <div className="w-full max-w-md bg-red-950/70 backdrop-blur-md border border-amber-500/40 rounded-3xl p-6 text-center space-y-6 shadow-2xl">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold">
            <Trees className="w-4 h-4" /> {giver.rooms?.name}
          </span>
          {giver.rooms?.budget > 0 && (
            <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
              Valor: R$ {giver.rooms.budget}
            </span>
          )}
        </div>

        <h1 className="text-2xl font-extrabold text-amber-50">
          Olá, {giver.name}! 🎅
        </h1>

        {!revealed ? (
          <div className="py-8 space-y-6">
            <p className="text-sm text-amber-200/80">
              Certifique-se de que ninguém está a olhar para o seu telemóvel antes de abrir!
            </p>
            <button
              onClick={handleOpenGift}
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-red-950 font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 text-lg transition transform hover:scale-105"
            >
              <Gift className="w-6 h-6" /> Revelar Meu Amigo Secreto!
            </button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="p-5 rounded-2xl bg-black/40 border border-amber-400/40 flex flex-col items-center space-y-3">
              <span className="text-xs uppercase tracking-widest text-amber-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> O Seu Amigo Secreto é:
              </span>
              <img
                src={receiver.photo_url}
                alt={receiver.name}
                className="w-28 h-28 rounded-full object-cover border-4 border-amber-400 shadow-lg"
              />
              <div>
                <h2 className="text-2xl font-black text-white">{receiver.name}</h2>
                <p className="text-xs text-amber-200/70">{receiver.age} anos</p>
              </div>
            </div>

            <div className="text-left space-y-3">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                🎁 Lista de Desejos de {receiver.name}:
              </h3>
              <div className="space-y-2.5">
                {gifts.map((g, idx) => (
                  <div
                    key={g.id || idx}
                    className="p-3.5 rounded-xl bg-black/40 border border-red-800/60 flex items-center justify-between gap-2"
                  >
                    <span className="text-sm font-semibold text-white">
                      {idx + 1}. {g.item_name}
                    </span>
                    {g.item_link && (
                      <a
                        href={g.item_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/30 px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-semibold transition shrink-0"
                      >
                        Ver Loja <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-amber-200/60 italic pt-2">
              🤫 Guarde segredo! Pode abrir este link no seu WhatsApp sempre que quiser consultar a lista.
            </p>
          </motion.div>
        )}
      </div>
    </main>
  );
}

export default function RevealPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#1a0505] text-amber-100 flex items-center justify-center">
          🎄 A abrir envelope secreto...
        </div>
      }
    >
      <RevealContent />
    </Suspense>
  );
}