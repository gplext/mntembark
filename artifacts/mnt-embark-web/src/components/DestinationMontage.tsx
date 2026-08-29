import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@workspace/mnt-embark/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Destination data — five scenes, each backed by a locally hosted 8-second clip
// ─────────────────────────────────────────────────────────────────────────────

interface Destination {
  id: string;
  label: string;
  region: string;
  tagline: string;
  video: string;
  webm: string;
  poster: string;
}

const DESTINATIONS: Destination[] = [
  {
    id: "iceland",
    label: "Iceland",
    region: "Arctic Circle",
    tagline: "Where light defies darkness",
    video: "videos/scene-iceland.mp4",
    webm: "videos/scene-iceland.webm",
    poster: "images/hero-aurora.jpg",
  },
  {
    id: "maldives",
    label: "Maldives",
    region: "Indian Ocean",
    tagline: "Infinity at the edge of the world",
    video: "videos/scene-maldives.mp4",
    webm: "videos/scene-maldives.webm",
    poster: "images/hero-maldives.jpg",
  },
  {
    id: "patagonia",
    label: "Patagonia",
    region: "South America",
    tagline: "Stone and fire at the end of the earth",
    video: "videos/scene-patagonia.mp4",
    webm: "videos/scene-patagonia.webm",
    poster: "images/hero-patagonia.jpg",
  },
  {
    id: "sahara",
    label: "Sahara",
    region: "North Africa",
    tagline: "A silence older than memory",
    video: "videos/scene-sahara.mp4",
    webm: "videos/scene-sahara.webm",
    poster: "images/hero-sahara.jpg",
  },
  {
    id: "morocco",
    label: "Morocco",
    region: "Maghreb",
    tagline: "Light made architecture",
    video: "videos/scene-morocco.mp4",
    webm: "videos/scene-morocco.webm",
    poster: "images/dest-morocco.jpg",
  },
];

// Clip duration in ms — each clip is 8 seconds
const SCENE_DURATION = 8000;
// Crossfade overlap duration in ms
const FADE_DURATION = 1200;
const TRANSITION_SETTLE_DURATION = FADE_DURATION + 200;
const AUTOPLAY_DELAY = SCENE_DURATION - TRANSITION_SETTLE_DURATION;
// Latest point in a scene at which the next scene may start prefetching, even
// if the current one never reported that it had buffered.
const PREFETCH_FALLBACK_DELAY = 3000;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function useBasePath() {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual scene video — renders a single <video> that auto-plays
// ─────────────────────────────────────────────────────────────────────────────

function SceneVideo({
  dest,
  isActive,
  isPrev,
  canPlay,
  onBuffered,
}: {
  dest: Destination;
  isActive: boolean;
  isPrev: boolean;
  canPlay: boolean;
  onBuffered?: () => void;
}) {
  const base = useBasePath();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if ((!isActive && !isPrev) || !canPlay) {
      vid.pause();
      return;
    }
    if (!isActive) return;

    let cancelled = false;
    const startPlayback = () => {
      if (cancelled) return;
      vid.currentTime = 0;
      vid.play().catch(() => {
        // Autoplay blocked — video still shows poster
      });
    };

    if (vid.readyState >= HTMLMediaElement.HAVE_METADATA) {
      startPlayback();
    } else {
      vid.addEventListener("canplay", startPlayback, { once: true });
      vid.load();
    }

    return () => {
      cancelled = true;
      vid.removeEventListener("canplay", startPlayback);
    };
  }, [canPlay, isActive, isPrev]);

  return (
    <motion.div
      key={dest.id}
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: isActive || isPrev ? 1 : 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: FADE_DURATION / 1000, ease: "easeInOut" }}
      style={{ willChange: "opacity" }}
    >
      <video
        ref={videoRef}
        data-testid="destination-scene-video"
        data-active={isActive ? "true" : "false"}
        poster={`${base}/${dest.poster}`}
        autoPlay={isActive && canPlay}
        muted
        playsInline
        loop={false}
        /*
         * Only the scene on screen downloads in full. The outgoing scene is
         * mid-crossfade and already played, so it drops to metadata rather
         * than continuing to pull data it will never use.
         *
         * Previously every layer was preload="auto", so the active, previous
         * and next clips all downloaded at once — up to 45 MB in parallel,
         * which starved the page's images of bandwidth and left later scenes
         * showing only their poster when their turn came.
         */
        preload={isActive ? "auto" : "metadata"}
        onCanPlayThrough={isActive ? onBuffered : undefined}
        className="w-full h-full object-cover"
        style={{ display: "block" }}
      >
        <source src={`${base}/${dest.webm}`} type="video/webm" />
        <source src={`${base}/${dest.video}`} type="video/mp4" />
      </video>
      {/* Cinematic letterbox vignette — dark gradient on all four edges */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            "linear-gradient(to bottom, hsl(var(--foreground) / 0.55) 0%, transparent 22%, transparent 72%, hsl(var(--foreground) / 0.88) 100%)",
            "linear-gradient(to right, hsl(var(--foreground) / 0.32) 0%, transparent 30%)",
          ].join(", "),
        }}
      />
    </motion.div>
  );
}

