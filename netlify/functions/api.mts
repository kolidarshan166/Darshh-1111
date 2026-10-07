import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";

const db = getDatabase();
const sql = db.sql;

const json = (data: unknown, status = 200) => Response.json(data, { status });
const todayStr = () => new Date().toISOString().split("T")[0];
const daysAgoStr = (days: number) => new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
const monthStartStr = () => todayStr().slice(0, 8) + "01";
const num = (v: any) => (v === null || v === undefined ? 0 : Number(v));

type Handler = (params: string[], body: any) => Promise<Response>;
const routes: { method: string; pattern: RegExp; handler: Handler }[] = [];
const route = (method: string, path: string, handler: Handler) => {
  const pattern = new RegExp("^" + path.replace(/:[a-z_]+/g, "([^/]+)") + "/?$");
  routes.push({ method, pattern, handler });
};

const upsertViolations = (tradeId: number, v: any = {}) => sql`
  INSERT INTO violations (trade_id, broke_sl, overtraded, revenge_trade, no_valid_setup, emotional_entry)
  VALUES (${tradeId}, ${v.broke_sl ? 1 : 0}, ${v.overtraded ? 1 : 0}, ${v.revenge_trade ? 1 : 0}, ${v.no_valid_setup ? 1 : 0}, ${v.emotional_entry ? 1 : 0})
  ON CONFLICT (trade_id) DO UPDATE SET
    broke_sl = excluded.broke_sl,
    overtraded = excluded.overtraded,
    revenge_trade = excluded.revenge_trade,
    no_valid_setup = excluded.no_valid_setup,
    emotional_entry = excluded.emotional_entry
`;

route("GET", "/api/health", async () => json({ status: "ok", timestamp: new Date().toISOString() }));

route("POST", "/api/auth/login", async (_, body) => {
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "Trader";
  if (!phone) return json({ error: "Phone number required" }, 400);

  const [user] = await sql`
    INSERT INTO users (phone, name) VALUES (${phone}, ${name})
    ON CONFLICT (phone) DO UPDATE SET phone = excluded.phone
    RETURNING *
  `;
  return json({ user });
});

route("POST", "/api/user/update", async (_, b) => {
  await sql`
    UPDATE users
    SET name = ${b.name}, monthly_planned = ${b.monthly_planned}, notifications_enabled = ${b.notifications_enabled},
        trading_start_hour = ${b.trading_start_hour}, trading_end_hour = ${b.trading_end_hour}
    WHERE id = ${b.user_id}
  `;
  return json({ success: true });
});

route("GET", "/api/notifications/check/:user_id", async ([userId]) => {
  const [user] = await sql`SELECT * FROM users WHERE id = ${userId}`;
  if (!user || !user.notifications_enabled) return json({ notifications: [] });

  const today = todayStr();
  const now = new Date();
  const currentHour = parseInt(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: user.timezone || "UTC" }).format(now)
  ) % 24;
  const notifications: { type: string; message: string }[] = [];

  const notify = async (type: string, message: string) => {
    const inserted = await sql`
      INSERT INTO notifications (user_id, type, message, date) VALUES (${userId}, ${type}, ${message}, ${today})
      ON CONFLICT (user_id, type, date) DO NOTHING
      RETURNING id
    `;
    if (inserted.length > 0) notifications.push({ type, message });
  };

  const hasTradeToday = async () =>
    (await sql`SELECT id FROM trades WHERE user_id = ${userId} AND to_char(created_at, 'YYYY-MM-DD') = ${today} LIMIT 1`).length > 0;

  // 1. No trade logged today (after trading hours)
  if (currentHour >= user.trading_end_hour && !(await hasTradeToday())) {
    await notify("no_trade", "You haven’t logged a trade today. Consistency is slipping.");
  }

  // 2. Discipline score dropped
  const recent = await sql`SELECT score, date FROM scores WHERE user_id = ${userId} ORDER BY date DESC LIMIT 2`;
  if (recent.length === 2 && recent[0].date === today && recent[0].score < recent[1].score) {
    await notify("score_drop", "Your discipline declined today. Review what broke.");
  }

  // 3. Streak at risk (2 hours before trading ends, no trade logged, had a good day yesterday)
  if (currentHour >= user.trading_end_hour - 2 && currentHour < user.trading_end_hour && !(await hasTradeToday())) {
    const [yesterdayScore] = await sql`SELECT score FROM scores WHERE user_id = ${userId} AND date = ${daysAgoStr(1)}`;
    if (yesterdayScore && yesterdayScore.score >= 75) {
      await notify("streak_risk", "You’re about to lose your discipline streak.");
    }
  }

  // 4. Progress plateau
  const last14 = await sql`SELECT score FROM scores WHERE user_id = ${userId} ORDER BY date DESC LIMIT 14`;
  if (last14.length === 14) {
    const recent7 = last14.slice(0, 7).reduce((a: number, s: any) => a + s.score, 0) / 7;
    const previous7 = last14.slice(7, 14).reduce((a: number, s: any) => a + s.score, 0) / 7;
    if (Math.abs(recent7 - previous7) < 2 && recent7 < 85) {
      await notify("plateau", "Your discipline is stable but not improving. Time to focus.");
    }
  }

  return json({ notifications });
});

