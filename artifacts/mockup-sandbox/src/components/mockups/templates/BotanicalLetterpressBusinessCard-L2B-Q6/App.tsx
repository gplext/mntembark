import { useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, MapPin, Film, Flower2 } from 'lucide-react';

const SprigLeft = ({ className, stroke = "#5b6b46" }) => (
  <svg viewBox="0 0 120 200" fill="none" className={className} aria-hidden="true">
    <path d="M20 195 C 30 140, 38 90, 60 20" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
    <path d="M44 70 C 30 62, 22 50, 24 36 C 38 40, 46 52, 47 64 Z" fill={stroke} opacity="0.85"/>
    <path d="M52 110 C 66 104, 78 92, 80 78 C 64 80, 54 92, 51 104 Z" fill={stroke} opacity="0.7"/>
    <path d="M34 150 C 22 144, 14 132, 15 120 C 29 124, 36 136, 37 146 Z" fill={stroke} opacity="0.75"/>
    <ellipse cx="62" cy="22" rx="9" ry="13" fill="#c2705a"/>
    <ellipse cx="50" cy="44" rx="8" ry="12" fill="#c2705a" opacity="0.85"/>
    <ellipse cx="70" cy="48" rx="7" ry="11" fill="#c2705a" opacity="0.7"/>
    <circle cx="62" cy="20" r="2.5" fill="#f3ead9"/>
    <circle cx="50" cy="42" r="2.2" fill="#f3ead9"/>
  </svg>
);

const SprigRight = ({ className, stroke = "#5b6b46" }) => (
  <svg viewBox="0 0 120 200" fill="none" className={className} aria-hidden="true">
    <path d="M100 195 C 92 130, 80 80, 56 18" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
    <path d="M76 76 C 90 70, 100 58, 100 44 C 86 48, 78 60, 76 72 Z" fill={stroke} opacity="0.8"/>
    <path d="M68 120 C 54 114, 44 102, 44 88 C 58 92, 66 104, 68 116 Z" fill={stroke} opacity="0.7"/>
    <ellipse cx="56" cy="20" rx="9" ry="13" fill="#a8462f"/>
    <ellipse cx="68" cy="42" rx="8" ry="12" fill="#a8462f" opacity="0.8"/>
    <ellipse cx="48" cy="48" rx="7" ry="11" fill="#a8462f" opacity="0.65"/>
    <circle cx="56" cy="18" r="2.5" fill="#f3ead9"/>
  </svg>
);

const StitchBorder = () => (
  <div className="pointer-events-none absolute inset-[10px] border border-dashed border-[#9a8b6a] opacity-70 rounded-[2px]" />
);