function ScenePreload({ dest }: { dest: Destination }) {
  const base = useBasePath();

  return (
    <video
      data-testid="destination-scene-preload"
      aria-hidden="true"
      tabIndex={-1}
      muted
      playsInline
      /*
       * Mounted only once the active scene has finished buffering, so the two
       * downloads happen in sequence rather than competing. On a fast link
       * that is imperceptible; on a slow one it is the difference between the
       * current scene playing and everything stalling at once.
       */
      preload="auto"
      className="absolute h-px w-px opacity-0 pointer-events-none"
    >
      <source src={`${base}/${dest.webm}`} type="video/webm" />
      <source src={`${base}/${dest.video}`} type="video/mp4" />
    </video>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated word-by-word tagline reveal
// ─────────────────────────────────────────────────────────────────────────────

function TaglineReveal({ text, visible }: { text: string; visible: boolean }) {
  const words = text.split(" ");
  return (
    <span className="inline-block overflow-hidden">
      {words.map((word, i) => (
        <motion.span
          key={`${text}-${i}`}
          className="inline-block mr-[0.22em]"
          initial={{ opacity: 0, y: "40%", rotateX: 25 }}
          animate={
            visible
              ? { opacity: 1, y: "0%", rotateX: 0 }
              : { opacity: 0, y: "40%", rotateX: 25 }
          }
          transition={{
            duration: 0.7,
            delay: visible ? 0.55 + i * 0.09 : 0,
            ease: [0.16, 1, 0.3, 1],
          }}
          style={{ display: "inline-block", perspective: 400 }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main exported section
// ─────────────────────────────────────────────────────────────────────────────

export function DestinationMontage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [textVisible, setTextVisible] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [isInView, setIsInView] = useState(false);
  // True once the on-screen clip has buffered enough to play through. Gates
  // the preload of the following scene so the two never compete for bandwidth.
  const [activeBuffered, setActiveBuffered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0.35 },
    );
    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  const transitionTo = useCallback(
    (nextIndex: number) => {
      if (nextIndex === activeIndex) return;

      if (textTimerRef.current) clearTimeout(textTimerRef.current);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);

      setTextVisible(false);
      // Close the preload gate again: the incoming scene has to buffer before
      // the one after it is allowed to start downloading.
      setActiveBuffered(false);
      setPrevIndex(activeIndex);
      setActiveIndex(nextIndex);
      setHasStarted(true);

      textTimerRef.current = setTimeout(() => {
        setTextVisible(true);
        textTimerRef.current = null;
      }, FADE_DURATION / 2);

      settleTimerRef.current = setTimeout(() => {
        setPrevIndex(null);
        settleTimerRef.current = null;
      }, TRANSITION_SETTLE_DURATION);
    },
    [activeIndex],
  );

  const handleActiveBuffered = useCallback(() => setActiveBuffered(true), []);

  /*
   * Safety valve for the preload gate. canplaythrough is not guaranteed to
   * fire — a browser that decides it has enough data, a video that errors, or
   * a tab that was backgrounded can all skip it. Without this the gate would
   * latch shut and no scene would ever prefetch, so open it on a timer that is
   * comfortably shorter than the scene duration.
   */
  useEffect(() => {
    const t = setTimeout(() => setActiveBuffered(true), PREFETCH_FALLBACK_DELAY);
    return () => clearTimeout(t);
  }, [activeIndex]);

  const advance = useCallback(() => {
    transitionTo((activeIndex + 1) % DESTINATIONS.length);
  }, [activeIndex, transitionTo]);

  const goTo = useCallback((idx: number) => transitionTo(idx), [transitionTo]);

  // Start a fresh countdown only after the crossfade has fully settled.
  useEffect(() => {
    if (!isInView || prevIndex !== null) return;

    timerRef.current = setTimeout(
      advance,
      hasStarted ? AUTOPLAY_DELAY : SCENE_DURATION,
    );
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activeIndex, advance, hasStarted, isInView, prevIndex]);

  useEffect(() => {
    return () => {
      if (textTimerRef.current) clearTimeout(textTimerRef.current);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, []);

  const active = DESTINATIONS[activeIndex];
  const next = DESTINATIONS[(activeIndex + 1) % DESTINATIONS.length];

  return (
    <section
      ref={sectionRef}
      id="destination-films"
      data-testid="destination-montage"
      className="relative w-full overflow-hidden bg-black"
      style={{ aspectRatio: "16/9", minHeight: "320px", maxHeight: "90vh" }}
    >
      {activeBuffered && <ScenePreload dest={next} />}

      {/* ── Video layers ─────────────────────────────────────────────── */}
      {DESTINATIONS.map((dest, i) => (
        <AnimatePresence key={dest.id} mode="sync">
          {(i === activeIndex || i === prevIndex) && (
            <SceneVideo
              dest={dest}
              isActive={i === activeIndex}
              isPrev={i === prevIndex}
              canPlay={isInView}
              onBuffered={handleActiveBuffered}
            />
          )}
        </AnimatePresence>
      ))}

      {/* ── Persistent gold accent line — transforms across scenes ───── */}
      <motion.div
        className="absolute pointer-events-none"
        animate={{ scaleX: textVisible ? 1 : 0.3, opacity: textVisible ? 1 : 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        style={{
          bottom: "clamp(80px, 14%, 140px)",
          left: "clamp(24px, 6%, 80px)",
          width: "clamp(32px, 5vw, 72px)",
          height: "1px",
          background: "hsl(var(--primary))",
          transformOrigin: "left center",
        }}
      />

      {/* ── Corner filigree ───────────────────────────────────────────── */}
      <div
        className="absolute top-6 left-6 pointer-events-none"
        style={{
          width: "clamp(28px, 4vw, 48px)",
          height: "clamp(28px, 4vw, 48px)",
          borderTop: "1px solid hsl(var(--primary) / 0.45)",
          borderLeft: "1px solid hsl(var(--primary) / 0.45)",
        }}
      />
      <div
        className="absolute top-6 right-6 pointer-events-none"
        style={{
          width: "clamp(28px, 4vw, 48px)",
          height: "clamp(28px, 4vw, 48px)",
          borderTop: "1px solid hsl(var(--primary) / 0.45)",
          borderRight: "1px solid hsl(var(--primary) / 0.45)",
        }}
      />
      <div
        className="absolute bottom-6 left-6 pointer-events-none"
        style={{
          width: "clamp(28px, 4vw, 48px)",
          height: "clamp(28px, 4vw, 48px)",
          borderBottom: "1px solid hsl(var(--primary) / 0.45)",
          borderLeft: "1px solid hsl(var(--primary) / 0.45)",
        }}
      />
      <div
        className="absolute bottom-6 right-6 pointer-events-none"
        style={{
          width: "clamp(28px, 4vw, 48px)",
          height: "clamp(28px, 4vw, 48px)",
          borderBottom: "1px solid hsl(var(--primary) / 0.45)",
          borderRight: "1px solid hsl(var(--primary) / 0.45)",
        }}
      />

      {/* ── Scene counter top-right ───────────────────────────────────── */}
      <div
        className="absolute top-6 right-0 flex items-center gap-3 pointer-events-none"
        style={{ paddingRight: "clamp(24px, 5vw, 64px)" }}
      >
        <motion.span
          key={activeIndex}
          className="font-sans text-white/40"
          style={{ fontSize: "clamp(10px, 1vw, 12px)", letterSpacing: "0.2em" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {String(activeIndex + 1).padStart(2, "0")} / {String(DESTINATIONS.length).padStart(2, "0")}
        </motion.span>
      </div>

      {/* ── Primary text block (bottom-left) ─────────────────────────── */}
      <div
        className="absolute bottom-0 left-0 flex flex-col pointer-events-none"
        style={{
          paddingLeft: "clamp(24px, 6%, 80px)",
          paddingBottom: "clamp(32px, 5%, 64px)",
        }}
      >
        {/* Region label */}
        <motion.p
          key={`region-${activeIndex}`}
          className="font-sans text-white/60 uppercase"
          style={{
            fontSize: "clamp(9px, 1vw, 11px)",
            letterSpacing: "0.35em",
            marginBottom: "clamp(6px, 1vw, 12px)",
          }}
          initial={{ opacity: 0, x: -16 }}
          animate={textVisible ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
          transition={{ duration: 0.55, delay: 0.2, ease: "easeOut" }}
        >
          {active.region}
        </motion.p>

        {/* Destination name */}
        <motion.h2
          key={`label-${activeIndex}`}
          className="font-serif text-white font-light leading-none"
          style={{
            fontSize: "clamp(36px, 7vw, 96px)",
            letterSpacing: "-0.01em",
            marginBottom: "clamp(8px, 1.2vw, 18px)",
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={textVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.75, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {active.label}
        </motion.h2>

        {/* Tagline */}
        <p
          className="font-sans text-white/70 italic"
          style={{
            fontSize: "clamp(11px, 1.2vw, 16px)",
            letterSpacing: "0.04em",
            marginBottom: "clamp(20px, 3vw, 40px)",
          }}
        >
          <TaglineReveal text={active.tagline} visible={textVisible} />
        </p>
      </div>

      {/* ── Scene dot navigation (bottom-right) ──────────────────────── */}
      <div
        className="absolute flex flex-col gap-2"
        style={{
          bottom: "clamp(32px, 5%, 64px)",
          right: "clamp(24px, 5vw, 64px)",
        }}
      >
        {DESTINATIONS.map((dest, idx) => (
          <button
            key={dest.id}
            aria-label={`Go to ${dest.label}`}
            onClick={() => goTo(idx)}
            className={cn(
              "rounded-full transition-all duration-500",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40",
            )}
            style={{
              width: "6px",
              height: idx === activeIndex ? "28px" : "6px",
              background:
                idx === activeIndex
                  ? "hsl(var(--primary))"
                  : "rgba(255,255,255,0.35)",
              cursor: "pointer",
              border: "none",
              padding: 0,
              transition: "height 0.4s cubic-bezier(0.16,1,0.3,1), background 0.3s ease",
            }}
          />
        ))}
      </div>

      {/* ── Progress bar (bottom edge) ────────────────────────────────── */}
      <ProgressBar
        key={activeIndex}
        duration={SCENE_DURATION}
        playing={isInView}
      />

      {/* ── Section label (top-left) ──────────────────────────────────── */}
      <div
        className="absolute top-6 left-0 pointer-events-none"
        style={{ paddingLeft: "clamp(24px, 6%, 80px)" }}
      >
        <p
          className="font-sans text-white/50 uppercase"
          style={{ fontSize: "clamp(9px, 0.9vw, 11px)", letterSpacing: "0.35em" }}
        >
          Destination Films
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Thin animated progress bar — counts down scene duration
// ─────────────────────────────────────────────────────────────────────────────

function ProgressBar({ duration, playing }: { duration: number; playing: boolean }) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 pointer-events-none"
      style={{ height: "2px", background: "rgba(255,255,255,0.1)" }}
    >
      <motion.div
        className="h-full"
        style={{ background: "hsl(var(--primary))", transformOrigin: "left center" }}
        initial={{ scaleX: 0 }}
        animate={playing ? { scaleX: 1 } : { scaleX: 0 }}
        transition={{ duration: duration / 1000, ease: "linear" }}
      />
    </div>
  );
}
