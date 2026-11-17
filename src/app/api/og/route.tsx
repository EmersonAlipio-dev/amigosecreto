import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name') || 'Participante';
  const age = searchParams.get('age') || '21';
  const photo = searchParams.get('photo') || 'https://github.com/shadcn.png';
  const room = searchParams.get('room') || 'Amigo Secreto';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#09090b',
          backgroundImage: 'radial-gradient(circle at 50% 10%, #581c87 0%, #09090b 70%)',
          color: 'white',
          fontFamily: 'sans-serif',
          padding: '40px',
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '999px',
            padding: '10px 28px',
            fontSize: 24,
            color: '#e9d5ff',
            marginBottom: 28,
          }}
        >
          🎁 {room}
        </div>

        <div style={{ fontSize: 32, color: '#a1a1aa', marginBottom: 24 }}>
          O seu Amigo Secreto é...
        </div>

        <div
          style={{
            display: 'flex',
            padding: '10px',
            borderRadius: '999px',
            background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
            boxShadow: '0 20px 50px rgba(139, 92, 246, 0.5)',
            marginBottom: 30,
          }}
        >
          <img
            src={photo}
            width="280"
            height="280"
            style={{
              borderRadius: '999px',
              objectFit: 'cover',
              border: '6px solid #09090b',
            }}
          />
        </div>

        <div style={{ fontSize: 54, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' }}>
          {name}
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#f472b6',
            marginTop: 12,
            background: 'rgba(244, 114, 182, 0.15)',
            padding: '8px 26px',
            borderRadius: '999px',
          }}
        >
          🎂 {age} anos
        </div>
      </div>
    ),
    { width: 800, height: 900 }
  );
}