export default function App() {
  const [flipped, setFlipped] = useState(false);

  const frontGrid = [
    { k: 'EST.', v: 'MMXIX · Willow Hollow, VT' },
    { k: 'COORD.', v: '44.0521° N — 72.7898° W' },
    { k: 'FORMATS', v: 'Super 16 · 35mm · Bolex H16' },
    { k: 'FIELD KIT', v: 'Pack mule, two lenses, patience' },
    { k: 'SEASON', v: 'Shooting through harvest, Oct 12' },
    { k: 'MOTTO', v: 'Go where the road thins out' },
  ];

  const backGrid = [
    { k: 'WRITE', v: 'marigold@foxgloveandfern.film' },
    { k: 'RING', v: '+1 (802) 555-0173' },
    { k: 'POST', v: 'Rte 7, Box 42, Willow Hollow VT 05672' },
    { k: 'REELS', v: 'foxgloveandfern.film/almanac' },
    { k: 'FOLLOW', v: '@foxglove.fern — field notes weekly' },
    { k: 'DARKROOM', v: 'Open Thursdays, dawn to dusk' },
  ];

  const filmography = [
    { yr: "'24", t: 'The Orchard Keeps Its Own', note: 'doc · 86 min' },
    { yr: "'23", t: 'Letters from the Hayloft', note: 'short · 16mm' },
    { yr: "'22", t: 'Bramble & Bone', note: 'feature · S16' },
    { yr: "'21", t: 'A Field Guide to Leaving', note: 'doc · 41 min' },
  ];

  const laurels = ['SXSW ’24', 'True/False', 'Camden IFF', 'Big Sky', 'Hot Docs ’23'];

  return (
    <>

    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden" style={{ background: '#2c3527' }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,400;1,9..144,600&family=Caveat:wght@500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: `
        body { margin: 0; }
        .grain::after {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
          opacity: 0.07; mix-blend-mode: multiply;
        }
        .paper {
          background:
            radial-gradient(ellipse at 18% 12%, rgba(196,148,90,0.10), transparent 55%),
            radial-gradient(ellipse at 85% 90%, rgba(122,138,92,0.12), transparent 50%),
            #f3ead9;
        }
        .face { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        .flip-scene { perspective: 2200px; }
        .hairline { border-color: rgba(72,64,42,0.28); }
        .tick { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.18em; }
        .meadow-bg {
          background-image:
            radial-gradient(circle at 12% 88%, rgba(168,70,47,0.18), transparent 32%),
            radial-gradient(circle at 88% 14%, rgba(122,138,92,0.22), transparent 36%),
            radial-gradient(circle at 70% 80%, rgba(196,148,90,0.10), transparent 30%);
        }
      `}} />

      {/* page texture + tiny scattered florals */}
      <div className="absolute inset-0 grain meadow-bg" />
      <div className="absolute top-8 left-10 text-[#7a8a5c] opacity-50 rotate-[-12deg]"><Flower2 size={28} strokeWidth={1.4} /></div>
      <div className="absolute bottom-12 right-14 text-[#c2705a] opacity-50 rotate-[18deg]"><Flower2 size={34} strokeWidth={1.4} /></div>
      <div className="absolute top-[22%] right-[12%] text-[#9aa57c] opacity-40 rotate-[40deg]"><Flower2 size={20} strokeWidth={1.4} /></div>

      {/* header strip */}
      <div className="tick text-[#cfd6bd] mb-5 flex items-center gap-3 uppercase">
        <span className="h-px w-10 bg-[#cfd6bd]/40 inline-block" />
        Calling card · letterpress on 600gsm cotton, two passes
        <span className="h-px w-10 bg-[#cfd6bd]/40 inline-block" />
      </div>

      {/* CARD */}
      <div className="flip-scene cursor-pointer select-none" onClick={() => setFlipped(f => !f)}>
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.9, ease: [0.32, 0.72, 0.18, 1] }}
          style={{ transformStyle: 'preserve-3d' }}
          className="relative w-[min(92vw,780px)] h-[470px]"
        >
          {/* ============ FRONT ============ */}
          <div className="face paper grain absolute inset-0 rounded-[3px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.65),0_2px_0_rgba(255,255,255,0.15)_inset] overflow-hidden">
            <StitchBorder />
            <SprigLeft className="absolute -left-1 bottom-2 w-[110px] opacity-90" />
            <SprigRight className="absolute -right-1 top-1 w-[100px] opacity-90 rotate-180" />

            <div className="relative h-full flex flex-col px-9 py-6">
              {/* top dense strip */}
              <div className="flex items-center justify-between border-b hairline pb-2">
                <span className="tick text-[#5d5236] uppercase">Foxglove & Fern Pictures Co.</span>
                <span className="tick text-[#5d5236] uppercase hidden sm:block">Indep. Film · Pastoral Documentary</span>
                <span className="tick text-[#a8462f] uppercase">№ 042 / 250</span>
              </div>

              {/* HERO name */}
              <div className="relative mt-1 leading-none">
                <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '128px', fontWeight: 600, fontStyle: 'italic', letterSpacing: '-0.04em', lineHeight: 0.92 }} className="text-[#33402a]">
                  Foxglove
                </h1>
                <div className="flex items-baseline gap-3 mt-1 ml-2">
                  <span style={{ fontFamily: "'Caveat', cursive", fontSize: '34px' }} className="text-[#a8462f] -rotate-2 inline-block">&amp; fern</span>
                  <span className="tick text-[#5d5236] uppercase tracking-[0.3em]">Moving Pictures · Made by hand, mostly outdoors</span>
                </div>
              </div>

              {/* dense data grid */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 border hairline divide-x divide-y hairline" style={{ borderColor: 'rgba(72,64,42,0.28)' }}>
                {frontGrid.map((c) => (
                  <div key={c.k} className="px-3 py-2 hover:bg-[#e9dcc2]/70 transition-colors" style={{ borderColor: 'rgba(72,64,42,0.28)' }}>
                    <div className="tick text-[#a8462f] uppercase">{c.k}</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: '14px' }} className="text-[#33402a] mt-0.5">{c.v}</div>
                  </div>
                ))}
              </div>

              {/* bottom strip */}
              <div className="mt-auto pt-3 flex items-center justify-between border-t hairline">
                <div className="flex items-center gap-2 text-[#5d5236]">
                  <Film size={13} strokeWidth={1.6} />
                  <span style={{ fontFamily: "'Fraunces', serif", fontSize: '14px', fontStyle: 'italic' }}>“Stories gathered like windfall apples — bruised, sweet, worth keeping.”</span>
                </div>
                <div className="flex items-center gap-2 text-[#5d5236]">
                  <MapPin size={13} strokeWidth={1.6} />
                  <span className="tick uppercase">Willow Hollow, Vermont</span>
                </div>
              </div>
            </div>
          </div>

          {/* ============ BACK ============ */}
          <div className="face paper grain absolute inset-0 rounded-[3px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.65)] overflow-hidden" style={{ transform: 'rotateY(180deg)' }}>
            <StitchBorder />
            <SprigRight className="absolute -left-2 -bottom-3 w-[90px] opacity-70" />

            <div className="relative h-full flex flex-col px-9 py-6">
              <div className="flex items-end justify-between border-b hairline pb-2">
                <div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: '30px', fontWeight: 700, letterSpacing: '-0.02em' }} className="text-[#33402a] leading-none">Marigold Hart</div>
                  <div className="tick text-[#a8462f] uppercase mt-1">Director · Cinematographer · Keeper of the negatives</div>
                </div>
                <span style={{ fontFamily: "'Caveat', cursive", fontSize: '30px' }} className="text-[#5b6b46] rotate-[-3deg]">come find us —</span>
              </div>

              {/* contact grid */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 border hairline divide-x divide-y" style={{ borderColor: 'rgba(72,64,42,0.28)' }}>
                {backGrid.map((c) => (
                  <div key={c.k} className="px-3 py-2 hover:bg-[#e9dcc2]/70 transition-colors" style={{ borderColor: 'rgba(72,64,42,0.28)' }}>
                    <div className="tick text-[#a8462f] uppercase">{c.k}</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: '14px' }} className="text-[#33402a] mt-0.5 break-all">{c.v}</div>
                  </div>
                ))}
              </div>

              {/* filmography ledger */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-0 border hairline" style={{ borderColor: 'rgba(72,64,42,0.28)' }}>
                <div className="divide-y" style={{ borderColor: 'rgba(72,64,42,0.28)' }}>
                  <div className="tick text-[#5d5236] uppercase px-3 py-1.5 bg-[#e9dcc2]/60 border-b hairline">Recent harvests</div>
                  {filmography.map((f) => (
                    <div key={f.t} className="flex items-baseline gap-3 px-3 py-1.5 border-b hairline last:border-b-0 hover:bg-[#e9dcc2]/50 transition-colors" style={{ borderColor: 'rgba(72,64,42,0.28)' }}>
                      <span className="tick text-[#a8462f]">{f.yr}</span>
                      <span style={{ fontFamily: "'Fraunces', serif", fontSize: '14px', fontStyle: 'italic' }} className="text-[#33402a]">{f.t}</span>
                      <span className="tick text-[#5d5236] ml-auto">{f.note}</span>
                    </div>
                  ))}
                </div>
                <div className="border-l hairline px-3 py-2" style={{ borderColor: 'rgba(72,64,42,0.28)' }}>
                  <div className="tick text-[#5d5236] uppercase mb-1.5">Laurels</div>
                  <div className="flex flex-wrap gap-1.5">
                    {laurels.map(l => (
                      <span key={l} style={{ fontFamily: "'Fraunces', serif", fontSize: '13px' }} className="px-2 py-0.5 border border-[#5b6b46]/50 rounded-full text-[#33402a] bg-[#e9dcc2]/50">{l}</span>
                    ))}
                  </div>
                  <div style={{ fontFamily: "'Caveat', cursive", fontSize: '22px' }} className="text-[#a8462f] mt-2 rotate-[-2deg]">commissions open for spring</div>
                </div>
              </div>

              <div className="mt-auto pt-2 flex items-center justify-between">
                <span className="tick text-[#5d5236] uppercase">Soy inks · Dried-flower deckle · No two cards alike</span>
                <span className="tick text-[#5d5236] uppercase">Foxglove &amp; Fern · Est. MMXIX</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* flip hint */}
      <button
        onClick={() => setFlipped(f => !f)}
        className="mt-6 group flex items-center gap-2 text-[#cfd6bd] hover:text-[#f3ead9] transition-colors"
      >
        <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-700" />
        <span className="tick uppercase">{flipped ? 'Turn back to the meadow side' : 'Turn the card over'}</span>
      </button>
    </div>
    </>
  );
}