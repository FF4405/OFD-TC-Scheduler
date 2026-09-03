import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

// A firefighter. Doubles as the auth identity (email + OTP sign-in) and
// the scheduling roster record (line number, roster status, rotation
// position) — there's no separate "member" table the way the pre-Cloudflare
// version of this app had, since every person who gets assigned a check is
// also, now, someone who can sign in and mark it done.
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  // The department's roster line number (e.g. "33"). Text, not integer —
  // a handful of members have never had one assigned. Nullable/non-unique:
  // several members share a blank line number in the historical roster.
  lineNumber: text("line_number"),
  rosterStatus: text("roster_status", {
    enum: ["active", "officer", "50yr", "inactive", "retired"],
  })
    .notNull()
    .default("active"),
  remarks: text("remarks"),
  // Eligible for the assignment rotation at all — distinct from isActive
  // (below), which gates *app sign-in* access. A retired member can still
  // sign in read-only without ever showing up in the rotation queue.
  rosterActive: integer("roster_active", { mode: "boolean" }).notNull().default(true),
  // Position in the round-robin assignment queue (lower = assigned sooner).
  // Null until first placed — see lib/schedule/rotation.ts.
  rotationPosition: integer("rotation_position"),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  // True for accounts seeded from the existing roster with no real sign-in
  // yet (see db/seed.sql). A matching real sign-in claims the row instead
  // of creating a duplicate — see lib/auth/session.ts.
  isPlaceholder: integer("is_placeholder", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// A requested login code for an email, valid for a short window. A new
// request invalidates any prior unconsumed code for that email (see
// lib/auth/otp.ts) so only the most recently sent code ever works.
export const otpCodes = sqliteTable("otp_codes", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  consumedAt: integer("consumed_at", { mode: "timestamp" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// A signed-in session, valid for 30 days from creation (no sliding
// renewal). id is the SHA-256 hash of the opaque token stored in the
// session cookie — the raw token is never persisted.
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// A logged-in-but-not-yet-approved user (isActive=false) asking to become
// an active member. Unlike the driver-training app there's only one kind
// of request here — no per-apparatus roles — so this is a plain queue,
// reviewed by any admin.
export const accessRequests = sqliteTable("access_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  status: text("status", { enum: ["pending", "approved", "denied"] })
    .notNull()
    .default("pending"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  reviewNote: text("review_note"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// One apparatus/equipment check slot in the schedule grid (e.g. "Tower 21
// — Apparatus & Equipment"). oicName and rotationNote are purely
// descriptive labels shown in the grid; rotationLabels (a JSON string
// array, e.g. '["Officer","Driver"]') labels each week of a period
// cyclically when a slot alternates duty week to week.
export const assignmentSlots = sqliteTable("assignment_slots", {
  id: text("id").primaryKey(),
  apparatusName: text("apparatus_name").notNull(),
  slotType: text("slot_type").notNull(),
  rotationNote: text("rotation_note"),
  rotationLabels: text("rotation_labels"),
  oicName: text("oic_name"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// A scheduling period — normally the ~4-5 weeks between one 2nd-Monday
// and the next (see lib/dates.ts). Exactly one period is is_current at a
// time; that's the one the schedule grid shows by default.
export const periods = sqliteTable("periods", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(), // ISO date (YYYY-MM-DD)
  weekCount: integer("week_count").notNull().default(4),
  isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Who's assigned to a given slot for a given period. isRepeat marks an
// assignment carried over from the previous period because that member's
// attendance fell below the settings.repeat_miss threshold (see
// lib/schedule/rotation.ts) — shown in the UI as a flag, not acted on
// further.
export const periodAssignments = sqliteTable(
  "period_assignments",
  {
    id: text("id").primaryKey(),
    periodId: text("period_id")
      .notNull()
      .references(() => periods.id, { onDelete: "cascade" }),
    slotId: text("slot_id")
      .notNull()
      .references(() => assignmentSlots.id, { onDelete: "cascade" }),
    memberId: text("member_id").references(() => users.id, { onDelete: "set null" }),
    isRepeat: integer("is_repeat", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [unique().on(table.periodId, table.slotId)],
);

// One week's completed check for an assignment. Presence of a row *is*
// "done" — there's no separate boolean, so undoing a check is just
// deleting its row (see mark-complete server action).
export const weeklyCompletions = sqliteTable(
  "weekly_completions",
  {
    id: text("id").primaryKey(),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => periodAssignments.id, { onDelete: "cascade" }),
    weekDate: text("week_date").notNull(), // ISO date of that week's Monday
    completedAt: integer("completed_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    completedBy: text("completed_by"),
    notes: text("notes"),
  },
  (table) => [unique().on(table.assignmentId, table.weekDate)],
);

// A record of every reminder email attempt (manual or cron-triggered),
// success or failure — shown on a member's profile so "did they actually
// get emailed" is answerable without digging through Mailgun.
export const notificationLog = sqliteTable("notification_log", {
  id: text("id").primaryKey(),
  memberId: text("member_id").references(() => users.id, { onDelete: "set null" }),
  assignmentId: text("assignment_id").references(() => periodAssignments.id, {
    onDelete: "set null",
  }),
  weekDate: text("week_date").notNull(),
  method: text("method").notNull().default("email"),
  recipient: text("recipient").notNull(),
  status: text("status", { enum: ["sent", "failed"] }).notNull(),
  errorMessage: text("error_message"),
  triggeredBy: text("triggered_by", { enum: ["manual", "cron"] })
    .notNull()
    .default("manual"),
  sentAt: integer("sent_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Free-form app configuration (notify day/hour, auto-schedule horizon,
// repeat-on-bad-attendance threshold) — see lib/settings.ts for the typed
// keys and defaults.
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  assignments: many(periodAssignments),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const periodsRelations = relations(periods, ({ many }) => ({
  assignments: many(periodAssignments),
}));

export const assignmentSlotsRelations = relations(assignmentSlots, ({ many }) => ({
  assignments: many(periodAssignments),
}));

export const periodAssignmentsRelations = relations(periodAssignments, ({ one, many }) => ({
  period: one(periods, { fields: [periodAssignments.periodId], references: [periods.id] }),
  slot: one(assignmentSlots, {
    fields: [periodAssignments.slotId],
    references: [assignmentSlots.id],
  }),
  member: one(users, { fields: [periodAssignments.memberId], references: [users.id] }),
  completions: many(weeklyCompletions),
}));

export const weeklyCompletionsRelations = relations(weeklyCompletions, ({ one }) => ({
  assignment: one(periodAssignments, {
    fields: [weeklyCompletions.assignmentId],
    references: [periodAssignments.id],
  }),
}));