route("POST", "/api/daily-plan", async (_, b) => {
  await sql`
    INSERT INTO daily_plans (user_id, date, planned_count) VALUES (${b.user_id}, ${b.date}, ${b.planned_count})
    ON CONFLICT (user_id, date) DO UPDATE SET planned_count = excluded.planned_count
  `;
  return json({ success: true });
});

route("GET", "/api/daily-plan/:user_id/:date", async ([userId, date]) => {
  const [plan] = await sql`SELECT * FROM daily_plans WHERE user_id = ${userId} AND date = ${date}`;
  return json({ plan: plan || { planned_count: 0 } });
});

route("POST", "/api/trades", async (_, b) => {
  const [user] = await sql`SELECT id FROM users WHERE id = ${b.user_id}`;
  if (!user) return json({ error: "Invalid session. Please log in again." }, 401);

  const [trade] = await sql`
    INSERT INTO trades (user_id, pair, market_type, strategy, type, entry_price, stop_loss, target, risk_percent, session)
    VALUES (${b.user_id}, ${b.pair || "BTCUSDT"}, ${b.market_type || "Crypto"}, ${b.strategy || "Standard"}, ${b.type},
            ${b.entry_price}, ${b.stop_loss}, ${b.target}, ${b.risk_percent}, ${b.session})
    RETURNING id
  `;
  await upsertViolations(trade.id);
  return json({ id: trade.id });
});

const tradesWithViolations = (userId: string, openOnly: boolean) => sql`
  SELECT t.*, v.broke_sl, v.overtraded, v.revenge_trade, v.no_valid_setup, v.emotional_entry
  FROM trades t
  LEFT JOIN violations v ON t.id = v.trade_id
  WHERE t.user_id = ${userId} AND (${!openOnly} OR t.status = 'OPEN')
  ORDER BY t.created_at DESC
`;

route("GET", "/api/trades/active/:user_id", async ([userId]) => json({ trades: await tradesWithViolations(userId, true) }));
route("GET", "/api/trades/history/:user_id", async ([userId]) => json({ trades: await tradesWithViolations(userId, false) }));

route("POST", "/api/trades/update-violations", async (_, b) => {
  await upsertViolations(b.trade_id, b.violations);
  return json({ success: true });
});

route("POST", "/api/trades/close", async (_, b) => {
  const { trade_id, pnl, violations: v, journal } = b;
  const [trade] = await sql`SELECT * FROM trades WHERE id = ${trade_id}`;
  if (!trade) return json({ error: "Trade not found" }, 404);

  await sql`
    UPDATE trades
    SET status = 'CLOSED', pnl = ${pnl || 0},
        setup_followed = ${journal?.setup_followed ?? null}, entry_reason = ${journal?.entry_reason ?? null},
        emotional_interference = ${journal?.emotional_interference ?? null}, execution_mistake = ${journal?.execution_mistake ?? null}
    WHERE id = ${trade_id}
  `;
  await upsertViolations(trade_id, v);

  // Recalculate daily score
  const today = todayStr();
  const todayTrades = await sql`
    SELECT t.id, v.broke_sl, v.overtraded, v.revenge_trade, v.no_valid_setup, v.emotional_entry
    FROM trades t
    JOIN violations v ON t.id = v.trade_id
    WHERE t.user_id = ${trade.user_id} AND to_char(t.created_at, 'YYYY-MM-DD') = ${today} AND t.status = 'CLOSED'
  `;
  const [plan] = await sql`SELECT planned_count FROM daily_plans WHERE user_id = ${trade.user_id} AND date = ${today}`;
  const planned = plan ? plan.planned_count : 0;

  let dailyScore = 100;
  const feedback: string[] = [];
  const counts = { broke_sl: 0, overtraded: 0, revenge_trade: 0, no_valid_setup: 0, emotional_entry: 0 };

  for (const t of todayTrades) {
    if (t.broke_sl) dailyScore -= 20 + ++counts.broke_sl * 10;
    if (t.overtraded) dailyScore -= 10 + ++counts.overtraded * 10;
    if (t.revenge_trade) dailyScore -= 15 + ++counts.revenge_trade * 10;
    if (t.no_valid_setup) dailyScore -= 15 + ++counts.no_valid_setup * 10;
    if (t.emotional_entry) dailyScore -= 5 + ++counts.emotional_entry * 10;
  }

  if (planned > 0 && todayTrades.length > planned) {
    const excess = todayTrades.length - planned;
    dailyScore -= excess * 15;
    feedback.push(`Overtrading detected (${excess} extra).`);
  }

  dailyScore = Math.max(0, dailyScore);

  if (dailyScore === 100) feedback.push("Rules respected. Professional behavior.");
  else if (dailyScore >= 75) feedback.push("Minor mistakes. Control improving.");
  else if (dailyScore >= 60) feedback.push("Discipline unstable.");
  else feedback.push("Rules ignored. Emotional trading.");

  const [score] = await sql`
    INSERT INTO scores (user_id, date, score, feedback) VALUES (${trade.user_id}, ${today}, ${dailyScore}, ${feedback.join(" ")})
    ON CONFLICT (user_id, date) DO UPDATE SET score = excluded.score, feedback = excluded.feedback
    RETURNING id
  `;

  return json({ id: score.id, score: dailyScore, feedback: feedback.join(" ") });
});

