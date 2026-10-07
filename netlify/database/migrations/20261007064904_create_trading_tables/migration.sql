CREATE TABLE "daily_plans" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"planned_count" integer DEFAULT 0,
	CONSTRAINT "daily_plans_user_id_date_unique" UNIQUE("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"date" text NOT NULL,
	"sent_at" timestamp DEFAULT now(),
	"is_read" integer DEFAULT 0,
	CONSTRAINT "notifications_user_id_type_date_unique" UNIQUE("user_id","type","date")
);
--> statement-breakpoint
CREATE TABLE "reflections" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"followed_rules" text,
	"entry_reason" text,
	"emotions_affected" text,
	"improvement" text,
	"lesson" text,
	"mistake" text,
	"done_well" text,
	"focus_tomorrow" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "reflections_user_id_date_unique" UNIQUE("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"score" integer NOT NULL,
	"feedback" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "scores_user_id_date_unique" UNIQUE("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL,
	"pair" text DEFAULT 'BTCUSDT' NOT NULL,
	"market_type" text DEFAULT 'Crypto' NOT NULL,
	"strategy" text DEFAULT 'Standard',
	"type" text NOT NULL,
	"entry_price" real NOT NULL,
	"stop_loss" real NOT NULL,
	"target" real NOT NULL,
	"risk_percent" real NOT NULL,
	"session" text NOT NULL,
	"pnl" real DEFAULT 0,
	"status" text DEFAULT 'OPEN',
	"setup_followed" text,
	"entry_reason" text,
	"emotional_interference" text,
	"execution_mistake" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY,
	"phone" text UNIQUE,
	"name" text,
	"monthly_planned" integer DEFAULT 20,
	"professional_points" integer DEFAULT 0,
	"notifications_enabled" integer DEFAULT 1,
	"trading_start_hour" integer DEFAULT 9,
	"trading_end_hour" integer DEFAULT 17,
	"timezone" text DEFAULT 'UTC'
);
--> statement-breakpoint
CREATE TABLE "violations" (
	"id" serial PRIMARY KEY,
	"trade_id" integer NOT NULL UNIQUE,
	"broke_sl" integer DEFAULT 0,
	"overtraded" integer DEFAULT 0,
	"revenge_trade" integer DEFAULT 0,
	"no_valid_setup" integer DEFAULT 0,
	"emotional_entry" integer DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "violations" ADD CONSTRAINT "violations_trade_id_trades_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE CASCADE;