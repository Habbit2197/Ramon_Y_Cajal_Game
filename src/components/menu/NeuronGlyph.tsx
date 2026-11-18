/**
 * NeuronGlyph.tsx — Neurona piramidal dibujada a trazo, al estilo de las láminas de Cajal.
 * Se usa como avatar del jugador y como «muestra» dentro de las preparaciones del menú.
 */

export const AVATAR_COLORS = ['#e8b45a', '#5ee6ff', '#7bd389', '#ff8fb1', '#b49cff', '#ff9f5a', '#7fb8ff', '#d4e86a'];

export function NeuronGlyph({
  color,
  size = 28,
  glow = false,
  title,
}: {
  color: string;
  size?: number;
  glow?: boolean;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={glow ? { filter: `drop-shadow(0 0 6px ${color})` } : undefined}
    >
      <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
        {/* Dendrita apical y sus ramas */}
        <path d="M32 30 C31 22 33 14 32 4" strokeWidth="2.4" />
        <path d="M32 14 C27 11 24 9 20 4 M32 18 C37 15 41 12 44 7 M31 9 C29 7 28 5 28 2" strokeWidth="1.5" />
        {/* Dendritas basales */}
        <path d="M27 36 C21 37 15 40 8 41 M28 39 C23 44 19 49 14 52 M37 36 C43 37 49 39 56 39 M36 39 C41 44 45 48 51 50" strokeWidth="1.7" />
        {/* Axón */}
        <path d="M32 42 C33 49 31 55 32 62" strokeWidth="1.3" strokeDasharray="3 2.2" />
      </g>
      {/* Soma */}
      <path d="M32 27 L39 39 Q32 43 25 39 Z" fill={color} />
    </svg>
  );
}

/** Ilustración grande de las preparaciones: red de tres neuronas conectadas. */
export function SpecimenArt({ ink, glow }: { ink: string; glow: boolean }) {
  return (
    <svg viewBox="0 0 220 110" className="w-full h-full" aria-hidden style={glow ? { filter: `drop-shadow(0 0 5px ${ink})` } : undefined}>
      <g fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round">
        {/* neurona izquierda */}
        <path d="M48 62 C46 46 50 30 47 12 M47 30 C40 24 36 20 30 12 M48 36 C56 30 62 24 66 16" strokeWidth="2" />
        <path d="M42 68 C32 70 22 74 10 76 M54 68 C62 72 70 78 80 80" strokeWidth="1.6" />
        {/* axón que conecta con la central */}
        <path d="M48 74 C60 92 86 96 104 84" strokeWidth="1.2" strokeDasharray="4 3" />
        {/* neurona central */}
        <path d="M112 66 C111 50 114 32 111 8 M111 26 C104 20 99 16 94 8 M112 32 C120 26 126 20 131 10 M111 16 C109 12 108 9 108 5" strokeWidth="2.2" />
        <path d="M105 72 C96 76 90 82 84 92 M119 72 C128 76 136 80 146 82" strokeWidth="1.6" />
        <path d="M113 78 C126 98 160 100 176 86" strokeWidth="1.2" strokeDasharray="4 3" />
        {/* neurona derecha */}
        <path d="M184 64 C183 50 186 36 183 18 M183 34 C177 28 174 24 168 18 M184 40 C191 35 196 30 200 24" strokeWidth="1.9" />
        <path d="M178 70 C170 74 164 80 158 90 M190 70 C198 74 204 80 212 84" strokeWidth="1.5" />
      </g>
      <g fill={ink}>
        <path d="M48 58 L55 70 Q48 74 41 70 Z" />
        <path d="M112 62 L120 75 Q112 79 104 75 Z" />
        <path d="M184 60 L191 72 Q184 76 177 72 Z" />
        {/* botones sinápticos */}
        <circle cx="104" cy="84" r="2.6" />
        <circle cx="176" cy="86" r="2.6" />
      </g>
    </svg>
  );
}