route("GET", "/api/scores/:user_id", async ([userId]) => {
  const scores = await sql`SELECT * FROM scores WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 10`;
  return json({ scores });
});

route("POST", "/api/scores/notes", async (_, b) => {
  await sql`UPDATE scores SET notes = ${b.notes ?? null} WHERE id = ${b.score_id}`;
  return json({ success: true });
});

route("GET", "/api/notifications/:user_id", async ([userId]) => {
  const notifications = await sql`SELECT * FROM notifications WHERE user_id = ${userId} ORDER BY sent_at DESC LIMIT 20`;
  return json({ notifications });
});

route("POST", "/api/notifications/read", async (_, b) => {
  for (const id of Array.isArray(b.notification_ids) ? b.notification_ids : []) {
    await sql`UPDATE notifications SET is_read = 1 WHERE id = ${id}`;
  }
  return json({ success: true });
});

route("POST", "/api/users/settings", async (_, b) => {
  const [user] = await sql`
    UPDATE users
    SET notifications_enabled = ${b.notifications_enabled ? 1 : 0}, trading_start_hour = ${b.trading_start_hour},
        trading_end_hour = ${b.trading_end_hour}, timezone = ${b.timezone || "UTC"}
    WHERE id = ${b.user_id}
    RETURNING *
  `;
  return json({ success: true, user });
});

route("POST", "/api/reflections", async (_, b) => {
  await sql`
    INSERT INTO reflections (user_id, date, mistake, done_well, focus_tomorrow)
    VALUES (${b.user_id}, ${b.date}, ${b.mistake ?? null}, ${b.done_well ?? null}, ${b.focus_tomorrow ?? null})
    ON CONFLICT (user_id, date) DO UPDATE SET
      mistake = excluded.mistake,
      done_well = excluded.done_well,
      focus_tomorrow = excluded.focus_tomorrow
  `;
  return json({ success: true });
});

route("GET", "/api/reflections/:user_id/:date", async ([userId, date]) => {
  const [reflection] = await sql`SELECT * FROM reflections WHERE user_id = ${userId} AND date = ${date}`;
  return json({ reflection: reflection || null });
});

