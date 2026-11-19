'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Clock,
  Crown,
  Gift,
  Snowflake,
  Sparkles,
  Trash2,
  Trees,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SavedRoom {
  code: string;
  name: string;
  isHost: boolean;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function HomePage() {
  const router = useRouter();

  // Criar nova sala
  const [roomName, setRoomName] = useState('');
  const [budget, setBudget] = useState('100');
  const [creating, setCreating] = useState(false);

  // Entrar em sala existente
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  // Salas salvas no navegador do usuário
  const [savedRooms, setSavedRooms] = useState<SavedRoom[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('my_christmas_rooms');
      if (raw) {
        setSavedRooms(JSON.parse(raw));
      }
    } catch {
      // ignora erro de parse
    }
  }, []);

  function saveRoomToHistory(room: SavedRoom) {
    const updated = [room, ...savedRooms.filter((r) => r.code !== room.code)].slice(0, 6);
    setSavedRooms(updated);
    localStorage.setItem('my_christmas_rooms', JSON.stringify(updated));
  }

  function removeRoomFromHistory(codeToRemove: string, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = savedRooms.filter((r) => r.code !== codeToRemove);
    setSavedRooms(updated);
    localStorage.setItem('my_christmas_rooms', JSON.stringify(updated));
  }

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!roomName.trim()) return;

    setCreating(true);
    try {
      const code = generateRoomCode();
      const parsedBudget = Number(budget) || 0;

      const { error } = await supabase.from('rooms').insert({
        code,
        name: roomName.trim(),
        budget: parsedBudget,
        status: 'waiting',
      });

      if (error) throw error;

      localStorage.setItem(`host_${code}`, 'true');
      saveRoomToHistory({ code, name: roomName.trim(), isHost: true });
      router.push(`/sala/${code}`);
    } catch (err: any) {
      alert(err.message || 'Erro ao criar a sala de Natal.');
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cleanCode) return;

    setJoining(true);
    try {
      const { data: roomData, error } = await supabase
        .from('rooms')
        .select('code, name')
        .eq('code', cleanCode)
        .single();

      if (error || !roomData) {
        alert('Sala não encontrada! Verifique se o código foi digitado corretamente.');
        return;
      }

      const isHost = localStorage.getItem(`host_${roomData.code}`) === 'true';
      saveRoomToHistory({ code: roomData.code, name: roomData.name, isHost });
      router.push(`/sala/${roomData.code}`);
    } finally {
      setJoining(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#2b0707] via-[#1a0505] to-[#071f12] text-white py-10 px-4 flex flex-col items-center justify-center relative overflow-hidden">
      <div className="pointer-events-none absolute top-8 left-8 text-amber-400/20">
        <Snowflake className="w-14 h-14 animate-spin" style={{ animationDuration: '18s' }} />
      </div>
      <div className="pointer-events-none absolute bottom-10 right-8 text-emerald-400/20">
        <Trees className="w-16 h-16" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-5 z-10"
      >
        {/* Cabeçalho Principal */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-950/80 border border-amber-400/40 text-amber-300 text-xs font-bold tracking-wide shadow-md">
            <Sparkles className="w-3.5 h-3.5" /> EDIÇÃO ESPECIAL DE NATAL 🎄
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">
            Amigo Secreto <span className="text-amber-400">da Família</span>
          </h1>
          <p className="text-sm text-amber-100/75 max-w-sm mx-auto leading-relaxed">
            Crie quantas salas quiser, entre pelo código ou link e envie o resultado secreto pelo WhatsApp.
          </p>
        </div>

        {/* Minhas Salas Recentes (aparece se o usuário já criou ou entrou em alguma) */}
        {savedRooms.length > 0 && (
          <div className="bg-black/40 backdrop-blur-md border border-amber-400/30 rounded-3xl p-4 space-y-2.5 shadow-xl">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300 px-1">
              <Clock className="w-3.5 h-3.5" /> Minhas Salas
            </div>
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {savedRooms.map((r) => (
                <div
                  key={r.code}
                  onClick={() => router.push(`/sala/${r.code}`)}
                  className="flex items-center justify-between bg-red-950/60 hover:bg-red-900/70 border border-red-800/70 px-3.5 py-2.5 rounded-2xl cursor-pointer transition group"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span className="text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-1 rounded-lg">
                      #{r.code}
                    </span>
                    <span className="text-sm font-bold text-white truncate">{r.name}</span>
                    {r.isHost && (
                      <span title="Você criou esta sala">
                        <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => removeRoomFromHistory(r.code, e)}
                      title="Remover da lista"
                      className="text-zinc-500 hover:text-red-400 p-1 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ArrowRight className="w-4 h-4 text-amber-300 group-hover:translate-x-0.5 transition" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cartão 1: Criar Sala */}
        <form
          onSubmit={handleCreateRoom}
          className="bg-red-950/65 backdrop-blur-md border border-amber-500/35 rounded-3xl p-6 space-y-4 shadow-2xl"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-amber-50">Criar Nova Sala</h2>
              <p className="text-xs text-amber-200/70">Crie para a família, amigos ou trabalho</p>
            </div>
          </div>

          <div>
            <label className="text-xs text-amber-200/80 font-medium">Nome da Sala</label>
            <input
              type="text"
              required
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Ex: Natal da Família 2026"
              className="mt-1 w-full bg-black/40 border border-red-800/80 rounded-xl px-3.5 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-400 transition"
            />
          </div>

          <div>
            <label className="text-xs text-amber-200/80 font-medium">
              Valor Sugerido do Presente (R$)
            </label>
            <input
              type="number"
              min="0"
              step="5"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="100"
              className="mt-1 w-full bg-black/40 border border-red-800/80 rounded-xl px-3.5 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-400 transition"
            />
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full bg-gradient-to-r from-red-600 via-red-500 to-amber-600 hover:from-red-500 hover:to-amber-500 py-3.5 rounded-xl font-extrabold shadow-lg shadow-red-950/60 flex items-center justify-center gap-2 transition disabled:opacity-50 text-white"
          >
            {creating ? 'A criar sala...' : 'Criar Sala de Natal 🎅'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Cartão 2: Entrar com Código */}
        <form
          onSubmit={handleJoinRoom}
          className="bg-emerald-950/45 backdrop-blur-md border border-emerald-500/30 rounded-3xl p-5 space-y-3 shadow-xl"
        >
          <div className="flex items-center gap-2 text-emerald-200">
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Entrar em uma Sala pelo Código
            </span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              maxLength={8}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="EX: X7K9P2"
              className="flex-1 bg-black/40 border border-emerald-800/70 rounded-xl px-3.5 py-2.5 text-sm font-bold tracking-widest uppercase text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-400 transition"
            />
            <button
              type="submit"
              disabled={joining || !joinCode.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-5 rounded-xl text-sm font-bold text-white transition shadow-md"
            >
              {joining ? '...' : 'Entrar'}
            </button>
          </div>
        </form>
      </motion.div>
    </main>
  );
}