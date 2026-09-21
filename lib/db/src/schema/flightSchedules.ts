import {
  pgTable,
  text,
  smallint,
  date,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

/**
 * FLIGHT SCHEDULES — the published timetable, one row per regular flight.
 *
 * route_legs says "Emirates flies Lahore to Dubai about three times a day".
 * This says which three: EK 623 at 04:25, EK 625 at 10:10, EK 627 at 21:55,
 * and on which days of the week. It is filled by scripts/refresh-schedules.mjs
 * from AeroDataBox's airport departures board, sampled over one week and
 * folded into a weekly pattern, so a flight that runs every day is one row
 * marked "1234567" rather than seven rows.
 *
 * Times are LOCAL to each airport, as printed on a boarding pass. A 22:40
 * departure from Lahore that lands at 00:55 in Dubai is stored with an
 * arrival offset of +1, because that is how an airline timetable writes it
 * and how a client reads it.
 *
 * Nothing here is a fare. A schedule changes a few times a year; a fare
 * changes by the hour and needs a booking system this project does not have.
 */
export const flightSchedulesTable = pgTable(
  "flight_schedules",
  {
    fromIata: text("from_iata").notNull(),
    toIata: text("to_iata").notNull(),
    /** As the airline prints it, e.g. "EK 623". */
    flightNumber: text("flight_number").notNull(),
    airlineName: text("airline_name").notNull(),
    airlineIata: text("airline_iata"),
    /** "HH:MM", local time at the departure airport. */
    depTime: text("dep_time").notNull(),
    /** "HH:MM", local time at the arrival airport. Null when not published. */
    arrTime: text("arr_time"),
    /** Days between departure date and arrival date, local to each: 0, 1, rarely 2. */
    arrDayOffset: smallint("arr_day_offset").notNull().default(0),
    /** ISO weekdays it was seen operating, Monday = 1: "1234567" is daily. */
    days: text("days").notNull(),
    /** The sampled week. A timetable is only ever true for a period. */
    observedFrom: date("observed_from"),
    observedTo: date("observed_to"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /*
     * Flight number AND time, because the same number can leave at two times
     * in one week — a schedule change mid-sample, or a day with a different
     * slot. Merging those would print a departure time that is wrong on some
     * of the days listed beside it.
     */
    primaryKey({ columns: [t.fromIata, t.flightNumber, t.depTime] }),
    index("flight_schedules_to_idx").on(t.toIata),
    index("flight_schedules_airline_idx").on(t.airlineIata),
  ],
);

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM");

export const flightScheduleRowSchema = z.object({
  toIata: z.string().regex(/^[A-Z]{3}$/),
  flightNumber: z.string().min(2).max(12),
  airlineName: z.string().min(1).max(200),
  airlineIata: z.string().regex(/^[A-Z0-9]{2}$/).nullish(),
  depTime: hhmm,
  arrTime: hhmm.nullish(),
  arrDayOffset: z.number().int().min(-1).max(2).default(0),
  days: z.string().regex(/^1?2?3?4?5?6?7?$/).min(1),
});

/**
 * Every regular departure from one airport for the sampled week.
 *
 * Whole-airport replacement, like route_legs: a flight the airline has
 * dropped must disappear on the next refresh, which an upsert never does.
 * Sized for a hub the size of Dubai, which runs several hundred distinct
 * flights a week.
 */
export const flightSchedulesBodySchema = z.object({
  observedFrom: z.iso.date(),
  observedTo: z.iso.date(),
  rows: z.array(flightScheduleRowSchema).max(5000),
});

export type FlightSchedule = typeof flightSchedulesTable.$inferSelect;