route("GET", "/api/stats/:user_id", async ([userId]) => {
  const [user] = await sql`SELECT * FROM users WHERE id = ${userId}`;
  if (!user) return json({ error: "User not found" }, 404);

  const avg = (rows: any[]) => (rows.length > 0 ? rows.reduce((a, s) => a + s.score, 0) / rows.length : 0);

  // Weekly summary (last 7 days)
  const weeklyScores = await sql`
    SELECT score, created_at FROM scores WHERE user_id = ${userId} AND created_at >= now() - interval '7 days'
  `;
  const avgScore = avg(weeklyScores);

  // 30-day stats
  const thirtyDayScores = await sql`
    SELECT score, date FROM scores WHERE user_id = ${userId} AND date >= ${daysAgoStr(30)} ORDER BY date ASC
  `;
  const thirtyDayAvg = avg(thirtyDayScores);

  let trend = "Flat";
  if (thirtyDayScores.length >= 10) {
    const mid = Math.floor(thirtyDayScores.length / 2);
    const firstAvg = avg(thirtyDayScores.slice(0, mid));
    const secondAvg = avg(thirtyDayScores.slice(mid));
    if (secondAvg > firstAvg + 5) trend = "Improving";
    else if (secondAvg < firstAvg - 5) trend = "Declining";
  }

  let evolution = "Undisciplined";
  if (thirtyDayAvg >= 90) evolution = "Professional";
  else if (thirtyDayAvg >= 80) evolution = "Consistent";
  else if (thirtyDayAvg >= 70) evolution = "Controlled";
  else if (thirtyDayAvg >= 60) evolution = "Aware";

  // Professional Points (PP)
  let pp = 0;
  const allScores = await sql`SELECT score, date FROM scores WHERE user_id = ${userId} ORDER BY date ASC`;
  let currentStreak = 0;
  let lastDate: Date | null = null;
  for (const s of allScores) {
    if (s.score >= 75) pp += 1;
    if (s.score < 60) pp -= 2;
    const d = new Date(s.date);
    if (lastDate) {
      const diff = (d.getTime() - lastDate.getTime()) / (1000 * 3600 * 24);
      if (diff === 1 && s.score >= 75) currentStreak++;
      else if (diff > 1 || s.score < 75) currentStreak = s.score >= 75 ? 1 : 0;
    } else {
      currentStreak = s.score >= 75 ? 1 : 0;
    }
    lastDate = d;
    if (currentStreak > 0 && currentStreak % 7 === 0) pp += 5;
  }
  if (thirtyDayAvg >= 80) pp += 10;

  const bestDay = weeklyScores.length > 0 ? Math.max(...weeklyScores.map((s: any) => s.score)) : 0;
  const worstDay = weeklyScores.length > 0 ? Math.min(...weeklyScores.map((s: any) => s.score)) : 0;

  // Most violated rule
  const [violations] = await sql`
    SELECT SUM(broke_sl) AS broke_sl, SUM(overtraded) AS overtraded, SUM(revenge_trade) AS revenge_trade,
           SUM(no_valid_setup) AS no_valid_setup, SUM(emotional_entry) AS emotional_entry
    FROM violations v
    JOIN trades t ON v.trade_id = t.id
    WHERE t.user_id = ${userId} AND t.created_at >= now() - interval '7 days'
  `;
  let mostViolated = "None";
  let maxVal = 0;
  if (violations) {
    const mapping: Record<string, number> = {
      "Stop Loss Rule": num(violations.broke_sl),
      "Overtrading": num(violations.overtraded),
      "Revenge Trading": num(violations.revenge_trade),
      "Invalid Setup": num(violations.no_valid_setup),
      "Emotional Entry": num(violations.emotional_entry),
    };
    for (const [rule, val] of Object.entries(mapping)) {
      if (val > maxVal) {
        maxVal = val;
        mostViolated = rule;
      }
    }
  }

  // Strategy insights
  const strategyData = await sql`
    SELECT
      t.strategy,
      COUNT(*) AS total_trades,
      SUM(CASE WHEN COALESCE(v.broke_sl,0) = 0 AND COALESCE(v.overtraded,0) = 0 AND COALESCE(v.revenge_trade,0) = 0
                AND COALESCE(v.no_valid_setup,0) = 0 AND COALESCE(v.emotional_entry,0) = 0 THEN 1 ELSE 0 END) AS disciplined_trades,
      SUM(COALESCE(v.broke_sl,0) + COALESCE(v.overtraded,0) + COALESCE(v.revenge_trade,0) + COALESCE(v.no_valid_setup,0) + COALESCE(v.emotional_entry,0)) AS total_violations
    FROM trades t
    LEFT JOIN violations v ON t.id = v.trade_id
    WHERE t.user_id = ${userId} AND t.status = 'CLOSED'
    GROUP BY t.strategy
  `;
  let mostDisciplinedStrategy = "None";
  let mostRuleBrokenStrategy = "None";
  let maxConsistency = -1;
  let maxViolationsRate = -1;
  for (const s of strategyData) {
    const total = num(s.total_trades);
    const consistency = num(s.disciplined_trades) / total;
    const violationRate = num(s.total_violations) / total;
    if (consistency > maxConsistency) {
      maxConsistency = consistency;
      mostDisciplinedStrategy = s.strategy;
    }
    if (violationRate > maxViolationsRate) {
      maxViolationsRate = violationRate;
      mostRuleBrokenStrategy = s.strategy;
    }
  }

  // Streak counter (consecutive days >= 75)
  let streak = 0;
  for (const s of [...allScores].reverse()) {
    if (s.score >= 75) streak++;
    else break;
  }

  // Monthly stats
  const monthStart = monthStartStr();
  const monthScores = await sql`SELECT score, date FROM scores WHERE user_id = ${userId} AND date >= ${monthStart}`;
  const activeDays = new Set(monthScores.map((s: any) => s.date)).size;
  const monthAvg = avg(monthScores);

  const monthTrades = await sql`
    SELECT t.id, v.broke_sl, v.overtraded, v.revenge_trade, v.no_valid_setup, v.emotional_entry, t.pnl
    FROM trades t
    LEFT JOIN violations v ON t.id = v.trade_id
    WHERE t.user_id = ${userId} AND t.created_at >= date_trunc('month', now())
  `;
  const followedCount = monthTrades.filter(
    (t: any) => !t.broke_sl && !t.overtraded && !t.revenge_trade && !t.no_valid_setup && !t.emotional_entry
  ).length;
  const monthlyDisciplinePercent = user.monthly_planned > 0 ? (followedCount / user.monthly_planned) * 100 : 0;

  // Discipline history for graphs
  const history7d = await sql`SELECT date, score FROM scores WHERE user_id = ${userId} AND date >= ${daysAgoStr(7)} ORDER BY date ASC`;
  const history30d = await sql`SELECT date, score FROM scores WHERE user_id = ${userId} AND date >= ${daysAgoStr(30)} ORDER BY date ASC`;

  const recentReflections = await sql`
    SELECT lesson FROM reflections WHERE user_id = ${userId} AND lesson IS NOT NULL AND lesson != ''
    ORDER BY date DESC LIMIT 5
  `;
  const recentLessons = recentReflections.map((r: any) => r.lesson);

  const totalPnl = monthTrades.reduce((a: number, t: any) => a + (t.pnl || 0), 0);
  let pnlWarning = "";
  if (monthAvg >= 75 && totalPnl < 0) pnlWarning = "Correct process. Variance phase.";
  else if (monthAvg < 75 && totalPnl > 0) pnlWarning = "Danger zone. Bad habits forming.";

  // Journal insights
  const insights: string[] = [];
  const [entryReasons] = await sql`
    SELECT entry_reason, COUNT(*) AS count FROM trades
    WHERE user_id = ${userId} AND entry_reason IN ('FOMO', 'Revenge', 'Boredom')
    GROUP BY entry_reason ORDER BY count DESC LIMIT 1
  `;
  if (entryReasons && num(entryReasons.count) > 0) {
    insights.push(`${entryReasons.entry_reason} entries are your most common mistake.`);
  }

  const [pairViolations] = await sql`
    SELECT t.pair, COUNT(*) AS count
    FROM trades t
    JOIN violations v ON t.id = v.trade_id
    WHERE t.user_id = ${userId} AND (v.broke_sl = 1 OR v.overtraded = 1 OR v.revenge_trade = 1 OR v.no_valid_setup = 1 OR v.emotional_entry = 1)
    GROUP BY t.pair ORDER BY count DESC LIMIT 1
  `;
  if (pairViolations && num(pairViolations.count) > 0) {
    insights.push(`Most discipline breaks occur in ${pairViolations.pair} trades.`);
  }

  const [emotionalImpact] = await sql`
    SELECT COUNT(*) AS count FROM trades WHERE user_id = ${userId} AND emotional_interference = 'Yes'
  `;
  if (emotionalImpact && num(emotionalImpact.count) > 2) {
    insights.push(`Emotional trades reduce your discipline score fastest.`);
  }

  return json({
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
      pnlWarning,
    },
    certificate: {
      eligible: activeDays >= 20 && monthAvg >= 60,
      badge: monthAvg >= 93 ? "Elite" : monthAvg >= 85 ? "Gold" : monthAvg >= 75 ? "Silver" : monthAvg >= 60 ? "Bronze" : "None",
    },
  });
});

export default async (req: Request) => {
  const { pathname } = new URL(req.url);
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const match = pathname.match(r.pattern);
    if (!match) continue;
    try {
      const body = req.method === "POST" ? await req.json().catch(() => ({})) : null;
      return await r.handler(match.slice(1).map(decodeURIComponent), body);
    } catch (error) {
      console.error(`Error handling ${req.method} ${pathname}:`, error);
      return json({ error: "Internal server error" }, 500);
    }
  }
  return json({ error: "Not found" }, 404);
};

export const config: Config = {
  path: "/api/*",
};
