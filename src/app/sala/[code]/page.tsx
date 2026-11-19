'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  Camera,
  Check,
  Copy,
  Gift,
  Link as LinkIcon,
  MessageCircle,
  Plus,
  Share2,
  Snowflake,
  Sparkles,
  Trash2,
  Trees,
  Users,
} from 'lucide-react';
import { supabase, uploadAvatar } from '@/lib/supabase';

function RoomContent() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string)?.toUpperCase();

  const [room, setRoom] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [step, setStep] = useState<'prelogin' | 'gifts' | 'lobby'>('prelogin');
  const [isHost, setIsHost] = useState(false);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Dados do Participante
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');

  // Sugestões de Presentes
  const [gifts, setGifts] = useState([
    { item_name: '', item_link: '' },
    { item_name: '', item_link: '' },
    { item_name: '', item_link: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    if (!code) return;

    if (localStorage.getItem(`host_${code}`) === 'true') {
      setIsHost(true);
    }
    const savedId = localStorage.getItem(`participant_id_${code}`);
    if (localStorage.getItem(`joined_${code}`) === 'true') {
      setStep('lobby');
      if (savedId) setMyParticipantId(savedId);
    }
    loadRoomData();

    const channel = supabase
      .channel(`room_${code}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants' },
        () => loadRoomData()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms' },
        () => loadRoomData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code]);

  async function loadRoomData() {
    if (!code) return;
    const { data: roomData, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !roomData) {
      setNotFound(true);
      return;
    }

    setRoom(roomData);

    // Salva a sala no histórico do navegador automaticamente ao acessar via link
    try {
      const raw = localStorage.getItem('my_christmas_rooms');
      const list = raw ? JSON.parse(raw) : [];
      const hostFlag = localStorage.getItem(`host_${code}`) === 'true';
      const updated = [
        { code: roomData.code, name: roomData.name, isHost: hostFlag },
        ...list.filter((r: any) => r.code !== roomData.code),
      ].slice(0, 6);
      localStorage.setItem('my_christmas_rooms', JSON.stringify(updated));
    } catch {
      // ignora
    }

    const { data: partData } = await supabase
      .from('participants')
      .select('*')
      .eq('room_id', roomData.id)
      .order('created_at', { ascending: true });
    setParticipants(partData || []);
  }

  function handlePhoneChange(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length > 7)
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    setPhone(formatted);
  }

  function handleNextToGifts(e: React.FormEvent) {
    e.preventDefault();
    if (!photoFile) return alert('Selecione uma foto sua para o cartão de Natal!');
    if (phone.replace(/\D/g, '').length < 10) {
      return alert('Digite um número de WhatsApp válido com DDD!');
    }
    setStep('gifts');
  }

  async function handleFinishRegistration(e: React.FormEvent) {
    e.preventDefault();
    const validGifts = gifts.filter((g) => g.item_name.trim() !== '');
    if (validGifts.length < 3) {
      return alert('Preencha pelo menos 3 sugestões de presentes!');
    }

    setSubmitting(true);
    try {
      const photoUrl = await uploadAvatar(photoFile!);

      const { data: participant, error: partErr } = await supabase
        .from('participants')
        .insert({
          room_id: room.id,
          name,
          age: Number(age),
          phone: phone.replace(/\D/g, ''),
          telegram_chat_id: 'WHATSAPP',
          phone_verified: true,
          photo_url: photoUrl,
          is_host: isHost && participants.length === 0,
        })
        .select()
        .single();

      if (partErr) throw partErr;

      const giftsPayload = validGifts.map((g) => ({
        participant_id: participant.id,
        item_name: g.item_name,
        item_link: g.item_link || null,
      }));

      await supabase.from('gift_suggestions').insert(giftsPayload);

      localStorage.setItem(`joined_${code}`, 'true');
      localStorage.setItem(`participant_id_${code}`, participant.id);
      setMyParticipantId(participant.id);
      await loadRoomData();
      setStep('lobby');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDraw() {
    setDrawing(true);
    try {
      const res = await fetch('/api/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Erro ao realizar sorteio');
        return;
      }

      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#ef4444', '#10b981', '#fbbf24', '#ffffff'],
      });
      loadRoomData();
    } catch (error: any) {
      alert(error.message || 'Erro de comunicação ao sortear.');
    } finally {
      setDrawing(false);
    }
  }

  function buildSecretMessage(participant: any) {
    const revealUrl = `${window.location.origin}/revelar/${participant.id}`;
    return (
      `🎄🎅 *Ho Ho Ho, ${participant.name}!*\n\n` +
      `O sorteio do Amigo Secreto da sala *"${room.name}"* foi realizado!\n\n` +
      `🎁 Toque no seu link exclusivo abaixo para descobrir quem você tirou e ver a lista de presentes:\n` +
      `${revealUrl}\n\n` +
      `🤫 *Não mostre este link para ninguém!*`
    );
  }

  function getWhatsAppLink(participant: any) {
    const cleanPhone = participant.phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(buildSecretMessage(participant))}`;
  }

  function handleCopySecretMessage(participant: any) {
    navigator.clipboard.writeText(buildSecretMessage(participant));
    setCopiedId(participant.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleInviteRoom() {
    const inviteText =
      `🎄🎅 *Convite para o Amigo Secreto: ${room.name}*\n\n` +
      `💰 Valor sugerido: *R$ ${room.budget}*\n` +
      `🔑 Código da Sala: *${room.code}*\n\n` +
      `👉 Entre direto pelo link abaixo, coloque sua foto e 3 sugestões de presentes:\n` +
      `${window.location.href}`;

    navigator.clipboard.writeText(inviteText);
    alert('Convite completo com link e código copiado! Cole no grupo do WhatsApp da família 🎅');
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-[#1a0505] text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <p className="text-xl font-bold text-amber-300">Sala #{code} não encontrada 🎄</p>
        <p className="text-sm text-amber-100/70 max-w-xs">
          Verifique se o código está correto ou peça um novo link ao organizador.
        </p>
        <button
          onClick={() => router.push('/')}
          className="bg-amber-500 hover:bg-amber-400 text-red-950 font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Menu Inicial
        </button>
      </main>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-[#1a0505] text-amber-100 flex items-center justify-center gap-2">
        <Snowflake className="w-6 h-6 animate-spin text-amber-400" />
        A preparar a sala de Natal...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#2b0707] via-[#1a0505] to-[#071f12] text-white py-8 px-4 flex flex-col items-center overflow-x-hidden relative">
      {/* Barra Superior de Navegação */}
      <div className="w-full max-w-md mb-3 flex items-center justify-between">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-xs font-semibold text-amber-200/80 hover:text-amber-300 bg-black/30 hover:bg-black/50 border border-amber-500/20 px-3 py-2 rounded-xl transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Menu Inicial
        </button>
        <span className="text-xs text-amber-200/60 font-mono">
          Código: <strong className="text-amber-300">{room.code}</strong>
        </span>
      </div>

      {/* Cabeçalho da Sala */}
      <div className="w-full max-w-md mb-6 flex items-center justify-between bg-red-950/70 backdrop-blur-md border border-amber-500/30 px-5 py-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2.5 bg-red-900/80 rounded-xl border border-amber-400/30 text-amber-300 shrink-0">
            <Trees className="w-6 h-6" />
          </div>
          <div className="overflow-hidden">
            <span className="text-xs text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
              🎄 Sala #{room.code}
            </span>
            <h2 className="text-lg font-extrabold text-white truncate">{room.name}</h2>
          </div>
        </div>
        <button
          onClick={handleInviteRoom}
          className="flex items-center gap-1.5 text-xs bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-500/30 text-emerald-100 px-3.5 py-2.5 rounded-xl font-semibold transition shadow-md shrink-0"
        >
          <Share2 className="w-3.5 h-3.5" /> Convidar
        </button>
      </div>

      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {step === 'prelogin' && (
            <motion.form
              key="prelogin"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              onSubmit={handleNextToGifts}
              className="bg-red-950/60 backdrop-blur-md border border-amber-500/30 rounded-3xl p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-amber-400" />
                  <h3 className="text-xl font-bold text-amber-50">1. Seu Perfil de Natal</h3>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300">
                  Até R$ {room.budget}
                </span>
              </div>

              <div className="flex flex-col items-center">
                <label className="relative cursor-pointer group">
                  <div className="w-28 h-28 rounded-full bg-red-900/50 border-2 border-dashed border-amber-400 flex items-center justify-center overflow-hidden shadow-inner">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-amber-300/70 group-hover:text-amber-300 transition" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPhotoFile(file);
                        setPhotoPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </label>
                <span className="text-xs text-amber-200/70 mt-2">
                  Toque no círculo para escolher sua foto 📸
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-amber-200/80 font-medium">Seu Nome</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Tio João"
                    className="mt-1 w-full bg-black/40 border border-red-800/80 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-amber-400 transition"
                  />
                </div>
                <div>
                  <label className="text-xs text-amber-200/80 font-medium">Idade</label>
                  <input
                    type="number"
                    required
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="25"
                    className="mt-1 w-full bg-black/40 border border-red-800/80 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-amber-400 transition"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-red-800/60">
                <label className="text-xs text-amber-200/80 font-medium flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  Seu WhatsApp (com DDD)
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="(41) 99999-9999"
                  className="w-full bg-black/40 border border-red-800/80 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-emerald-400 transition"
                />
                <p className="text-[11px] text-amber-200/60">
                  Você receberá o link secreto com o seu sorteado por aqui!
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-red-600 via-red-500 to-amber-600 hover:from-red-500 hover:to-amber-500 py-3.5 rounded-xl font-bold shadow-lg shadow-red-900/50 transition text-white"
              >
                Escolher Meus Presentes 🎁
              </button>
            </motion.form>
          )}

          {step === 'gifts' && (
            <motion.form
              key="gifts"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              onSubmit={handleFinishRegistration}
              className="bg-red-950/60 backdrop-blur-md border border-amber-500/30 rounded-3xl p-6 space-y-5 shadow-2xl"
            >
              <div>
                <h3 className="text-xl font-bold text-amber-50">2. Carta para o Papai Noel 🎅</h3>
                <p className="text-xs text-amber-200/70 mt-1">
                  Diga pelo menos 3 opções do que gostaria de ganhar (valor sugerido: <b>R$ {room.budget}</b>).
                </p>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                {gifts.map((gift, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-2xl bg-black/40 border border-red-800/60 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400">
                        🎁 Opção #{i + 1} {i < 3 && '*'}
                      </span>
                      {i >= 3 && (
                        <button
                          type="button"
                          onClick={() => setGifts(gifts.filter((_, idx) => idx !== i))}
                          className="text-red-400 hover:text-red-300 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      required={i < 3}
                      placeholder="Ex: Camisa tamanho G / Perfume / Livro"
                      value={gift.item_name}
                      onChange={(e) => {
                        const copy = [...gifts];
                        copy[i].item_name = e.target.value;
                        setGifts(copy);
                      }}
                      className="w-full bg-red-950/60 border border-red-800/80 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 transition"
                    />
                    <div className="flex items-center gap-2 bg-red-950/60 border border-red-800/80 rounded-xl px-3 py-2 focus-within:border-amber-400 transition">
                      <LinkIcon className="w-3.5 h-3.5 text-amber-300/60" />
                      <input
                        type="url"
                        placeholder="Link da loja (opcional)"
                        value={gift.item_link}
                        onChange={(e) => {
                          const copy = [...gifts];
                          copy[i].item_link = e.target.value;
                          setGifts(copy);
                        }}
                        className="w-full bg-transparent text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setGifts([...gifts, { item_name: '', item_link: '' }])}
                className="w-full py-2.5 border border-dashed border-amber-500/40 hover:border-amber-400 rounded-xl text-xs text-amber-200 flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" /> Adicionar mais um desejo
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 py-3.5 rounded-xl font-bold shadow-lg shadow-emerald-950/60 disabled:opacity-50 transition text-white"
              >
                {submitting ? 'A entrar na árvore de Natal...' : 'Confirmar Participação 🎄'}
              </button>
            </motion.form>
          )}

          {step === 'lobby' && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-950/60 backdrop-blur-md border border-amber-500/30 rounded-3xl p-6 space-y-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-bold text-amber-50">
                    Participantes ({participants.length})
                  </h3>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300">
                  Até R$ {room.budget}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {participants.map((p) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between bg-black/40 border border-red-800/60 p-3 rounded-2xl gap-2"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <img
                        src={p.photo_url}
                        alt={p.name}
                        className="w-11 h-11 rounded-full object-cover border-2 border-amber-400 shrink-0"
                      />
                      <div className="overflow-hidden">
                        <p className="text-sm font-bold text-white truncate">{p.name}</p>
                        <p className="text-xs text-amber-200/70">{p.age} anos</p>
                      </div>
                    </div>

                    {/* Ações pós-sorteio */}
                    {room.status === 'drawn' && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {myParticipantId === p.id && (
                          <a
                            href={`/revelar/${p.id}`}
                            className="bg-amber-500 hover:bg-amber-400 text-red-950 text-xs font-extrabold px-2.5 py-2 rounded-xl transition flex items-center gap-1 shadow-md"
                          >
                            <Gift className="w-3.5 h-3.5" /> Abrir
                          </a>
                        )}
                        {isHost && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCopySecretMessage(p)}
                              title="Copiar mensagem com link secreto"
                              className="bg-zinc-800 hover:bg-zinc-700 text-amber-200 p-2 rounded-xl transition border border-zinc-700"
                            >
                              {copiedId === p.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <a
                              href={getWhatsAppLink(p)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-2.5 py-2 rounded-xl transition flex items-center gap-1 shadow-md"
                            >
                              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                            </a>
                          </>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {room.status === 'drawn' ? (
                <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-center space-y-2">
                  <Sparkles className="w-6 h-6 text-amber-400 mx-auto" />
                  <p className="font-extrabold text-emerald-300 text-base">
                    🎅 Sorteio de Natal Realizado!
                  </p>
                  {isHost ? (
                    <p className="text-xs text-emerald-100/90 leading-relaxed">
                      Use o botão verde <b>WhatsApp</b> (ou o ícone de copiar ao lado) para enviar o link secreto de cada familiar sem revelar quem eles tiraram!
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-100/90">
                      Toque no botão dourado <b>Abrir</b> ao lado do seu nome ou peça seu link pelo WhatsApp!
                    </p>
                  )}
                </div>
              ) : isHost ? (
                <div className="space-y-2 pt-2 border-t border-red-800/60">
                  <button
                    onClick={handleDraw}
                    disabled={drawing || participants.length < 2}
                    className="w-full bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 hover:from-emerald-500 hover:to-green-500 py-4 rounded-xl font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/80 disabled:opacity-40 transition text-white"
                  >
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    {drawing ? 'A misturar os nomes no gorro...' : 'Realizar Sorteio de Natal 🎅'}
                  </button>
                  {participants.length < 2 && (
                    <p className="text-center text-xs text-amber-200/70">
                      Mínimo de 2 pessoas para sortear (falta {2 - participants.length}).
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-center text-xs text-amber-200/80 py-3">
                  🎄 Tudo pronto! Aguarda o organizador iniciar o sorteio.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#1a0505] text-amber-100 flex items-center justify-center">
          🎄 A preparar a sala de Natal...
        </div>
      }
    >
      <RoomContent />
    </Suspense>
  );
}