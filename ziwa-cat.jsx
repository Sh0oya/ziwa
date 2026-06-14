// ziwa-cat.jsx — original simple line-art seated cat with a coral bandana.
// Not the Caats character. moods: calm | happy | sleep | alert.
function ZiwaCat({ mood = 'calm', size = 130, ink = '#2A2420', bg = '#FBF6EC', bandana = '#E07E6B', note = false, style }) {
  const sw = 3.4;
  const common = { fill: 'none', stroke: ink, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const filled = { fill: bg, stroke: ink, strokeWidth: sw, strokeLinejoin: 'round' };
  let eyes;
  if (mood === 'happy') eyes = (<g {...common}><path d="M52 47 q6 -7 12 0" /><path d="M76 47 q6 -7 12 0" /></g>);
  else if (mood === 'sleep') eyes = (<g {...common}><path d="M52 49 q6 6 12 0" /><path d="M76 49 q6 6 12 0" /></g>);
  else if (mood === 'alert') eyes = (<g><circle cx="58" cy="47" r="4.4" fill={ink} /><circle cx="82" cy="47" r="4.4" fill={ink} /></g>);
  else eyes = (<g><circle cx="58" cy="48" r="3.6" fill={ink} /><circle cx="82" cy="48" r="3.6" fill={ink} /></g>);
  return (
    <svg viewBox="0 0 140 162" width={size} height={size * 162 / 140} style={style} aria-hidden="true">
      <path d="M104 128 C 134 126, 136 86, 110 84" {...common} />
      <path d="M70 64 C 38 64, 30 104, 35 132 C 37 146, 52 150, 70 150 C 88 150, 103 146, 105 132 C 110 104, 102 64, 70 64 Z" {...filled} />
      <path d="M56 150 q6 -10 12 0" {...common} />
      <path d="M72 150 q6 -10 12 0" {...common} />
      <path d="M44 30 L 38 6 L 60 22 Z" {...filled} />
      <path d="M96 30 L 102 6 L 80 22 Z" {...filled} />
      <path d="M45 24 L 43 13 L 53 21" {...common} stroke={bandana} />
      <path d="M95 24 L 97 13 L 87 21" {...common} stroke={bandana} />
      <circle cx="70" cy="46" r="31" {...filled} />
      {eyes}
      <path d="M65 55 L 75 55 L 70 61 Z" fill={bandana} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M70 61 q -6 8 -13 5 M70 61 q 6 8 13 5" {...common} />
      <g {...common} strokeWidth={2.4} opacity="0.8">
        <path d="M44 52 L 18 47" /><path d="M44 58 L 19 60" /><path d="M96 52 L 122 47" /><path d="M96 58 L 121 60" />
      </g>
      <path d="M52 70 Q 70 80 88 70 L 80 92 Q 70 97 60 92 Z" fill={bandana} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M66 73 q4 3 8 0" {...common} strokeWidth={2.2} stroke={bg} />
      {note && (
        <g stroke={bandana} fill={bandana}>
          <path d="M118 30 L 118 8 L 130 5 L 130 24" fill="none" strokeWidth="3" strokeLinecap="round" />
          <circle cx="114" cy="31" r="4.5" /><circle cx="126" cy="25" r="4.5" />
        </g>
      )}
    </svg>
  );
}
window.ZiwaCat = ZiwaCat;
