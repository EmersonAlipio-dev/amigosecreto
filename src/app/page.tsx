'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Gift, Sparkles, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('100');
  const [loading, setLoading] = useState(false);

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data, error } = await supabase
      .from('rooms')
      .insert({ name, budget: Number(budget), code })
      .select()
      .single();

    if (error) {
      alert('Erro ao criar sala: ' + error.message);
      setLoading(false);
      return;
    }

    // Marca no navegador do criador que ele é o Host desta sala
    localStorage.setItem(`host_${code}`, 'true');
    router.push(`/sala/${code}`);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 shadow-2xl"
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center mb-6 shadow-lg shadow-purple-500/25">
          <Gift className="w-7 h-7 text-white" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight">Amigo Secreto</h1>
        <p className="text-zinc-400 text-sm mt-2">
          Crie o grupo, compartilhe o link e receba o sorteio estilizado direto no Telegram.
        </p>

        <form onSubmit={handleCreateRoom} className="mt-8 space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Nome do Grupo / Evento
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Natal da Família 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Valor Sugerido do Presente (R$)
            </label>
            <input
              type="number"
              required
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="mt-2 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={loading}
            type="submit"
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-semibold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition disabled:opacity-50"
          >
            <Sparkles className="w-5 h-5" />
            {loading ? 'Criando sala...' : 'Criar Sala como Host'}
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </form>
      </motion.div>
    </main>
  );
}