'use client';

import { useEffect, useState, use } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Camera,
  CheckCircle2,
  Copy,
  Link as LinkIcon,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { supabase, uploadAvatar } from '@/lib/supabase';

// No Next.js 15+, os params chegam como uma Promise nos Client Components
export default function RoomPage() {
  const params = useParams(); // <-- Usar o hook
  const code = params?.code as string;

  const [room, setRoom] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [step, setStep] = useState<'prelogin' | 'gifts' | 'lobby'>('prelogin');
  const [isHost, setIsHost] = useState(false);

  // Estados do Pré-Login
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [chatId, setChatId] = useState<string>('TEST');

  // Estados do Verificador OTP
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [loadingOtp, setLoadingOtp] = useState(false);

  // Estados das Sugestões de Presentes
  const [gifts, setGifts] = useState([
    { item_name: '', item_link: '' },
    { item_name: '', item_link: '' },
    { item_name: '', item_link: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(`host_${code}`) === 'true') {
      setIsHost(true);
    }
    if (localStorage.getItem(`joined_${code}`) === 'true') {
      setStep('lobby');
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
    const { data: roomData } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single();

    if (roomData) {
      setRoom(roomData);
      const { data: partData } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', roomData.id)
        .order('created_at', { ascending: true });
      setParticipants(partData || []);
    }
  }

  function handlePhoneChange(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length > 7)
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    setPhone(formatted);
  }

  // Função de envio do código 100% protegida contra erros de JSON
  async function handleSendOtp() {
    if (phone.replace(/\D/g, '').length < 10) {
      alert('Digite um número de telefone válido com DDD!');
      return;
    }
    setLoadingOtp(true);
    
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      // Lemos o texto bruto primeiro
      const text = await res.text();
      let data;
      
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('A API do Telegram não respondeu corretamente. Verifica se o Token está correto no .env.local.');
      }

      if (!res.ok) {
        alert(data.error || 'Erro ao enviar código. Iniciaste a conversa com o bot no Telegram?');
        return;
      }
      
      if (data.chatId) setChatId(data.chatId);
      setOtpSent(true);
    } catch (error: any) {
      alert(error.message || 'Erro de comunicação ao enviar o código.');
    } finally {
      setLoadingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    setLoadingOtp(true);
    
    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otpCode }),
      });

      const text = await res.text();
      let data;
      
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Erro ao validar código no servidor.');
      }

      if (!res.ok || !data.verified) {
        alert(data.error || 'Código inválido ou expirado!');
        return;
      }
      setPhoneVerified(true);
    } catch (error: any) {
      alert(error.message || 'Erro de comunicação ao verificar o código.');
    } finally {
      setLoadingOtp(false);
    }
  }

  function handleNextToGifts(e: React.FormEvent) {
    e.preventDefault();
    if (!photoFile) return alert('Selecione uma foto sua!');
    if (!phoneVerified) return alert('Verifique o número no Telegram antes de avançar!');
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
          telegram_chat_id: chatId,
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

      const text = await res.text();
      let data;
      
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Resposta não-JSON da API de Sorteio:", text);
        throw new Error('O servidor respondeu com um erro inesperado (Verifique o terminal do VS Code).');
      }

      if (!res.ok) {
        alert(data.error || 'Erro ao realizar sorteio');
        return;
      }

      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      loadRoomData();
    } catch (error: any) {
      alert(error.message || 'Erro de comunicação ao sortear.');
    } finally {
      setDrawing(false);
    }
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        Carregando sala...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white py-10 px-4 flex flex-col items-center overflow-x-hidden">
      <div className="w-full max-w-md mb-6 flex items-center justify-between bg-zinc-900/90 border border-zinc-800 px-5 py-4 rounded-2xl">
        <div>
          <span className="text-xs text-purple-400 font-semibold uppercase tracking-wider">
            Sala #{room.code}
          </span>
          <h2 className="text-lg font-bold">{room.name}</h2>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert('Link copiado!');
          }}
          className="flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-xl transition"
        >
          <Copy className="w-3.5 h-3.5" /> Copiar Link
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
              className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 space-y-5 shadow-2xl"
            >
              <h3 className="text-xl font-bold">1. Seu Perfil no Sorteio</h3>

              <div className="flex flex-col items-center">
                <label className="relative cursor-pointer group">
                  <div className="w-28 h-28 rounded-full bg-zinc-800 border-2 border-dashed border-purple-500 flex items-center justify-center overflow-hidden">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-zinc-400 group-hover:text-purple-400 transition" />
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
                <span className="text-xs text-zinc-400 mt-2">Toque para enviar sua foto</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-zinc-400">Seu Nome</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Emerson"
                    className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-purple-500 transition"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400">Idade</label>
                  <input
                    type="number"
                    required
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="21"
                    className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-purple-500 transition"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-zinc-800">
                <label className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  Celular (Verificação Telegram)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    disabled={phoneVerified}
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="(41) 99999-9999"
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-3 text-sm disabled:opacity-60 focus:outline-none focus:border-purple-500 transition"
                  />
                  {!phoneVerified && (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={loadingOtp || phone.length < 14}
                      className="bg-purple-600 hover:bg-purple-500 px-4 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                    >
                      {loadingOtp ? 'Enviando...' : otpSent ? 'Reenviar' : 'Verificar'}
                    </button>
                  )}
                </div>

                {otpSent && !phoneVerified && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex gap-2 pt-1 overflow-hidden"
                  >
                    <input
                      type="text"
                      maxLength={4}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="Código de 4 dígitos"
                      className="flex-1 bg-zinc-950 border border-purple-500/50 rounded-xl px-3.5 py-2.5 text-sm tracking-widest text-center font-bold focus:outline-none focus:border-purple-500 transition"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={loadingOtp || otpCode.length < 4}
                      className="bg-emerald-600 hover:bg-emerald-500 px-4 rounded-xl text-xs font-semibold disabled:opacity-50 transition"
                    >
                      Confirmar
                    </button>
                  </motion.div>
                )}

                {phoneVerified && (
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4" /> Verificado com sucesso!
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 py-3.5 rounded-xl font-semibold shadow-lg shadow-purple-600/25 transition"
              >
                Continuar para Sugestões
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
              className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 space-y-5 shadow-2xl"
            >
              <div>
                <h3 className="text-xl font-bold">2. Lista de Desejos</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Mínimo de 3 opções de presentes (link é opcional).
                </p>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                {gifts.map((gift, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-purple-400">
                        Sugestão #{i + 1} {i < 3 && '*'}
                      </span>
                      {i >= 3 && (
                        <button
                          type="button"
                          onClick={() => setGifts(gifts.filter((_, idx) => idx !== i))}
                          className="text-zinc-500 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      required={i < 3}
                      placeholder="Ex: Livro de Ficção / Perfume"
                      value={gift.item_name}
                      onChange={(e) => {
                        const copy = [...gifts];
                        copy[i].item_name = e.target.value;
                        setGifts(copy);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition"
                    />
                    <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 focus-within:border-purple-500 transition">
                      <LinkIcon className="w-3.5 h-3.5 text-zinc-500" />
                      <input
                        type="url"
                        placeholder="Link do produto (opcional)"
                        value={gift.item_link}
                        onChange={(e) => {
                          const copy = [...gifts];
                          copy[i].item_link = e.target.value;
                          setGifts(copy);
                        }}
                        className="w-full bg-transparent text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setGifts([...gifts, { item_name: '', item_link: '' }])}
                className="w-full py-2.5 border border-dashed border-zinc-700 hover:border-purple-500 rounded-xl text-xs text-zinc-300 flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" /> Adicionar mais uma sugestão
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 py-3.5 rounded-xl font-semibold shadow-lg shadow-purple-600/25 disabled:opacity-50 transition"
              >
                {submitting ? 'A Entrar na Sala...' : 'Concluir e Entrar'}
              </button>
            </motion.form>
          )}

          {step === 'lobby' && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-bold">
                    Participantes ({participants.length})
                  </h3>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-zinc-800 text-zinc-300">
                  R$ {room.budget}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {participants.map((p) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 p-3 rounded-2xl"
                  >
                    <img
                      src={p.photo_url}
                      alt={p.name}
                      className="w-11 h-11 rounded-full object-cover border border-purple-500/40"
                    />
                    <div className="overflow-hidden">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-zinc-400">{p.age} anos</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {room.status === 'drawn' ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-1">
                  <Sparkles className="w-6 h-6 text-emerald-400 mx-auto" />
                  <p className="font-bold text-emerald-300">Sorteio Realizado!</p>
                  <p className="text-xs text-zinc-300">
                    O teu Amigo Secreto já está no teu Telegram!
                  </p>
                </div>
              ) : isHost ? (
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <button
                    onClick={handleDraw}
                    disabled={drawing || participants.length < 3}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 disabled:opacity-40 transition"
                  >
                    <Send className="w-5 h-5" />
                    {drawing
                      ? 'A sortear...'
                      : 'Sortear e Enviar no Telegram'}
                  </button>
                  {participants.length < 3 && (
                    <p className="text-center text-xs text-zinc-400">
                      Mínimo de 3 participantes (faltam {3 - participants.length}).
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-center text-xs text-zinc-400 py-3">
                  Tudo pronto! Aguarda que o Host inicie o sorteio.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}