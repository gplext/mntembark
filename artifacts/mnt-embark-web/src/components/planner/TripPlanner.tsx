/**
 * The travel planner: the form a first-time visitor sees, and the globe it
 * folds into.
 *
 * Nothing in the form is required. What the visitor fills in is kept in the
 * trip context (and the browser's storage), shown on the globe as their
 * dates, and written into the top of any enquiry they go on to send.
 *
 * Phases, in order after "Set my travel plan":
 *
 *   form      the card, centred, over a dimmed page
 *   breaking  the card splits into tiles that flip over to a dotted world map
 *   rolling   the map closes into a circle and spins, becoming a globe
 *   dropping  the globe shrinks and drops to the bottom centre of the screen
 *   globe     it rests there showing the dates in gold; a click reopens the form
 *
 * Visitors who ask the OS for reduced motion skip straight to the globe.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/mnt-embark/components/ui/select";
import { Sparkles, ShieldCheck, X, Users, BedDouble } from "lucide-react";
import {
  useTrip,
  formatTripDatesShort,
  HOTEL_TYPES,
  EMPTY_TRIP,
  type Trip,
} from "@/lib/trip";
import PlacePicker, { type PlaceValue } from "./PlacePicker";
import DateRangeField from "./DateRangeField";
import { WORLD_DOTS_PATH, WORLD_DOTS_VIEWBOX } from "./worldDots";

type Phase = "hidden" | "form" | "breaking" | "rolling" | "dropping" | "globe";

const GOLD = "#A8823E";
const GOLD_LIGHT = "#E2C27A";
const INK = "#16130F";
const CREAM = "#FBF8F2";
const SAND = "#F3EDE2";
const LINE = "#E6DCC8";

const GLOBE = 92; // resting diameter, px
const GLOBE_BOTTOM = 22; // gap to the bottom of the screen, px
const COLS = 8;
const ROWS = 5;

const NOTICE =
  "MNT Embark is currently taking reservations and hotel bookings; tours are temporarily suspended. For hotel bookings and flight reservations, kindly select your travel dates and the place you would like to visit, then send us an inquiry. We currently do not run an automated online reservation system, but we will curate a well-thought-out plan specifically for you and get back to you ASAP.";

/* ------------------------------------------------------------------ map */

/** The dotted world, dark ground and gold land. Sized by its parent. */
function DotMap({ className }: { className?: string }) {
  return (
    <svg viewBox={WORLD_DOTS_VIEWBOX} preserveAspectRatio="none" className={className} aria-hidden>
      <path d={WORLD_DOTS_PATH} stroke={GOLD_LIGHT} strokeWidth={0.62} strokeLinecap="round" fill="none" />
    </svg>
  );
}

/**
 * Two copies of the map side by side, sliding left forever: inside a circle
 * that reads as a globe turning. It fills its parent's height and is four
 * times as wide (two maps at 2:1), so one loop is half its own width.
 */
function SpinningMap({ seconds }: { seconds: number }) {
  return (
    <div
      className="absolute top-0 left-0 h-full flex"
      style={{ aspectRatio: "4 / 1", animation: `mnt-globe-spin ${seconds}s linear infinite` }}
    >
      <DotMap className="h-full w-1/2" />
      <DotMap className="h-full w-1/2" />
    </div>
  );
}

/** Light from the top left and a dark limb: what makes a flat map read as a sphere. */
function SphereShade() {
  return (
    <div
      className="absolute inset-0 rounded-full pointer-events-none"
      style={{
        background:
          "radial-gradient(circle at 32% 28%, rgba(255,244,214,0.35), rgba(255,244,214,0) 42%), radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.75) 100%)",
      }}
    />
  );
}

/* --------------------------------------------------------------- globe */

