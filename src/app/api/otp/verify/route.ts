import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { phone, code } = await req.json();
  const cleanPhone = phone.replace(/\D/g, '');

  const { data, error } = await supabaseAdmin
    .from('otp_codes')
    .select('*')
    .eq('phone', cleanPhone)
    .eq('code', code.trim())
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Código incorreto!' }, { status: 400 });
  }

  return NextResponse.json({ verified: true });
}