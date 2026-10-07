import { pgTable, serial, text, timestamp, integer, real, unique } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial().primaryKey(),
  phone: text().unique(),
  name: text(),
  monthlyPlanned: integer("monthly_planned").default(20),
  professionalPoints: integer("professional_points").default(0),
  notificationsEnabled: integer("notifications_enabled").default(1),
  tradingStartHour: integer("trading_start_hour").default(9),
  tradingEndHour: integer("trading_end_hour").default(17),
  timezone: text().default("UTC"),
});

export const trades = pgTable("trades", {
  id: serial().primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  pair: text().notNull().default("BTCUSDT"),
  marketType: text("market_type").notNull().default("Crypto"),
  strategy: text().default("Standard"),
  type: text().notNull(),
  entryPrice: real("entry_price").notNull(),
  stopLoss: real("stop_loss").notNull(),
  target: real().notNull(),
  riskPercent: real("risk_percent").notNull(),
  session: text().notNull(),
  pnl: real().default(0),
  status: text().default("OPEN"),
  setupFollowed: text("setup_followed"),
  entryReason: text("entry_reason"),
  emotionalInterference: text("emotional_interference"),
  executionMistake: text("execution_mistake"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reflections = pgTable("reflections", {
  id: serial().primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text().notNull(),
  followedRules: text("followed_rules"),
  entryReason: text("entry_reason"),
  emotionsAffected: text("emotions_affected"),
  improvement: text(),
  lesson: text(),
  mistake: text(),
  doneWell: text("done_well"),
  focusTomorrow: text("focus_tomorrow"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [unique().on(t.userId, t.date)]);

export const dailyPlans = pgTable("daily_plans", {
  id: serial().primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text().notNull(),
  plannedCount: integer("planned_count").default(0),
}, (t) => [unique().on(t.userId, t.date)]);

export const violations = pgTable("violations", {
  id: serial().primaryKey(),
  tradeId: integer("trade_id").notNull().unique().references(() => trades.id, { onDelete: "cascade" }),
  brokeSl: integer("broke_sl").default(0),
  overtraded: integer().default(0),
  revengeTrade: integer("revenge_trade").default(0),
  noValidSetup: integer("no_valid_setup").default(0),
  emotionalEntry: integer("emotional_entry").default(0),
});

export const scores = pgTable("scores", {
  id: serial().primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text().notNull(),
  score: integer().notNull(),
  feedback: text(),
  notes: text(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [unique().on(t.userId, t.date)]);

export const notifications = pgTable("notifications", {
  id: serial().primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text().notNull(),
  message: text().notNull(),
  date: text().notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
  isRead: integer("is_read").default(0),
}, (t) => [unique().on(t.userId, t.type, t.date)]);