function RestingGlobe({ trip, onOpen }: { trip: Trip; onOpen: () => void }) {
  const dates = formatTripDatesShort(trip);
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.6 }}
      whileHover={{ scale: 1.06 }}
      transition={{ duration: 0.35 }}
      className="fixed z-40 rounded-full overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E2C27A] focus-visible:ring-offset-2"
      style={{
        width: GLOBE,
        height: GLOBE,
        left: `calc(50% - ${GLOBE / 2}px)`,
        bottom: GLOBE_BOTTOM,
        background: "radial-gradient(circle at 40% 35%, #2B2419, #0B0906 72%)",
        boxShadow: "0 12px 30px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(226,194,122,0.7)",
      }}
      aria-label={dates ? `Your travel plan, ${dates}. Open the planner` : "Plan your trip"}
      data-testid="planner-globe"
    >
      <SpinningMap seconds={28} />
      <SphereShade />
      <span className="absolute inset-0 flex items-center justify-center">
        <span
          className="px-2 py-0.5 rounded-full font-sans font-semibold uppercase whitespace-nowrap"
          style={{
            color: GOLD_LIGHT,
            background: "rgba(8,7,5,0.62)",
            fontSize: dates && dates.length > 9 ? 9 : 10.5,
            letterSpacing: "0.08em",
          }}
          data-testid="planner-globe-dates"
        >
          {dates ?? "Plan"}
        </span>
      </span>
    </motion.button>
  );
}

/* ---------------------------------------------------------- transition */

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The card turning into the globe. Positioned in px from the card's own
 * measured rectangle, so the first frame sits exactly where the card was.
 */
function Transformation({ phase, from, onDone }: { phase: Phase; from: Rect; onDone: (p: Phase) => void }) {
  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;
  const mid = Math.min(220, from.width * 0.5, from.height * 0.9);
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const target =
    phase === "breaking"
      ? { ...from, borderRadius: 4 }
      : phase === "rolling"
        ? { left: cx - mid / 2, top: cy - mid / 2, width: mid, height: mid, borderRadius: mid / 2 }
        : { left: vw / 2 - GLOBE / 2, top: vh - GLOBE - GLOBE_BOTTOM, width: GLOBE, height: GLOBE, borderRadius: GLOBE / 2 };

  const transition =
    phase === "breaking"
      ? { duration: 0.01 }
      : phase === "rolling"
        ? { duration: 0.85, ease: [0.65, 0, 0.35, 1] as const }
        : { duration: 0.75, ease: [0.5, 0, 0.2, 1] as const };

  // Tiles need the map at the card's full size, sliced; after that one layer spins.
  const tiles = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const delay = (c + r) * 0.035 + ((c * 7 + r * 3) % 5) * 0.012;
      tiles.push(
        <div
          key={`${r}-${c}`}
          className="absolute"
          style={{
            left: `${(c / COLS) * 100}%`,
            top: `${(r / ROWS) * 100}%`,
            width: `${100 / COLS}%`,
            height: `${100 / ROWS}%`,
            perspective: 600,
          }}
        >
          <motion.div
            className="relative w-full h-full"
            style={{ transformStyle: "preserve-3d" }}
            initial={{ rotateY: 0, scale: 1 }}
            animate={{ rotateY: 180, scale: [1, 0.86, 1] }}
            transition={{ duration: 0.55, delay, ease: "easeInOut" }}
          >
            <div className="absolute inset-0" style={{ background: CREAM, backfaceVisibility: "hidden" }} />
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "#0E0C08" }}
            >
              <div
                className="absolute"
                // The whole map at its true 2:1 shape and card height, so the
                // spinning layer that replaces the tiles starts at the same scale.
                style={{
                  width: from.height * 2,
                  height: from.height,
                  left: -c * (from.width / COLS),
                  top: -r * (from.height / ROWS),
                }}
              >
                <DotMap className="w-full h-full" />
              </div>
            </div>
          </motion.div>
        </div>,
      );
    }
  }

  return (
    <>
    {/* The dimmed page behind the form lifts as the map rolls away. */}
    <motion.div
      className="fixed inset-0 z-40 bg-black/55 pointer-events-none"
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === "breaking" ? 1 : 0 }}
      transition={{ duration: 0.9 }}
    />
    <motion.div
      className="fixed z-50 overflow-hidden"
      initial={{ ...from, borderRadius: 4 }}
      animate={target}
      transition={transition}
      onAnimationComplete={() => onDone(phase)}
      style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}
      aria-hidden
    >
      {phase === "breaking" ? (
        tiles
      ) : (
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 40% 35%, #2B2419, #0B0906 72%)" }}>
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: phase === "rolling" ? 0.8 : 1 }}
            animate={{ opacity: 1 }}
          >
            {/* The flat map, sized to the shell and spinning fast while it rolls up. */}
            <SpinningMap seconds={phase === "rolling" ? 2.2 : 6} />
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
            <SphereShade />
          </motion.div>
        </div>
      )}
    </motion.div>
    </>
  );
}

/* ---------------------------------------------------------------- form */

