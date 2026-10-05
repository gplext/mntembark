/**
 * One box for both dates: the first click is the arrival, the second the
 * departure. Past days cannot be picked.
 */

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/mnt-embark/components/ui/popover";
import { Calendar } from "@workspace/mnt-embark/components/ui/calendar";
import { cn } from "@workspace/mnt-embark/lib/utils";
import { CalendarDays, X } from "lucide-react";

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromIso = (s: string | null) => (s ? new Date(`${s}T00:00:00`) : undefined);
const short = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function DateRangeField({
  start,
  end,
  onChange,
  triggerClassName,
}: {
  start: string | null;
  end: string | null;
  onChange: (start: string | null, end: string | null) => void;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const range: DateRange | undefined = start ? { from: fromIso(start), to: fromIso(end) } : undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoMonths = typeof window !== "undefined" && window.innerWidth >= 700;

  const text =
    range?.from && range.to
      ? `${short(range.from)} – ${short(range.to)}`
      : range?.from
        ? `${short(range.from)} – ?`
        : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("w-full text-left flex items-center gap-2", triggerClassName)} data-testid="planner-dates">
          <CalendarDays className="h-3.5 w-3.5 text-[#A8823E] shrink-0" />
          <span className={cn("flex-1 truncate text-[13px]", text ? "text-[#16130F]" : "text-[#8B8173]")}>
            {text ?? "Arrival – departure"}
          </span>
          {text && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear dates"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null, null);
              }}
              className="text-[#8B8173] hover:text-[#16130F]"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0 border-[#E6DCC8] bg-[#FDFBF7] z-[70]">
        <Calendar
          mode="range"
          numberOfMonths={twoMonths ? 2 : 1}
          selected={range}
          defaultMonth={range?.from ?? today}
          disabled={{ before: today }}
          onSelect={(r) => {
            onChange(r?.from ? toIso(r.from) : null, r?.to ? toIso(r.to) : null);
            if (r?.from && r.to && r.from.getTime() !== r.to.getTime()) setOpen(false);
          }}
          className="bg-transparent"
        />
        <p className="px-4 pb-3 text-[11px] text-[#8B8173]">Pick your arrival, then your departure.</p>
      </PopoverContent>
    </Popover>
  );
}
