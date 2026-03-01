import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const db = new Database("trading.db");
db.exec("PRAGMA foreign_keys = ON;");

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Database
  try {
    console.log("Initializing database tables...");
    
    // Check for old schema before creating tables
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get() as any;
    if (tableCheck) {
      const tableInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
      const hasEmail = tableInfo.some(col => col.name === 'email');
      if (hasEmail) {
        console.log("Old schema (email) detected. Resetting all tables for clean phone-based auth.");
        // Must drop in order due to foreign keys
        db.exec("DROP TABLE IF EXISTS scores;");
        db.exec("DROP TABLE IF EXISTS violations;");
        db.exec("DROP TABLE IF EXISTS trades;");
        db.exec("DROP TABLE IF EXISTS users;");
      }
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT UNIQUE,
        name TEXT,
        monthly_planned INTEGER DEFAULT 20,
        professional_points INTEGER DEFAULT 0,
        notifications_enabled INTEGER DEFAULT 1,
        trading_start_hour INTEGER DEFAULT 9,
        trading_end_hour INTEGER DEFAULT 17,
        timezone TEXT DEFAULT 'UTC'
      );

      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        pair TEXT NOT NULL DEFAULT 'BTCUSDT',
        market_type TEXT NOT NULL DEFAULT 'Crypto',
        strategy TEXT DEFAULT 'Standard',
        type TEXT NOT NULL,
        entry_price REAL NOT NULL,
        stop_loss REAL NOT NULL,
        target REAL NOT NULL,
        risk_percent REAL NOT NULL,
        session TEXT NOT NULL,
        pnl REAL DEFAULT 0,
        status TEXT DEFAULT 'OPEN',
        setup_followed TEXT,
        entry_reason TEXT,
        emotional_interference TEXT,
        execution_mistake TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS reflections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        followed_rules TEXT,
        entry_reason TEXT,
        emotions_affected TEXT,
        improvement TEXT,
        lesson TEXT,
        mistake TEXT,
        done_well TEXT,
        focus_tomorrow TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS daily_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        planned_count INTEGER DEFAULT 0,
        UNIQUE(user_id, date),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS violations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trade_id INTEGER NOT NULL UNIQUE,
        broke_sl INTEGER DEFAULT 0,
        overtraded INTEGER DEFAULT 0,
        revenge_trade INTEGER DEFAULT 0,
        no_valid_setup INTEGER DEFAULT 0,
        emotional_entry INTEGER DEFAULT 0,
        FOREIGN KEY(trade_id) REFERENCES trades(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        score INTEGER NOT NULL,
        feedback TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        date TEXT NOT NULL,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_read INTEGER DEFAULT 0,
        UNIQUE(user_id, type, date),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log("Database tables initialized successfully.");

    // Robust Migration: check if professional_points column exists in users
    const userInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
    if (!userInfo.some(col => col.name === 'professional_points')) {
      db.exec("ALTER TABLE users ADD COLUMN professional_points INTEGER DEFAULT 0;");
    }
    if (!userInfo.some(col => col.name === 'notifications_enabled')) {
      db.exec("ALTER TABLE users ADD COLUMN notifications_enabled INTEGER DEFAULT 1;");
    }
    if (!userInfo.some(col => col.name === 'trading_start_hour')) {
      db.exec("ALTER TABLE users ADD COLUMN trading_start_hour INTEGER DEFAULT 9;");
    }
    if (!userInfo.some(col => col.name === 'trading_end_hour')) {
      db.exec("ALTER TABLE users ADD COLUMN trading_end_hour INTEGER DEFAULT 17;");
    }
    if (!userInfo.some(col => col.name === 'timezone')) {
      db.exec("ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'UTC';");
    }

    // Check if date column exists in scores
    const scoreInfo = db.prepare("PRAGMA table_info(scores)").all() as any[];
    if (!scoreInfo.some(col => col.name === 'date')) {
      db.exec("ALTER TABLE scores ADD COLUMN date TEXT;");
      db.exec("UPDATE scores SET date = date(created_at);");
    }
    // Ensure unique index for violations trade_id
    db.exec("DELETE FROM violations WHERE id NOT IN (SELECT MIN(id) FROM violations GROUP BY trade_id);");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_violations_trade_id ON violations(trade_id);");
    // Ensure unique index exists for ON CONFLICT
    db.exec("DELETE FROM scores WHERE id NOT IN (SELECT MAX(id) FROM scores GROUP BY user_id, date);");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_scores_user_date ON scores(user_id, date);");

    // Check if pnl exists in trades
    const tradeInfo = db.prepare("PRAGMA table_info(trades)").all() as any[];
    if (!tradeInfo.some(col => col.name === 'pnl')) {
      db.exec("ALTER TABLE trades ADD COLUMN pnl REAL DEFAULT 0;");
    }
    if (!tradeInfo.some(col => col.name === 'pair')) {
      db.exec("ALTER TABLE trades ADD COLUMN pair TEXT NOT NULL DEFAULT 'BTCUSDT';");
    }
    if (!tradeInfo.some(col => col.name === 'market_type')) {
      db.exec("ALTER TABLE trades ADD COLUMN market_type TEXT NOT NULL DEFAULT 'Crypto';");
    }
    if (!tradeInfo.some(col => col.name === 'strategy')) {
      db.exec("ALTER TABLE trades ADD COLUMN strategy TEXT DEFAULT 'Standard';");
    }
    if (!tradeInfo.some(col => col.name === 'setup_followed')) {
      db.exec("ALTER TABLE trades ADD COLUMN setup_followed TEXT;");
    }
    if (!tradeInfo.some(col => col.name === 'entry_reason')) {
      db.exec("ALTER TABLE trades ADD COLUMN entry_reason TEXT;");
    }
    if (!tradeInfo.some(col => col.name === 'emotional_interference')) {
      db.exec("ALTER TABLE trades ADD COLUMN emotional_interference TEXT;");
    }
    if (!tradeInfo.some(col => col.name === 'execution_mistake')) {
      db.exec("ALTER TABLE trades ADD COLUMN execution_mistake TEXT;");
    }

    // Robust Migration: check if notes column exists in scores
    const hasNotes = scoreInfo.some(col => col.name === 'notes');
    if (!hasNotes) {
      console.log("Adding notes column to scores table");
      db.exec("ALTER TABLE scores ADD COLUMN notes TEXT;");
    }

    // Reflections migration
    const reflectionInfo = db.prepare("PRAGMA table_info(reflections)").all() as any[];
    if (!reflectionInfo.some(col => col.name === 'mistake')) {
      db.exec("ALTER TABLE reflections ADD COLUMN mistake TEXT;");
    }
    if (!reflectionInfo.some(col => col.name === 'done_well')) {
      db.exec("ALTER TABLE reflections ADD COLUMN done_well TEXT;");
    }
    if (!reflectionInfo.some(col => col.name === 'focus_tomorrow')) {
      db.exec("ALTER TABLE reflections ADD COLUMN focus_tomorrow TEXT;");
    }
  } catch (dbError) {
    console.error("CRITICAL: Database initialization failed:", dbError);
  }

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API Routes
  app.post("/api/auth/login", (req, res) => {
    try {
      const { phone, name } = req.body;
      console.log("Login attempt for phone:", phone);
      if (!phone) return res.status(400).json({ error: "Phone number required" });

      let user = db.prepare("SELECT * FROM users WHERE phone = ?").get(phone) as any;
      if (!user) {
        console.log("Creating new user for phone:", phone);
        const info = db.prepare("INSERT INTO users (phone, name) VALUES (?, ?)").run(phone, name || "Trader");
        user = { id: Number(info.lastInsertRowid), phone, name: name || "Trader", monthly_planned: 20 };
      } else {
        console.log("Found existing user:", user);
        user.id = Number(user.id);
      }
      res.json({ user });
    } catch (error) {
      console.error("Login error details:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/user/update", (req, res) => {
    try {
      const { user_id, name, monthly_planned, notifications_enabled, trading_start_hour, trading_end_hour } = req.body;
      db.prepare(`
        UPDATE users 
        SET name = ?, monthly_planned = ?, notifications_enabled = ?, trading_start_hour = ?, trading_end_hour = ?
        WHERE id = ?
      `).run(name, monthly_planned, notifications_enabled, trading_start_hour, trading_end_hour, user_id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.get("/api/notifications/check/:user_id", (req, res) => {
    try {
      const userId = req.params.user_id;
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
      if (!user || !user.notifications_enabled) {
        return res.json({ notifications: [] });
      }

      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const currentHour = now.getHours();

      const notifications = [];

      // 1. No trade logged today (check after trading hours)
      if (currentHour >= user.trading_end_hour) {
        const todayTrade = db.prepare("SELECT id FROM trades WHERE user_id = ? AND date(created_at) = ?").get(userId, today);
        if (!todayTrade) {
          const alreadySent = db.prepare("SELECT id FROM notifications WHERE user_id = ? AND type = 'no_trade' AND date = ?").get(userId, today);
          if (!alreadySent) {
            notifications.push({ type: 'no_trade', message: "You haven’t logged a trade today. Consistency is slipping." });
            db.prepare("INSERT INTO notifications (user_id, type, date) VALUES (?, ?, ?)").run(userId, 'no_trade', today);
          }
        }
      }

      // 2. Discipline score dropped
      const scores = db.prepare("SELECT score, date FROM scores WHERE user_id = ? ORDER BY date DESC LIMIT 2").all(userId) as any[];
      if (scores.length === 2 && scores[0].date === today) {
        if (scores[0].score < scores[1].score) {
          const alreadySent = db.prepare("SELECT id FROM notifications WHERE user_id = ? AND type = 'score_drop' AND date = ?").get(userId, today);
          if (!alreadySent) {
            notifications.push({ type: 'score_drop', message: "Your discipline declined today. Review what broke." });
            db.prepare("INSERT INTO notifications (user_id, type, date) VALUES (?, ?, ?)").run(userId, 'score_drop', today);
          }
        }
      }

      // 3. Streak at risk (No trade today, and had a streak yesterday)
      // This is similar to no_trade but more urgent if they have a streak
      // Let's say if it's 2 hours before trading ends and no trade logged
      if (currentHour >= user.trading_end_hour - 2 && currentHour < user.trading_end_hour) {
        const todayTrade = db.prepare("SELECT id FROM trades WHERE user_id = ? AND date(created_at) = ?").get(userId, today);
        if (!todayTrade) {
          // Check if they have a streak
          const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
          const yesterdayScore = db.prepare("SELECT score FROM scores WHERE user_id = ? AND date = ?").get(userId, yesterday) as any;
          if (yesterdayScore && yesterdayScore.score >= 75) {
            const alreadySent = db.prepare("SELECT id FROM notifications WHERE user_id = ? AND type = 'streak_risk' AND date = ?").get(userId, today);
            if (!alreadySent) {
              notifications.push({ type: 'streak_risk', message: "You’re about to lose your discipline streak." });
              db.prepare("INSERT INTO notifications (user_id, type, date) VALUES (?, ?, ?)").run(userId, 'streak_risk', today);
            }
          }
        }
      }

      // 4. Progress plateau
      const last14Scores = db.prepare("SELECT score FROM scores WHERE user_id = ? ORDER BY date DESC LIMIT 14").all(userId) as any[];
      if (last14Scores.length === 14) {
        const recent7 = last14Scores.slice(0, 7).reduce((acc, s) => acc + s.score, 0) / 7;
        const previous7 = last14Scores.slice(7, 14).reduce((acc, s) => acc + s.score, 0) / 7;
        if (Math.abs(recent7 - previous7) < 2 && recent7 < 85) {
          const alreadySent = db.prepare("SELECT id FROM notifications WHERE user_id = ? AND type = 'plateau' AND date = ?").get(userId, today);
          if (!alreadySent) {
            notifications.push({ type: 'plateau', message: "Your discipline is stable but not improving. Time to focus." });
            db.prepare("INSERT INTO notifications (user_id, type, date) VALUES (?, ?, ?)").run(userId, 'plateau', today);
          }
        }
      }

      res.json({ notifications });
    } catch (error) {
      console.error("Error checking notifications:", error);
      res.status(500).json({ error: "Failed to check notifications" });
    }
  });

  app.post("/api/daily-plan", (req, res) => {
    try {
      const { user_id, date, planned_count } = req.body;
      db.prepare(`
        INSERT INTO daily_plans (user_id, date, planned_count)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, date) DO UPDATE SET planned_count = excluded.planned_count
      `).run(user_id, date, planned_count);
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving daily plan:", error);
      res.status(500).json({ error: "Failed to save daily plan" });
    }
  });

  app.get("/api/daily-plan/:user_id/:date", (req, res) => {
    try {
      const plan = db.prepare("SELECT * FROM daily_plans WHERE user_id = ? AND date = ?").get(req.params.user_id, req.params.date);
      res.json({ plan: plan || { planned_count: 0 } });
    } catch (error) {
      console.error("Error fetching daily plan:", error);
      res.status(500).json({ error: "Failed to fetch daily plan" });
    }
  });

  app.post("/api/trades", (req, res) => {
    try {
      const { user_id, pair, market_type, strategy, type, entry_price, stop_loss, target, risk_percent, session } = req.body;
      
      // Verify user exists to prevent FK violations from stale sessions
      const user = db.prepare("SELECT id FROM users WHERE id = ?").get(user_id);
      if (!user) {
        return res.status(401).json({ error: "Invalid session. Please log in again." });
      }

      const info = db.prepare(`
        INSERT INTO trades (user_id, pair, market_type, strategy, type, entry_price, stop_loss, target, risk_percent, session)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(user_id, pair || 'BTCUSDT', market_type || 'Crypto', strategy || 'Standard', type, entry_price, stop_loss, target, risk_percent, session);
      
      const tradeId = Number(info.lastInsertRowid);
      
      // Initialize empty violations for this trade
      db.prepare(`
        INSERT INTO violations (trade_id, broke_sl, overtraded, revenge_trade, no_valid_setup, emotional_entry)
        VALUES (?, 0, 0, 0, 0, 0)
      `).run(tradeId);

      res.json({ id: tradeId });
    } catch (error: any) {
      console.error("Error creating trade:", error);
      if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        return res.status(401).json({ error: "Session expired. Please log in again." });
      }
      res.status(500).json({ error: "Failed to create trade" });
    }
  });

  app.get("/api/trades/active/:user_id", (req, res) => {
    try {
      const trades = db.prepare(`
        SELECT t.*, v.broke_sl, v.overtraded, v.revenge_trade, v.no_valid_setup, v.emotional_entry
        FROM trades t
        LEFT JOIN violations v ON t.id = v.trade_id
        WHERE t.user_id = ? AND t.status = 'OPEN' 
        ORDER BY t.created_at DESC
      `).all(req.params.user_id) as any[];
      
      const formatted = trades.map(t => ({
        ...t,
        id: Number(t.id),
        user_id: Number(t.user_id)
      }));
      res.json({ trades: formatted });
    } catch (error) {
      console.error("Error fetching active trades:", error);
      res.status(500).json({ error: "Failed to fetch active trades" });
    }
  });

  app.post("/api/trades/update-violations", (req, res) => {
    try {
      const { trade_id, violations: v } = req.body;
      db.prepare(`
        INSERT INTO violations (trade_id, broke_sl, overtraded, revenge_trade, no_valid_setup, emotional_entry)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(trade_id) DO UPDATE SET 
          broke_sl = excluded.broke_sl,
          overtraded = excluded.overtraded,
          revenge_trade = excluded.revenge_trade,
          no_valid_setup = excluded.no_valid_setup,
          emotional_entry = excluded.emotional_entry
      `).run(trade_id, v.broke_sl ? 1 : 0, v.overtraded ? 1 : 0, v.revenge_trade ? 1 : 0, v.no_valid_setup ? 1 : 0, v.emotional_entry ? 1 : 0);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating violations:", error);
      res.status(500).json({ error: "Failed to update violations" });
    }
  });

  app.post("/api/trades/close", (req, res) => {
    try {
      const { trade_id, pnl, violations: v, journal } = req.body;
      
      const trade = db.prepare("SELECT * FROM trades WHERE id = ?").get(trade_id) as any;
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }

      db.prepare(`
        UPDATE trades 
        SET status = 'CLOSED', pnl = ?, 
            setup_followed = ?, entry_reason = ?, emotional_interference = ?, execution_mistake = ?
        WHERE id = ?
      `).run(
        pnl || 0, 
        journal?.setup_followed, 
        journal?.entry_reason, 
        journal?.emotional_interference, 
        journal?.execution_mistake, 
        trade_id
      );
      
      db.prepare(`
        INSERT INTO violations (trade_id, broke_sl, overtraded, revenge_trade, no_valid_setup, emotional_entry)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(trade_id) DO UPDATE SET 
          broke_sl = excluded.broke_sl,
          overtraded = excluded.overtraded,
          revenge_trade = excluded.revenge_trade,
          no_valid_setup = excluded.no_valid_setup,
          emotional_entry = excluded.emotional_entry
      `).run(trade_id, v.broke_sl ? 1 : 0, v.overtraded ? 1 : 0, v.revenge_trade ? 1 : 0, v.no_valid_setup ? 1 : 0, v.emotional_entry ? 1 : 0);

      // Recalculate Daily Score
      const today = new Date().toISOString().split('T')[0];
      const todayTrades = db.prepare(`
        SELECT t.id, v.broke_sl, v.overtraded, v.revenge_trade, v.no_valid_setup, v.emotional_entry
        FROM trades t
        JOIN violations v ON t.id = v.trade_id
        WHERE t.user_id = ? AND date(t.created_at) = ? AND t.status = 'CLOSED'
      `).all(trade.user_id, today) as any[];

      const plan = db.prepare("SELECT planned_count FROM daily_plans WHERE user_id = ? AND date = ?").get(trade.user_id, today) as any;
      const planned = plan ? plan.planned_count : 0;

      let dailyScore = 100;
      let feedback = [];

      // Violation counts for weighting
      let counts = {
        broke_sl: 0,
        overtraded: 0,
        revenge_trade: 0,
        no_valid_setup: 0,
        emotional_entry: 0
      };

      for (const t of todayTrades) {
        if (t.broke_sl) {
          counts.broke_sl++;
          dailyScore -= (20 + (counts.broke_sl * 10)); // 30, 40, 50...
        }
        if (t.overtraded) {
          counts.overtraded++;
          dailyScore -= (10 + (counts.overtraded * 10)); // 20, 30, 40...
        }
        if (t.revenge_trade) {
          counts.revenge_trade++;
          dailyScore -= (15 + (counts.revenge_trade * 10)); // 25, 35, 45...
        }
        if (t.no_valid_setup) {
          counts.no_valid_setup++;
          dailyScore -= (15 + (counts.no_valid_setup * 10)); // 25, 35, 45...
        }
        if (t.emotional_entry) {
          counts.emotional_entry++;
          dailyScore -= (5 + (counts.emotional_entry * 10)); // 15, 25, 35...
        }
      }

      // Overtrading penalty (based on count vs plan)
      if (planned > 0 && todayTrades.length > planned) {
        const excess = todayTrades.length - planned;
        dailyScore -= (excess * 15);
        feedback.push(`Overtrading detected (${excess} extra).`);
      }

      dailyScore = Math.max(0, dailyScore);

      if (dailyScore === 100) feedback.push("Rules respected. Professional behavior.");
      else if (dailyScore >= 75) feedback.push("Minor mistakes. Control improving.");
      else if (dailyScore >= 60) feedback.push("Discipline unstable.");
      else feedback.push("Rules ignored. Emotional trading.");

      db.prepare(`
        INSERT INTO scores (user_id, date, score, feedback)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, date) DO UPDATE SET score = excluded.score, feedback = excluded.feedback
      `).run(trade.user_id, today, dailyScore, feedback.join(" "));

      // Update Professional Points (PP)
      // Earn PP: Daily discipline >= 75 -> +1 PP
      // Lose PP: Daily discipline < 60 -> -2 PP
      // Note: We only update PP once per day based on the final score. 
      // But since we recalculate every trade, we should be careful.
      // Let's just apply the delta if the score crosses a threshold? 
      // No, the prompt says "Earn PP when: Daily discipline >= 75 -> +1 PP". 
      // This usually implies a daily award.
      
      res.json({ score: dailyScore, feedback: feedback.join(" ") });
    } catch (error) {
      console.error("Error closing trade:", error);
      res.status(500).json({ error: "Failed to close trade" });
    }
  });

  app.get("/api/scores/:user_id", (req, res) => {
    try {
      const scores = db.prepare("SELECT * FROM scores WHERE user_id = ? ORDER BY created_at DESC LIMIT 10").all(req.params.user_id) as any[];
      const formattedScores = scores.map(s => ({
        ...s,
        id: Number(s.id),
        user_id: Number(s.user_id)
      }));
      res.json({ scores: formattedScores });
    } catch (error) {
      console.error("Error fetching scores:", error);
      res.status(500).json({ error: "Failed to fetch scores" });
    }
  });

  app.get("/api/trades/history/:user_id", (req, res) => {
    try {
      const trades = db.prepare(`
        SELECT t.*, v.broke_sl, v.overtraded, v.revenge_trade, v.no_valid_setup, v.emotional_entry
        FROM trades t
        LEFT JOIN violations v ON t.id = v.trade_id
        WHERE t.user_id = ?
        ORDER BY t.created_at DESC
      `).all(req.params.user_id) as any[];
      
      const formatted = trades.map(t => ({
        ...t,
        id: Number(t.id),
        user_id: Number(t.user_id)
      }));
      res.json({ trades: formatted });
    } catch (error) {
      console.error("Error fetching history:", error);
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  app.get("/api/notifications/:user_id", (req, res) => {
    try {
      const notifications = db.prepare(`
        SELECT * FROM notifications 
        WHERE user_id = ? 
        ORDER BY sent_at DESC LIMIT 20
      `).all(req.params.user_id) as any[];
      res.json({ notifications });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications/read", (req, res) => {
    try {
      const { notification_ids } = req.body;
      const placeholders = notification_ids.map(() => '?').join(',');
      db.prepare(`UPDATE notifications SET is_read = 1 WHERE id IN (${placeholders})`).run(...notification_ids);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      res.status(500).json({ error: "Failed to mark notifications as read" });
    }
  });

  app.post("/api/users/settings", (req, res) => {
    try {
      const { user_id, notifications_enabled, trading_start_hour, trading_end_hour, timezone } = req.body;
      db.prepare(`
        UPDATE users 
        SET notifications_enabled = ?, trading_start_hour = ?, trading_end_hour = ?, timezone = ?
        WHERE id = ?
      `).run(notifications_enabled ? 1 : 0, trading_start_hour, trading_end_hour, timezone, user_id);
      
      const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(user_id);
      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  app.post("/api/reflections", (req, res) => {
    try {
      const { user_id, date, mistake, done_well, focus_tomorrow } = req.body;
      db.prepare(`
        INSERT INTO reflections (user_id, date, mistake, done_well, focus_tomorrow)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, date) DO UPDATE SET 
          mistake = excluded.mistake,
          done_well = excluded.done_well,
          focus_tomorrow = excluded.focus_tomorrow
      `).run(user_id, date, mistake, done_well, focus_tomorrow);

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving reflection:", error);
      res.status(500).json({ error: "Failed to save reflection" });
    }
  });

  app.get("/api/reflections/:user_id/:date", (req, res) => {
    try {
      const reflection = db.prepare("SELECT * FROM reflections WHERE user_id = ? AND date = ?").get(req.params.user_id, req.params.date);
      res.json({ reflection: reflection || null });
    } catch (error) {
      console.error("Error fetching reflection:", error);
      res.status(500).json({ error: "Failed to fetch reflection" });
    }
  });

  app.get("/api/stats/:user_id", (req, res) => {
    try {
      const userId = req.params.user_id;
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Weekly Summary (Last 7 days)
      const weeklyScores = db.prepare(`
        SELECT score, created_at FROM scores 
        WHERE user_id = ? AND created_at >= date('now', '-7 days')
      `).all(userId) as any[];
      
      const avgScore = weeklyScores.length > 0 
        ? weeklyScores.reduce((acc, s) => acc + s.score, 0) / weeklyScores.length 
        : 0;

      // 30-Day Stats
      const thirtyDayScores = db.prepare(`
        SELECT score, date FROM scores 
        WHERE user_id = ? AND date >= date('now', '-30 days')
        ORDER BY date ASC
      `).all(userId) as any[];

      const thirtyDayAvg = thirtyDayScores.length > 0
        ? thirtyDayScores.reduce((acc, s) => acc + s.score, 0) / thirtyDayScores.length
        : 0;

      // Trend Calculation
      let trend = "Flat";
      if (thirtyDayScores.length >= 10) {
        const firstHalf = thirtyDayScores.slice(0, Math.floor(thirtyDayScores.length / 2));
        const secondHalf = thirtyDayScores.slice(Math.floor(thirtyDayScores.length / 2));
        const firstAvg = firstHalf.reduce((acc, s) => acc + s.score, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((acc, s) => acc + s.score, 0) / secondHalf.length;
        if (secondAvg > firstAvg + 5) trend = "Improving";
        else if (secondAvg < firstAvg - 5) trend = "Declining";
      }

      // Evolution Level
      let evolution = "Undisciplined";
      if (thirtyDayAvg >= 90) evolution = "Professional";
      else if (thirtyDayAvg >= 80) evolution = "Consistent";
      else if (thirtyDayAvg >= 70) evolution = "Controlled";
      else if (thirtyDayAvg >= 60) evolution = "Aware";

      // Professional Points (PP)
      let pp = 0;
      const allScores = db.prepare(`
        SELECT score, date FROM scores 
        WHERE user_id = ? 
        ORDER BY date ASC
      `).all(userId) as any[];

      let currentStreak = 0;
      let lastDate: Date | null = null;

      for (const s of allScores) {
        if (s.score >= 75) pp += 1;
        if (s.score < 60) pp -= 2;

        const d = new Date(s.date);
        if (lastDate) {
          const diff = (d.getTime() - lastDate.getTime()) / (1000 * 3600 * 24);
          if (diff === 1 && s.score >= 75) {
            currentStreak++;
          } else if (diff > 1 || s.score < 75) {
            currentStreak = s.score >= 75 ? 1 : 0;
          }
        } else {
          currentStreak = s.score >= 75 ? 1 : 0;
        }
        lastDate = d;

        if (currentStreak > 0 && currentStreak % 7 === 0) pp += 5;
      }

      if (thirtyDayAvg >= 80) pp += 10;

      // Best/Worst Day
      const bestDay = weeklyScores.length > 0 ? Math.max(...weeklyScores.map(s => s.score)) : 0;
      const worstDay = weeklyScores.length > 0 ? Math.min(...weeklyScores.map(s => s.score)) : 0;

      // Most violated rule
      const violations = db.prepare(`
        SELECT 
          SUM(broke_sl) as broke_sl,
          SUM(overtraded) as overtraded,
          SUM(revenge_trade) as revenge_trade,
          SUM(no_valid_setup) as no_valid_setup,
          SUM(emotional_entry) as emotional_entry
        FROM violations v
        JOIN trades t ON v.trade_id = t.id
        WHERE t.user_id = ? AND t.created_at >= date('now', '-7 days')
      `).get(userId) as any;

      let mostViolated = "None";
      let maxVal = 0;
      if (violations) {
        const mapping: any = {
          "Stop Loss Rule": violations.broke_sl,
          "Overtrading": violations.overtraded,
          "Revenge Trading": violations.revenge_trade,
          "Invalid Setup": violations.no_valid_setup,
          "Emotional Entry": violations.emotional_entry
        };
        for (const [rule, val] of Object.entries(mapping)) {
          if ((val as number) > maxVal) {
            maxVal = val as number;
            mostViolated = rule;
          }
        }
      }

      // Strategy Insights
      const strategyData = db.prepare(`
        SELECT 
          t.strategy,
          COUNT(*) as total_trades,
          SUM(CASE WHEN v.broke_sl = 0 AND v.overtraded = 0 AND v.revenge_trade = 0 AND v.no_valid_setup = 0 AND v.emotional_entry = 0 THEN 1 ELSE 0 END) as disciplined_trades,
          SUM(v.broke_sl + v.overtraded + v.revenge_trade + v.no_valid_setup + v.emotional_entry) as total_violations
        FROM trades t
        LEFT JOIN violations v ON t.id = v.trade_id
        WHERE t.user_id = ? AND t.status = 'CLOSED'
        GROUP BY t.strategy
      `).all(userId) as any[];

      let mostDisciplinedStrategy = "None";
      let mostRuleBrokenStrategy = "None";
      let maxConsistency = -1;
      let maxViolationsRate = -1;

      strategyData.forEach(s => {
        const consistency = s.disciplined_trades / s.total_trades;
        const violationRate = s.total_violations / s.total_trades;

        if (consistency > maxConsistency) {
          maxConsistency = consistency;
          mostDisciplinedStrategy = s.strategy;
        }
        if (violationRate > maxViolationsRate) {
          maxViolationsRate = violationRate;
          mostRuleBrokenStrategy = s.strategy;
        }
      });

      // Streak Counter (Consecutive days >= 75)
      let streak = 0;
      const reversedScores = [...allScores].reverse();
      const seenDates = new Set();
      for (const s of reversedScores) {
        if (seenDates.has(s.date)) continue;
        if (s.score >= 75) {
          streak++;
          seenDates.add(s.date);
        } else {
          break;
        }
      }

      // Monthly Stats
      const monthScores = db.prepare(`
        SELECT score, date FROM scores 
        WHERE user_id = ? AND date >= date('now', 'start of month')
      `).all(userId) as any[];

      const activeDays = new Set(monthScores.map(s => s.date)).size;
      const monthAvg = monthScores.length > 0
        ? monthScores.reduce((acc, s) => acc + s.score, 0) / monthScores.length
        : 0;
      
      const monthTrades = db.prepare(`
        SELECT t.id, v.broke_sl, v.overtraded, v.revenge_trade, v.no_valid_setup, v.emotional_entry, t.pnl
        FROM trades t
        LEFT JOIN violations v ON t.id = v.trade_id
        WHERE t.user_id = ? AND t.created_at >= date('now', 'start of month')
      `).all(userId) as any[];

      const followedCount = monthTrades.filter(t => 
        !t.broke_sl && !t.overtraded && !t.revenge_trade && !t.no_valid_setup && !t.emotional_entry
      ).length;

      const monthlyDisciplinePercent = user.monthly_planned > 0 
        ? (followedCount / user.monthly_planned) * 100 
        : 0;

      // Discipline History for Graph
      const history7d = db.prepare(`
        SELECT date, score FROM scores 
        WHERE user_id = ? AND date >= date('now', '-7 days')
        ORDER BY date ASC
      `).all(userId) as any[];

      const history30d = db.prepare(`
        SELECT date, score FROM scores 
        WHERE user_id = ? AND date >= date('now', '-30 days')
        ORDER BY date ASC
      `).all(userId) as any[];

      // Recent Lessons for Weekly Report
      const recentReflections = db.prepare(`
        SELECT lesson FROM reflections 
        WHERE user_id = ? AND lesson IS NOT NULL AND lesson != ''
        ORDER BY date DESC LIMIT 5
      `).all(userId) as any[];
      const recentLessons = recentReflections.map(r => r.lesson);

      // Discipline vs PnL Warning
      const totalPnl = monthTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
      let pnlWarning = "";
      if (monthAvg >= 75 && totalPnl < 0) pnlWarning = "Correct process. Variance phase.";
      else if (monthAvg < 75 && totalPnl > 0) pnlWarning = "Danger zone. Bad habits forming.";

      // Journal Insights
      const insights: string[] = [];
      
      // FOMO/Mistake insight
      const entryReasons = db.prepare(`
        SELECT entry_reason, COUNT(*) as count 
        FROM trades 
        WHERE user_id = ? AND entry_reason IN ('FOMO', 'Revenge', 'Boredom')
        GROUP BY entry_reason 
        ORDER BY count DESC LIMIT 1
      `).get(userId) as any;
      if (entryReasons && entryReasons.count > 0) {
        insights.push(`${entryReasons.entry_reason} entries are your most common mistake.`);
      }

      // Pair-specific insight
      const pairViolations = db.prepare(`
        SELECT t.pair, COUNT(*) as count
        FROM trades t
        JOIN violations v ON t.id = v.trade_id
        WHERE t.user_id = ? AND (v.broke_sl=1 OR v.overtraded=1 OR v.revenge_trade=1 OR v.no_valid_setup=1 OR v.emotional_entry=1)
        GROUP BY t.pair
        ORDER BY count DESC LIMIT 1
      `).get(userId) as any;
      if (pairViolations && pairViolations.count > 0) {
        insights.push(`Most discipline breaks occur in ${pairViolations.pair} trades.`);
      }

      // Emotional insight
      const emotionalImpact = db.prepare(`
        SELECT COUNT(*) as count
        FROM trades
        WHERE user_id = ? AND emotional_interference = 'Yes'
      `).get(userId) as any;
      if (emotionalImpact && emotionalImpact.count > 2) {
        insights.push(`Emotional trades reduce your discipline score fastest.`);
      }

      res.json({
        weeklyAvg: avgScore.toFixed(1),
        thirtyDayAvg: thirtyDayAvg.toFixed(1),
        thirtyDayScores,
        trend,
        evolution,
        pp,
        bestDay,
        worstDay,
        mostViolated,
        mostDisciplinedStrategy,
        mostRuleBrokenStrategy,
        streak,
        recentLessons,
        insights,
        history7d,
        history30d,
        monthly: {
          percent: monthlyDisciplinePercent.toFixed(1),
          label: monthlyDisciplinePercent >= 75 ? "Stable" : "Unstable",
          avg: monthAvg.toFixed(1),
          totalPnl,
          pnlWarning
        },
        certificate: {
          eligible: activeDays >= 20 && monthAvg >= 60,
          badge: monthAvg >= 93 ? "Elite" : monthAvg >= 85 ? "Gold" : monthAvg >= 75 ? "Silver" : monthAvg >= 60 ? "Bronze" : "None"
        }
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Background Notification Check
  setInterval(() => {
    const users = db.prepare("SELECT * FROM users WHERE notifications_enabled = 1").all() as any[];
    const today = new Date().toISOString().split('T')[0];

    for (const user of users) {
      try {
        const now = new Date();
        const userHour = parseInt(new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          hour12: false,
          timeZone: user.timezone || 'UTC'
        }).format(now));

        // 1) Inactivity Check (after trading hours)
        if (userHour >= user.trading_end_hour) {
          const todayTrades = db.prepare("SELECT COUNT(*) as count FROM trades WHERE user_id = ? AND date(created_at) = ?").get(user.id, today) as any;
          if (todayTrades.count === 0) {
            sendNotification(user.id, 'INACTIVITY', 'You haven’t logged a trade today. Consistency is slipping.', today);
          }
        }

        // 2) Discipline Score Drop
        const scores = db.prepare("SELECT score FROM scores WHERE user_id = ? ORDER BY date DESC LIMIT 2").all(user.id) as any[];
        if (scores.length === 2 && scores[0].score < scores[1].score) {
          sendNotification(user.id, 'SCORE_DROP', 'Your discipline declined today. Review what broke.', today);
        }

        // 3) Streak at Risk
        // (Simplified: if no trades logged and it's late)
        if (userHour >= user.trading_end_hour - 1) {
          const streakInfo = getStreak(user.id);
          if (streakInfo > 0) {
            const todayScore = db.prepare("SELECT score FROM scores WHERE user_id = ? AND date = ?").get(user.id, today) as any;
            if (!todayScore || todayScore.score < 75) {
              sendNotification(user.id, 'STREAK_RISK', 'You’re about to lose your discipline streak.', today);
            }
          }
        }
      } catch (e) {
        console.error(`Error checking notifications for user ${user.id}:`, e);
      }
    }
  }, 1000 * 60 * 60); // Check every hour

  function sendNotification(userId: number, type: string, message: string, date: string) {
    try {
      db.prepare(`
        INSERT INTO notifications (user_id, type, message, date)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, type, date) DO NOTHING
      `).run(userId, type, message, date);
    } catch (e) {
      console.error("Error sending notification:", e);
    }
  }

  function getStreak(userId: number) {
    const scores = db.prepare("SELECT score, date FROM scores WHERE user_id = ? ORDER BY date DESC").all(userId) as any[];
    let streak = 0;
    const seenDates = new Set();
    for (const s of scores) {
      if (seenDates.has(s.date)) continue;
      if (s.score >= 75) {
        streak++;
        seenDates.add(s.date);
      } else {
        break;
      }
    }
    return streak;
  }
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