const fieldBox = "h-11 px-3 bg-white border border-[#E6DCC8] rounded-[2px] hover:border-[#A8823E]/60 transition-colors";
const fieldLabel = "block mb-1.5 font-sans text-[9px] font-semibold uppercase tracking-[0.18em]";

function PlannerForm({
  initial,
  planSet,
  onSubmit,
  onEnquire,
  onDismiss,
  cardRef,
  fromGlobe,
}: {
  initial: Trip;
  planSet: boolean;
  onSubmit: (t: Partial<Trip>) => void;
  onEnquire: (t: Partial<Trip>) => void;
  onDismiss: () => void;
  cardRef: React.RefObject<HTMLDivElement | null>;
  fromGlobe: boolean;
}) {
  const [place, setPlace] = useState<PlaceValue>({
    country: initial.country,
    location: initial.location,
    attractionName: initial.attractionName,
    attractionSlug: initial.attractionSlug,
  });
  const [start, setStart] = useState(initial.startDate);
  const [end, setEnd] = useState(initial.endDate);
  const [hotel, setHotel] = useState(initial.hotelType ?? "");
  const [guests, setGuests] = useState(initial.guests ? String(initial.guests) : "");

  const values = (): Partial<Trip> => ({
    ...place,
    destination: null,
    startDate: start,
    endDate: end,
    hotelType: hotel || null,
    guests: guests ? Number(guests) : null,
  });

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[3px]" onClick={onDismiss} />
      <motion.div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="planner-title"
        className="relative w-full max-w-[760px] max-h-[94dvh] overflow-y-auto shadow-2xl"
        style={{ background: CREAM, border: `1px solid ${LINE}`, transformOrigin: "50% 100%" }}
        initial={fromGlobe ? { opacity: 0, scale: 0.2, y: 260 } : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: fromGlobe ? 0.5 : 0.6, ease: [0.22, 1, 0.36, 1] }}
        data-testid="planner-form"
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 text-[#8B8173] hover:text-[#16130F]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-5 sm:px-12 pt-10 pb-8 text-center">
          <p className="inline-flex items-center gap-2 font-sans text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: GOLD }}>
            <Sparkles className="h-3 w-3" /> The new era of MNT Embark
          </p>
          <h2 id="planner-title" className="mt-4 font-serif font-light leading-[1.08] text-[34px] sm:text-[46px]" style={{ color: INK }}>
            Hotel Stays &amp; Flights
            <br />
            Curated Around You
          </h2>
          <p className="mt-5 mx-auto max-w-[560px] font-sans text-[12.5px] leading-relaxed text-[#5E564B]">{NOTICE}</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(values());
          }}
          className="mx-3 sm:mx-8 mb-6 p-4 sm:p-5"
          style={{ background: SAND }}
        >
          <div className="grid gap-3 grid-cols-2 md:grid-cols-[1.6fr_1.25fr_1fr_0.85fr]">
            <div className="col-span-2 md:col-span-1 min-w-0">
              <span className={fieldLabel} style={{ color: GOLD }}>Destination</span>
              <PlacePicker value={place} onChange={setPlace} triggerClassName={fieldBox} />
            </div>
            <div className="col-span-2 md:col-span-1 min-w-0">
              <span className={fieldLabel} style={{ color: GOLD }}>Travel window</span>
              <DateRangeField
                start={start}
                end={end}
                onChange={(a, b) => {
                  setStart(a);
                  setEnd(b);
                }}
                triggerClassName={fieldBox}
              />
            </div>
            <div className="min-w-0">
              <span className={fieldLabel} style={{ color: GOLD }}>Stay</span>
              <Select value={hotel || "__any"} onValueChange={(v) => v && setHotel(v === "__any" ? "" : v)}>
                <SelectTrigger className={`${fieldBox} w-full text-[13px] shadow-none focus:ring-0`} data-testid="planner-hotel">
                  <div className="flex items-center gap-2 min-w-0">
                    <BedDouble className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
                    <SelectValue placeholder="Any" />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[70] bg-[#FDFBF7] border-[#E6DCC8]">
                  <SelectItem value="__any">No preference</SelectItem>
                  {HOTEL_TYPES.map((h) => (
                    <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <span className={fieldLabel} style={{ color: GOLD }}>Party</span>
              <Select value={guests || "__any"} onValueChange={(v) => v && setGuests(v === "__any" ? "" : v)}>
                <SelectTrigger className={`${fieldBox} w-full text-[13px] shadow-none focus:ring-0`} data-testid="planner-guests">
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
                    <SelectValue placeholder="Guests" />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[70] bg-[#FDFBF7] border-[#E6DCC8]">
                  <SelectItem value="__any">Not sure yet</SelectItem>
                  {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "Guest" : "Guests"}</SelectItem>
                  ))}
                  <SelectItem value="10">10+ Guests</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex flex-col-reverse sm:flex-row sm:items-center gap-3 sm:gap-6">
            <p className="flex items-start gap-2 text-left font-sans text-[11px] leading-snug text-[#5E564B] sm:flex-1">
              <ShieldCheck className="h-3.5 w-3.5 mt-px shrink-0" style={{ color: GOLD }} />
              Nothing here is required. Fill in what you know and we will plan the rest.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:shrink-0">
              {planSet && (
                <button
                  type="button"
                  onClick={() => onEnquire(values())}
                  className="h-11 px-5 font-sans text-[10.5px] font-semibold uppercase tracking-[0.2em] border transition-colors hover:bg-[#A8823E] hover:text-white"
                  style={{ borderColor: GOLD, color: GOLD }}
                  data-testid="planner-enquire"
                >
                  Send inquiry
                </button>
              )}
              <button
                type="submit"
                className="h-11 px-7 font-sans text-[10.5px] font-semibold uppercase tracking-[0.2em] text-white transition-opacity hover:opacity-90"
                style={{ background: INK }}
                data-testid="planner-submit"
              >
                {planSet ? "Update my plan" : "Set my travel plan"}
              </button>
            </div>
          </div>
        </form>

        <div className="pb-7 text-center">
          {!planSet ? (
            <button
              type="button"
              onClick={onDismiss}
              className="font-sans text-[10px] uppercase tracking-[0.18em] underline underline-offset-4 text-[#5E564B] hover:text-[#16130F]"
              data-testid="planner-skip"
            >
              Continue browsing without a plan
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onEnquire(values())}
              className="font-sans text-[10px] uppercase tracking-[0.18em] underline underline-offset-4 text-[#5E564B] hover:text-[#16130F]"
            >
              Ready? Send us an inquiry with this plan
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- root */

export default function TripPlanner() {
  const { trip, setTrip, welcomed, markWelcomed } = useTrip();
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<Phase>(welcomed ? "globe" : "hidden");
  const [from, setFrom] = useState<Rect | null>(null);
  const [fromGlobe, setFromGlobe] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // A first visit: let the page paint, then bring the form in.
  useEffect(() => {
    if (welcomed) return;
    const t = setTimeout(() => setPhase("form"), 700);
    return () => clearTimeout(t);
  }, [welcomed]);

  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const save = useCallback(
    (values: Partial<Trip>) => {
      setTrip({ ...EMPTY_TRIP, ...values, planSet: true });
      markWelcomed();
    },
    [setTrip, markWelcomed],
  );

  const submit = (values: Partial<Trip>) => {
    save(values);
    const rect = cardRef.current?.getBoundingClientRect();
    if (reducedMotion || !rect) {
      setPhase("globe");
      return;
    }
    setFrom({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    setPhase("breaking");
  };

  const next = (done: Phase) => {
    if (done === "breaking") {
      // The last tile finishes flipping about 0.9s after the first starts.
      setTimeout(() => setPhase("rolling"), 950);
    } else if (done === "rolling") setPhase("dropping");
    else if (done === "dropping") setPhase("globe");
  };

  return (
    <>
      <style>{`@keyframes mnt-globe-spin { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
      <AnimatePresence>
        {phase === "form" && (
          <PlannerForm
            key="form"
            initial={trip}
            planSet={trip.planSet}
            cardRef={cardRef}
            fromGlobe={fromGlobe}
            onSubmit={submit}
            onEnquire={(values) => {
              save(values);
              setPhase("globe");
              navigate("/contact");
            }}
            onDismiss={() => {
              markWelcomed();
              setPhase("globe");
            }}
          />
        )}
      </AnimatePresence>

      {from && (phase === "breaking" || phase === "rolling" || phase === "dropping") && (
        <Transformation phase={phase} from={from} onDone={next} />
      )}

      <AnimatePresence>
        {phase === "globe" && (
          <RestingGlobe
            key="globe"
            trip={trip}
            onOpen={() => {
              setFromGlobe(true);
              setPhase("form");
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
