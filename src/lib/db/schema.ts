import { pgTable, uuid, text, date, timestamp, integer, serial } from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  anesthetistName: text("anesthetist_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cases = pgTable("cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .references(() => sessions.id, { onDelete: "cascade" })
    .notNull(),
  caseNumber: integer("case_number").notNull(),
  surgeryStart: timestamp("surgery_start").notNull(),
  surgeryEnd: timestamp("surgery_end"),
  surgeryDurationSec: integer("surgery_duration_sec"),
  turnoverStart: timestamp("turnover_start"),
  turnoverEnd: timestamp("turnover_end"),
  turnoverDurationSec: integer("turnover_duration_sec"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Case = typeof cases.$inferSelect;
export type NewCase = typeof cases.$inferInsert;
