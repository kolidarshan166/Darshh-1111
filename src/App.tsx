import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardList, 
  AlertCircle, 
  Trophy, 
  LogIn, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle2,
  ChevronRight,
  LogOut,
  User2 as UserIcon,
  Settings,
  Plus,
  X,
  Search,
  ChevronDown,
  Check,
  History,
  Bell,
  BellOff,
  BarChart3
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { cn } from './lib/utils';
import { GoogleGenAI } from "@google/genai";

// Types
interface User {
  id: number;
  phone: string;
  name?: string;
  monthly_planned?: number;
  notifications_enabled?: number;
  trading_start_hour?: number;
  trading_end_hour?: number;
  timezone?: string;
}

interface Trade {
  id: number;
  pair: string;
  market_type: 'Crypto' | 'Forex' | 'Commodities' | 'Indices';
  strategy: string;
  type: 'BUY' | 'SELL';
  entry_price: number;
  stop_loss: number;
  target: number;
  risk_percent: number;
  session: string;
  status: 'OPEN' | 'CLOSED';
  created_at: string;
  broke_sl?: boolean;
  overtraded?: boolean;
  revenge_trade?: boolean;
  no_valid_setup?: boolean;
  emotional_entry?: boolean;
  pnl?: number;
}

interface Score {
  id: number;
  score: number;
  feedback: string;
  notes?: string;
  created_at: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('trader_user');
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      if (parsed && !parsed.phone) {
        localStorage.removeItem('trader_user');
        return null;
      }
      return parsed;
    } catch (e) {
      localStorage.removeItem('trader_user');
      return null;
    }
  });
  const [currentPage, setCurrentPage] = useState<'LOGIN' | 'LIVE' | 'SCORE' | 'HISTORY' | 'IDENTITY' | 'PROFILE' | 'PHILOSOPHY'>('LOGIN');
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [lastScore, setLastScore] = useState<Score | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (user) {
      if (currentPage === 'LOGIN') setCurrentPage('LIVE');
      fetchActiveTrades();
      fetchLastScore();
      checkNotifications();
      const interval = setInterval(checkNotifications, 1000 * 60 * 15); // Check every 15 mins
      return () => clearInterval(interval);
    }
  }, [user]);

  const checkNotifications = async () => {
    if (!user || !user.notifications_enabled) return;
    try {
      const res = await fetch(`/api/notifications/check/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.notifications && data.notifications.length > 0) {
          setNotifications(prev => [...prev, ...data.notifications]);
          data.notifications.forEach((n: any) => {
            if (Notification.permission === 'granted') {
              new Notification("TradeDiscipline", { body: n.message });
            } else {
              showToast(n.message, 'error');
            }
          });
        }
      }
    } catch (e) {
      console.error("Failed to check notifications:", e);
    }
  };

  const markNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const fetchActiveTrades = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/trades/active/${user.id}`);
      if (!res.ok) return;
      const data = await res.json();
      setActiveTrades(data.trades || []);
    } catch (e) {
      console.error("Failed to fetch active trades:", e);
    }
  };

  const fetchLastScore = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/scores/${user.id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.scores && data.scores.length > 0) {
        setLastScore(data.scores[0]);
      }
    } catch (e) {
      console.error("Failed to fetch last score:", e);
    }
  };

  const logout = () => {
    localStorage.removeItem('trader_user');
    setUser(null);
    setCurrentPage('LOGIN');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col max-w-md mx-auto border-x border-zinc-800/50 shadow-2xl">
      {/* Header */}
      {user && (
        <header className="p-4 border-bottom border-zinc-800 flex justify-between items-center bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-zinc-950" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">TradeDiscipline</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => { setShowNotifications(true); markNotificationsAsRead(); }}
              className="p-2 text-zinc-500 hover:text-zinc-100 transition-colors relative"
            >
              <Bell className="w-5 h-5" />
              {notifications.some(n => !n.is_read) && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-zinc-950" />
              )}
            </button>
            <button onClick={logout} className="p-2 text-zinc-500 hover:text-zinc-100 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>
      )}

      <main className="flex-1 flex flex-col p-4 pb-24">
        <AnimatePresence>
          {toast && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={cn(
                "fixed top-20 left-4 right-4 z-[100] p-4 rounded-2xl shadow-lg text-center font-bold text-sm",
                toast.type === 'success' ? "bg-emerald-500 text-zinc-950" : "bg-rose-500 text-zinc-100"
              )}
            >
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          {currentPage === 'LOGIN' && <LoginPage onLogin={(u) => {
            localStorage.setItem('trader_user', JSON.stringify(u));
            setUser(u);
          }} />}
          {currentPage === 'LIVE' && user && (
            <LivePage 
              user={user} 
              activeTrades={activeTrades}
              onTradesUpdated={fetchActiveTrades}
              onScoreUpdated={fetchLastScore}
              showToast={showToast}
            />
          )}
          {currentPage === 'SCORE' && user && (
            <ScorePage 
              user={user}
              lastScore={lastScore} 
              onBack={() => setCurrentPage('LIVE')}
            />
          )}
          {currentPage === 'HISTORY' && user && (
            <HistoryPage user={user} />
          )}
          {currentPage === 'IDENTITY' && user && (
            <IdentityPage user={user} />
          )}
          {currentPage === 'PROFILE' && user && (
            <ProfilePage user={user} onUpdate={(updated) => {
              setUser(updated);
              localStorage.setItem('trader_user', JSON.stringify(updated));
              setCurrentPage('LIVE');
            }} onPhilosophy={() => setCurrentPage('PHILOSOPHY')} />
          )}
          {currentPage === 'PHILOSOPHY' && (
            <PhilosophyPage onBack={() => setCurrentPage('PROFILE')} />
          )}
        </AnimatePresence>
      </main>

      {/* Navigation */}
      {user && (
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-950 border-t border-zinc-800 flex justify-around p-2 pb-6 z-50">
          <NavButton 
            active={currentPage === 'LIVE'} 
            onClick={() => setCurrentPage('LIVE')} 
            icon={<Clock className="w-6 h-6" />} 
            label="Live" 
          />
          <NavButton 
            active={currentPage === 'HISTORY'} 
            onClick={() => setCurrentPage('HISTORY')} 
            icon={<ClipboardList className="w-6 h-6" />} 
            label="History" 
          />
          <NavButton 
            active={currentPage === 'SCORE'} 
            onClick={() => setCurrentPage('SCORE')} 
            icon={<Trophy className="w-6 h-6" />} 
            label="Score" 
          />
          <NavButton 
            active={currentPage === 'IDENTITY'} 
            onClick={() => setCurrentPage('IDENTITY')} 
            icon={<UserIcon className="w-6 h-6" />} 
            label="Identity" 
          />
          <NavButton 
            active={currentPage === 'PROFILE'} 
            onClick={() => setCurrentPage('PROFILE')} 
            icon={<Settings className="w-6 h-6" />} 
            label="Profile" 
          />
        </nav>
      )}
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 p-2 transition-all duration-200",
        active ? "text-emerald-500 scale-110" : "text-zinc-500"
      )}
    >
      {icon}
      <span className="text-[10px] uppercase font-bold tracking-widest">{label}</span>
    </button>
  );
}

// --- PAGES ---

function LoginPage({ onLogin }: { onLogin: (u: User) => void }) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name })
      });
      
      const isJson = res.headers.get('content-type')?.includes('application/json');
      const errorData = isJson ? await res.json().catch(() => ({})) : { error: await res.text().catch(() => 'Unknown error') };

      if (!res.ok) {
        throw new Error(errorData.error || `Server returned ${res.status}: ${res.statusText}`);
      }
      
      const data = errorData; // Already parsed if ok
      if (!data.user) throw new Error('Invalid response: user object missing');
      
      onLogin(data.user);
    } catch (e: any) {
      console.error("Detailed Login error:", e);
      alert(`Login failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex-1 flex flex-col justify-center items-center text-center gap-8"
    >
      <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/20">
        <TrendingUp className="w-10 h-10 text-zinc-950" />
      </div>
      <div>
        <h2 className="text-3xl font-bold mb-2">TradeDiscipline</h2>
        <p className="text-zinc-500">Strict accountability for retail traders.</p>
      </div>
      <form onSubmit={handleSubmit} className="w-full space-y-4">
        <input 
          type="text" 
          placeholder="Your Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-lg focus:border-emerald-500 transition-colors"
        />
        <input 
          type="tel" 
          placeholder="Phone Number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-lg focus:border-emerald-500 transition-colors"
          required
        />
        <button 
          disabled={loading}
          className="w-full bg-emerald-500 text-zinc-950 font-bold py-4 rounded-2xl text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          {loading ? "Authenticating..." : (
            <>
              Enter Dashboard <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}

function LivePage({ user, activeTrades, onTradesUpdated, onScoreUpdated, showToast }: { user: User, activeTrades: Trade[], onTradesUpdated: () => void, onScoreUpdated: () => void, showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [showLogModal, setShowLogModal] = useState(false);
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null);
  const [showReflection, setShowReflection] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`/api/notifications/check/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col gap-6"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Live Trades</h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowNotifications(true)}
            className="bg-zinc-900 text-zinc-400 p-1.5 rounded-xl border border-zinc-800 active:scale-95 transition-all relative"
          >
            <Bell className="w-4 h-4" />
            {notifications.some(n => !n.is_read) && (
              <div className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border-2 border-zinc-900" />
            )}
          </button>
          <button 
            onClick={() => setShowReflection(true)}
            className="bg-zinc-900 text-zinc-400 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 border border-zinc-800 active:scale-95 transition-all"
          >
            <History className="w-3.5 h-3.5" /> Journal
          </button>
          <button 
            onClick={() => setShowLogModal(true)}
            className="bg-emerald-500 text-zinc-950 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Log Trade
          </button>
        </div>
      </div>

      {activeTrades.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-12 border border-dashed border-zinc-800 rounded-3xl">
          <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-700">
            <Clock className="w-6 h-6" />
          </div>
          <p className="text-zinc-500 text-sm">No active trades.<br/>Stay patient, wait for your setup.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeTrades.map(trade => (
            <LiveTradeCard 
              key={trade.id} 
              trade={trade} 
              onClose={() => { setClosingTrade(trade); }}
              onUpdate={onTradesUpdated}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showLogModal && (
          <TradeLogModal 
            user={user} 
            onClose={() => setShowLogModal(false)} 
            onSuccess={() => {
              setShowLogModal(false);
              onTradesUpdated();
              showToast("Trade logged successfully!");
            }} 
            showToast={showToast}
          />
        )}
        {closingTrade && (
          <JournalModal 
            trade={closingTrade} 
            onClose={() => setClosingTrade(null)} 
            onSuccess={() => {
              setClosingTrade(null);
              onTradesUpdated();
              onScoreUpdated();
              setShowReflection(true);
              showToast("Trade closed and journaled.");
            }} 
            showToast={showToast}
          />
        )}
        {showReflection && (
          <ReflectionModal 
            user={user}
            onClose={() => setShowReflection(false)}
            onSuccess={() => setShowReflection(false)}
          />
        )}
        {showNotifications && (
          <NotificationsModal 
            notifications={notifications}
            onClose={() => setShowNotifications(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const LiveTradeCard: React.FC<{ trade: Trade, onClose: () => void, onUpdate: () => void }> = ({ trade, onClose, onUpdate }) => {
  const [updating, setUpdating] = useState(false);

  const toggleViolation = async (key: string) => {
    setUpdating(true);
    const currentViolations = {
      broke_sl: trade.broke_sl,
      overtraded: trade.overtraded,
      revenge_trade: trade.revenge_trade,
      no_valid_setup: trade.no_valid_setup,
      emotional_entry: trade.emotional_entry,
      [key]: !((trade as any)[key])
    };

    try {
      await fetch('/api/trades/update-violations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trade_id: trade.id, violations: currentViolations })
      });
      onUpdate();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  };

  const rules = [
    { key: 'broke_sl', label: 'SL Moved' },
    { key: 'overtraded', label: 'Overtraded' },
    { key: 'emotional_entry', label: 'FOMO' }
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              "text-[10px] font-black px-1.5 py-0.5 rounded",
              trade.type === 'BUY' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
            )}>{trade.type}</span>
            <span className="text-sm font-black text-zinc-100">{trade.pair}</span>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
            Entry: {trade.entry_price} • Risk: {trade.risk_percent}%
          </p>
        </div>
        <button 
          onClick={onClose}
          className="bg-zinc-100 text-zinc-950 px-3 py-1 rounded-lg text-[10px] font-black uppercase active:scale-95 transition-all"
        >
          Close
        </button>
      </div>

      <div className="flex gap-2">
        {rules.map(rule => (
          <button
            key={rule.key}
            disabled={updating}
            onClick={() => toggleViolation(rule.key)}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all",
              (trade as any)[rule.key] 
                ? "bg-rose-500/10 border-rose-500 text-rose-500" 
                : "bg-zinc-950 border-zinc-800 text-zinc-500"
            )}
          >
            {rule.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TradeLogModal({ user, onClose, onSuccess, showToast }: { user: User, onClose: () => void, onSuccess: () => void, showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [marketType, setMarketType] = useState<'Crypto' | 'Forex' | 'Commodities' | 'Indices'>('Crypto');
  const [pair, setPair] = useState('');
  const [strategy, setStrategy] = useState('Standard');
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
  const [entry, setEntry] = useState('');
  const [sl, setSl] = useState('');
  const [target, setTarget] = useState('');
  const [session, setSession] = useState('London');
  const [loading, setLoading] = useState(false);

  const riskPercent = React.useMemo(() => {
    const e = parseFloat(entry);
    const s = parseFloat(sl);
    if (!e || !s) return 0;
    const risk = Math.abs(e - s) / e * 100;
    return parseFloat(risk.toFixed(2));
  }, [entry, sl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pair) return showToast("Please select a pair", "error");
    setLoading(true);
    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          pair,
          market_type: marketType,
          strategy,
          type,
          entry_price: parseFloat(entry),
          stop_loss: parseFloat(sl),
          target: parseFloat(target),
          risk_percent: riskPercent,
          session
        })
      });
      if (!res.ok) throw new Error('Failed to log trade');
      showToast("Trade logged successfully!");
      onSuccess();
    } catch (e) {
      console.error(e);
      showToast("Failed to log trade.", "error");
    } finally {
      setLoading(false);
    }
  };

  const strategies = ['Standard', 'Breakout', 'Mean Reversion', 'Trend Following', 'Scalp'];

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-black uppercase tracking-tight">Log New Trade</h3>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-100"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1 rounded-2xl border border-zinc-800">
              {(['Crypto', 'Forex', 'Commodities', 'Indices'] as const).map(t => (
                <button 
                  key={t} type="button" onClick={() => setMarketType(t)}
                  className={cn(
                    "py-2 rounded-xl font-bold transition-all text-[10px] uppercase tracking-widest",
                    marketType === t ? "bg-zinc-100 text-zinc-950" : "text-zinc-500"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            <PairSelector type={marketType} value={pair} onChange={setPair} />

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Strategy</label>
              <div className="flex flex-wrap gap-2">
                {strategies.map(s => (
                  <button 
                    key={s} type="button" onClick={() => setStrategy(s)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all",
                      strategy === s ? "bg-zinc-100 text-zinc-950 border-zinc-100" : "bg-transparent text-zinc-500 border-zinc-800"
                    )}
                  >
                    {s}
                  </button>
                ))}
                <input 
                  type="text" 
                  placeholder="Custom..." 
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-[10px] font-bold w-24 focus:border-emerald-500 transition-colors"
                  onBlur={(e) => e.target.value && setStrategy(e.target.value)}
                />
              </div>
            </div>

            <div className="flex bg-zinc-950 p-1 rounded-2xl border border-zinc-800">
              {(['BUY', 'SELL'] as const).map(t => (
                <button 
                  key={t} type="button" onClick={() => setType(t)}
                  className={cn(
                    "flex-1 py-2 rounded-xl font-bold transition-all text-[10px] uppercase tracking-widest",
                    type === t ? (t === 'BUY' ? "bg-emerald-500 text-zinc-950" : "bg-rose-500 text-zinc-950") : "text-zinc-500"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Entry Price</label>
                <input 
                  type="number" step="any" placeholder="0.00" value={entry} onChange={e => setEntry(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 font-mono text-sm" required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Stop Loss</label>
                  <input 
                    type="number" step="any" placeholder="0.00" value={sl} onChange={e => setSl(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 font-mono text-sm" required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Target</label>
                  <input 
                    type="number" step="any" placeholder="0.00" value={target} onChange={e => setTarget(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 font-mono text-sm" required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Session</label>
              <div className="flex gap-2">
                {['Asia', 'London', 'New York'].map(s => (
                  <button 
                    key={s} type="button" onClick={() => setSession(s)}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-[10px] font-bold border transition-all",
                      session === s ? "bg-zinc-100 text-zinc-950 border-zinc-100" : "bg-transparent text-zinc-500 border-zinc-800"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2">
            <div className="flex justify-between items-center mb-4 px-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Calculated Risk</span>
              <span className={cn("text-sm font-black", riskPercent > 2 ? "text-rose-500" : "text-emerald-500")}>{riskPercent}%</span>
            </div>
            <button 
              disabled={loading}
              className="w-full bg-emerald-500 text-zinc-950 font-bold py-4 rounded-2xl text-sm active:scale-[0.98] transition-all"
            >
              {loading ? "Logging..." : "Confirm Trade Entry"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function PairSelector({ type, value, onChange }: { type: 'Crypto' | 'Forex' | 'Commodities' | 'Indices', value: string, onChange: (v: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const cryptoPairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT'];
  const forexPairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'EURGBP'];
  const commodityPairs = ['XAUUSD', 'XAGUSD', 'USOIL', 'WTI', 'BRENT', 'NATGAS'];
  const indicesPairs = ['NAS100', 'US30', 'SPX500', 'GER40', 'UK100'];
  
  const options = type === 'Crypto' ? cryptoPairs : type === 'Forex' ? forexPairs : type === 'Commodities' ? commodityPairs : indicesPairs;
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative">
      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Pair Selection</label>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex justify-between items-center text-sm font-bold"
      >
        {value || "Select Pair..."}
        <ChevronDown className={cn("w-4 h-4 text-zinc-500 transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-[110] top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-2 border-b border-zinc-800 flex items-center gap-2">
              <Search className="w-4 h-4 text-zinc-500" />
              <input 
                autoFocus
                type="text" 
                placeholder="Search pairs..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm w-full p-1"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.map(opt => (
                <button 
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                  }}
                  className="w-full text-left p-3 text-sm hover:bg-zinc-800 transition-colors flex justify-between items-center"
                >
                  {opt}
                  {value === opt && <Check className="w-4 h-4 text-emerald-500" />}
                </button>
              ))}
              {filtered.length === 0 && search && (
                <button 
                  type="button"
                  onClick={() => {
                    onChange(search.toUpperCase());
                    setIsOpen(false);
                  }}
                  className="w-full text-left p-3 text-sm text-emerald-500 hover:bg-zinc-800 italic"
                >
                  Add custom: {search.toUpperCase()}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function JournalModal({ trade, onClose, onSuccess, showToast }: { trade: Trade, onClose: () => void, onSuccess: () => void, showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [v, setV] = useState({
    broke_sl: trade.broke_sl || false,
    overtraded: trade.overtraded || false,
    revenge_trade: trade.revenge_trade || false,
    no_valid_setup: trade.no_valid_setup || false,
    emotional_entry: trade.emotional_entry || false
  });
  const [pnl, setPnl] = useState('');
  const [setupFollowed, setSetupFollowed] = useState<'Yes' | 'Partially' | 'No'>('Yes');
  const [entryReason, setEntryReason] = useState('Setup confirmation');
  const [emotionsAffected, setEmotionsAffected] = useState<'Yes' | 'No'>('No');
  const [executionMistake, setExecutionMistake] = useState('');
  const [loading, setLoading] = useState(false);

  const toggle = (key: keyof typeof v) => setV(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trades/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          trade_id: trade.id, 
          pnl: parseFloat(pnl) || 0, 
          violations: v,
          journal: {
            setup_followed: setupFollowed,
            entry_reason: entryReason,
            emotional_interference: emotionsAffected,
            execution_mistake: executionMistake
          }
        })
      });
      if (!res.ok) throw new Error('Failed to close trade');
      onSuccess();
    } catch (e) {
      console.error(e);
      showToast("Failed to save journal entry.", "error");
    } finally {
      setLoading(false);
    }
  };

  const options = [
    { key: 'broke_sl', label: 'Broke Stop Loss (−25)' },
    { key: 'overtraded', label: 'Overtraded (−15)' },
    { key: 'revenge_trade', label: 'Revenge Trade (−20)' },
    { key: 'no_valid_setup', label: 'No Valid Setup (−20)' },
    { key: 'emotional_entry', label: 'Emotional Entry (−10)' }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-black uppercase tracking-tight">Close & Journal</h3>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{trade.pair}</span>
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{trade.type}</span>
            </div>
            <p className="text-xs text-zinc-300">Entry: {trade.entry_price} • Risk: {trade.risk_percent}%</p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">PnL Outcome</label>
            <input 
              type="number" step="any" value={pnl} onChange={(e) => setPnl(e.target.value)}
              placeholder="0.00"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-lg font-mono focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Trade Reflection</label>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 ml-1">Setup followed?</label>
              <div className="flex gap-2">
                {['Yes', 'Partially', 'No'].map(opt => (
                  <button 
                    key={opt} onClick={() => setSetupFollowed(opt as any)}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-[10px] font-bold border transition-all",
                      setupFollowed === opt ? "bg-zinc-100 text-zinc-950 border-zinc-100" : "bg-transparent text-zinc-500 border-zinc-800"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 ml-1">Entry reason</label>
              <div className="grid grid-cols-2 gap-2">
                {['Setup confirmation', 'FOMO', 'Revenge', 'Boredom'].map(opt => (
                  <button 
                    key={opt} onClick={() => setEntryReason(opt)}
                    className={cn(
                      "py-2 rounded-xl text-[10px] font-bold border transition-all",
                      entryReason === opt ? "bg-zinc-100 text-zinc-950 border-zinc-100" : "bg-transparent text-zinc-500 border-zinc-800"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 ml-1">Emotional interference?</label>
              <div className="flex gap-2">
                {['Yes', 'No'].map(opt => (
                  <button 
                    key={opt} onClick={() => setEmotionsAffected(opt as any)}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-[10px] font-bold border transition-all",
                      emotionsAffected === opt ? "bg-zinc-100 text-zinc-950 border-zinc-100" : "bg-transparent text-zinc-500 border-zinc-800"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 ml-1">Execution mistake (optional)</label>
              <input 
                type="text" value={executionMistake} onChange={e => setExecutionMistake(e.target.value)}
                placeholder="e.g. Slipped entry"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm"
              />
            </div>

            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 pt-2 block">Rule Violations</label>
            {options.map(opt => (
              <button 
                key={opt.key}
                onClick={() => toggle(opt.key as any)}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-xl border transition-all active:scale-[0.99]",
                  v[opt.key as keyof typeof v] 
                    ? "bg-rose-500/10 border-rose-500 text-rose-500" 
                    : "bg-zinc-950 border-zinc-800 text-zinc-300"
                )}
              >
                <span className="text-xs font-bold">{opt.label}</span>
                {v[opt.key as keyof typeof v] ? <AlertCircle className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border border-zinc-700" />}
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-zinc-100 text-zinc-950 font-bold py-4 rounded-2xl text-sm active:scale-[0.98] transition-all"
        >
          {loading ? "Saving..." : "Submit Journal Entry"}
        </button>
      </motion.div>
    </div>
  );
}

function ReflectionModal({ user, onClose, onSuccess }: { user: User, onClose: () => void, onSuccess: () => void }) {
  const [mistake, setMistake] = useState('None');
  const [doneWell, setDoneWell] = useState('');
  const [focusTomorrow, setFocusTomorrow] = useState('Patience');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTodayReflection = async () => {
      const today = new Date().toISOString().split('T')[0];
      try {
        const res = await fetch(`/api/reflections/${user.id}/${today}`);
        if (res.ok) {
          const data = await res.json();
          if (data.reflection) {
            setMistake(data.reflection.mistake || 'None');
            setDoneWell(data.reflection.done_well || '');
            setFocusTomorrow(data.reflection.focus_tomorrow || 'Patience');
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchTodayReflection();
  }, [user.id]);

  const handleSubmit = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    try {
      const res = await fetch('/api/reflections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          date: today,
          mistake,
          done_well: doneWell,
          focus_tomorrow: focusTomorrow
        })
      });
      if (!res.ok) throw new Error('Failed to save reflection');
      onSuccess();
    } catch (e) {
      console.error(e);
      alert("Failed to save reflection.");
    } finally {
      setLoading(false);
    }
  };

  const mistakes = ['None', 'FOMO', 'Revenge Trading', 'Overtrading', 'Moving Stop Loss', 'Ignoring Setup'];
  const focusRules = ['Patience', 'Risk Management', 'Wait for Setup', 'No Revenge Trading', 'Stick to Plan'];

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md"
      />
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-black uppercase tracking-tight">End-of-Day Review</h3>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Biggest discipline mistake today?</label>
            <div className="grid grid-cols-2 gap-2">
              {mistakes.map(opt => (
                <button 
                  key={opt} onClick={() => setMistake(opt)}
                  className={cn(
                    "py-2 rounded-xl text-[10px] font-bold border transition-all",
                    mistake === opt ? "bg-zinc-100 text-zinc-950 border-zinc-100" : "bg-transparent text-zinc-500 border-zinc-800"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">One thing done well today?</label>
            <input 
              type="text" value={doneWell} onChange={e => setDoneWell(e.target.value)}
              placeholder="e.g. Walked away after loss"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">One rule to focus on tomorrow?</label>
            <div className="grid grid-cols-2 gap-2">
              {focusRules.map(opt => (
                <button 
                  key={opt} onClick={() => setFocusTomorrow(opt)}
                  className={cn(
                    "py-2 rounded-xl text-[10px] font-bold border transition-all",
                    focusTomorrow === opt ? "bg-zinc-100 text-zinc-950 border-zinc-100" : "bg-transparent text-zinc-500 border-zinc-800"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button 
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-emerald-500 text-zinc-950 font-bold py-4 rounded-2xl text-sm active:scale-[0.98] transition-all"
        >
          {loading ? "Saving..." : "Save Daily Review"}
        </button>
      </motion.div>
    </div>
  );
}

function ScorePage({ user, lastScore, onBack }: { user: User, lastScore: Score | null, onBack: () => void }) {
  const [notes, setNotes] = useState(lastScore?.notes || '');
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [viewRange, setViewRange] = useState<'7d' | '30d'>('7d');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/stats/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveNotes = async () => {
    if (!lastScore) return;
    setSaving(true);
    try {
      await fetch('/api/scores/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score_id: lastScore.id, notes })
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!lastScore) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
        <Trophy className="w-16 h-16 text-zinc-800" />
        <p className="text-zinc-500">No scores yet. Log a trade to see your discipline score.</p>
        <button onClick={onBack} className="text-emerald-500 font-bold">Live Mode</button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex flex-col gap-6 pb-24"
    >
      <div className="bg-zinc-900 rounded-3xl p-8 text-center border border-zinc-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" style={{ width: `${lastScore.score}%` }} />
        <h3 className="text-zinc-500 uppercase text-xs font-bold tracking-widest mb-2">Discipline Score</h3>
        <div className="text-7xl font-black text-emerald-500 mb-2">{lastScore.score}</div>
        <p className="text-zinc-400 text-sm italic">"{lastScore.feedback}"</p>
        
        {stats && stats.streak > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-xs font-bold">
            <TrendingUp className="w-3 h-3" />
            {stats.streak} DAY STREAK
          </div>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
            <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Most Disciplined Strategy</p>
            <p className="text-sm font-black text-emerald-500 truncate">{stats.mostDisciplinedStrategy}</p>
          </div>
          <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
            <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Most Rule-Broken Strategy</p>
            <p className="text-sm font-black text-rose-500 truncate">{stats.mostRuleBrokenStrategy}</p>
          </div>
        </div>
      )}

      <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Discipline Progress</h3>
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            {(['7d', '30d'] as const).map(r => (
              <button 
                key={r} onClick={() => setViewRange(r)}
                className={cn(
                  "px-3 py-1 rounded-lg text-[10px] font-bold transition-all",
                  viewRange === r ? "bg-zinc-100 text-zinc-950" : "text-zinc-500"
                )}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        
        <div className="h-48 w-full">
          {stats && (viewRange === '7d' ? stats.history7d : stats.history30d) ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={viewRange === '7d' ? stats.history7d : stats.history30d}>
                <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  hide
                />
                <YAxis hide domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px', fontSize: '10px' }}
                  itemStyle={{ color: '#10b981' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  dot={{ fill: '#10b981', r: 4 }}
                  activeDot={{ r: 6, fill: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-600 text-xs italic">
              Not enough data for graph
            </div>
          )}
        </div>
      </div>

      {stats && stats.insights && stats.insights.length > 0 && (
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 space-y-3">
          <h3 className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Discipline Insights</h3>
          <div className="space-y-2">
            {stats.insights.map((insight: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                <div className="w-1 h-1 bg-emerald-500 rounded-full mt-1.5 shrink-0" />
                <p>{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Daily Notes</label>
        <textarea 
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Optional notes about today's discipline..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm focus:border-emerald-500 transition-colors h-24 resize-none"
        />
        {saving && <p className="text-[10px] text-zinc-500 text-right">Saving...</p>}
      </div>

      {stats && stats.certificate.eligible && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <h4 className="text-emerald-500 font-bold text-sm">Discipline Certificate Ready!</h4>
            <p className="text-zinc-500 text-xs">Badge: {stats.certificate.badge}</p>
          </div>
          <button 
            onClick={() => alert(`Certificate (${stats.certificate.badge}) download started! (Simulated)`)}
            className="bg-emerald-500 text-zinc-950 p-2 rounded-xl"
          >
            <Trophy className="w-5 h-5" />
          </button>
        </div>
      )}

      <button 
        onClick={onBack}
        className="w-full bg-zinc-900 text-zinc-100 font-bold py-4 rounded-2xl border border-zinc-800 active:scale-[0.98] transition-all"
      >
        Back to Live Mode
      </button>
    </motion.div>
  );
}

function HistoryPage({ user }: { user: User }) {
  const [trades, setTrades] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tRes, sRes] = await Promise.all([
        fetch(`/api/trades/history/${user.id}`),
        fetch(`/api/stats/${user.id}`)
      ]);
      if (tRes.ok) {
        const tData = await tRes.json();
        setTrades(tData.trades);
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        setStats(sData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    if (!stats) return;
    const report = `
Trading Discipline Weekly Report
User: ${user.name || user.phone}
Avg Score: ${stats.weeklyAvg}
Best Day: ${stats.bestDay}
Worst Day: ${stats.worstDay}
Most Violated: ${stats.mostViolated}

Strategy Insights:
- Most Disciplined: ${stats.mostDisciplinedStrategy}
- Most Rule-Broken: ${stats.mostRuleBrokenStrategy}

Recent Lessons:
${stats.recentLessons && stats.recentLessons.length > 0 
  ? stats.recentLessons.map((l: string) => `- ${l}`).join('\n') 
  : 'No lessons recorded yet.'}
    `;
    window.location.href = `mailto:?subject=Trading Discipline Report&body=${encodeURIComponent(report)}`;
  };

  if (loading) return <div className="flex-1 flex items-center justify-center text-zinc-500">Loading history...</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col gap-6 pb-24"
    >
      {stats && (
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Weekly Report</h3>
            <button onClick={exportReport} className="text-emerald-500 text-xs font-bold flex items-center gap-1">
              Export <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Avg Score</p>
              <p className="text-xl font-black text-emerald-500">{stats.weeklyAvg}</p>
            </div>
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Most Broken</p>
              <p className="text-xs font-bold text-zinc-300 truncate">{stats.mostViolated}</p>
            </div>
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Best Day</p>
              <p className="text-lg font-black text-emerald-500">{stats.bestDay}</p>
            </div>
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Worst Day</p>
              <p className="text-lg font-black text-rose-500">{stats.worstDay}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Trade History</h3>
        {trades.length === 0 ? (
          <p className="text-center text-zinc-500 py-8 text-sm">No trades logged yet.</p>
        ) : (
          trades.map(trade => (
            <div key={trade.id} className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    "text-[10px] font-black px-1.5 py-0.5 rounded",
                    trade.type === 'BUY' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                  )}>{trade.type}</span>
                  <span className="text-xs font-black text-zinc-100">{trade.pair}</span>
                  <span className="text-[10px] font-bold text-zinc-600">[{trade.strategy}]</span>
                  <span className="text-[10px] font-bold text-zinc-500">@{trade.entry_price}</span>
                </div>
                <p className="text-[10px] text-zinc-500">{new Date(trade.created_at).toLocaleDateString()} • {trade.session}</p>
              </div>
              <div className="text-right">
                <div className={cn(
                  "text-xs font-bold",
                  trade.status === 'CLOSED' ? "text-zinc-400" : "text-emerald-500"
                )}>
                  {trade.status}
                </div>
                {trade.pnl !== undefined && (
                  <p className={cn("text-[10px] font-bold", trade.pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {trade.pnl >= 0 ? '+' : ''}{trade.pnl}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

function IdentityPage({ user }: { user: User }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/stats/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center text-zinc-500">Loading identity...</div>;

  const evolutionColors: any = {
    'Professional': 'text-emerald-500',
    'Consistent': 'text-blue-500',
    'Controlled': 'text-amber-500',
    'Aware': 'text-zinc-400',
    'Undisciplined': 'text-rose-500'
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex flex-col gap-6 pb-24"
    >
      <div className="text-center space-y-2 mb-4">
        <h2 className="text-4xl font-black text-zinc-100">{user.name}</h2>
        <div className={cn("text-xs font-black uppercase tracking-widest", evolutionColors[stats?.evolution])}>
          {stats?.evolution} Level
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900 rounded-3xl p-6 text-center border border-zinc-800">
          <h3 className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest mb-2">Professional Points</h3>
          <div className="text-4xl font-black text-emerald-500">{stats?.pp}</div>
          <p className="text-[10px] text-zinc-500 mt-1">Lifetime PP</p>
        </div>
        <div className="bg-zinc-900 rounded-3xl p-6 text-center border border-zinc-800">
          <h3 className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest mb-2">30-Day Avg</h3>
          <div className="text-4xl font-black text-zinc-100">{stats?.thirtyDayAvg}</div>
          <p className={cn("text-[10px] mt-1 font-bold", stats?.trend === 'Improving' ? 'text-emerald-500' : stats?.trend === 'Declining' ? 'text-rose-500' : 'text-zinc-500')}>
            {stats?.trend} Trend
          </p>
        </div>
      </div>

      {stats && (
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 space-y-4">
          <h3 className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Strategy Discipline</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Most Disciplined</p>
              <p className="text-xs font-black text-emerald-500 truncate">{stats.mostDisciplinedStrategy}</p>
            </div>
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Most Rule-Broken</p>
              <p className="text-xs font-black text-rose-500 truncate">{stats.mostRuleBrokenStrategy}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">30-Day Progress</h3>
          <span className="text-[10px] text-zinc-500 italic">Consistency is key</span>
        </div>
        <div className="flex items-end gap-1 h-20">
          {stats?.thirtyDayScores.map((s: any, i: number) => (
            <div 
              key={i} 
              className={cn(
                "flex-1 rounded-t-sm transition-all",
                s.score >= 90 ? "bg-emerald-500" : s.score >= 75 ? "bg-emerald-500/60" : s.score >= 60 ? "bg-amber-500/60" : "bg-rose-500/60"
              )}
              style={{ height: `${s.score}%` }}
            />
          ))}
          {stats?.thirtyDayScores.length === 0 && (
            <div className="w-full h-full flex items-center justify-center border border-dashed border-zinc-800 rounded-xl">
              <p className="text-[10px] text-zinc-600">No data yet</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 space-y-3">
        <h3 className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Identity Reinforcement</h3>
        <p className="text-sm text-zinc-300 italic">
          {stats?.thirtyDayAvg >= 80 ? "Professional habits forming. You are becoming more controlled." : 
           stats?.trend === 'Improving' ? "Your discipline is improving week over week. Stay the course." :
           "Discipline is a muscle. Train it daily. Focus on the process, not the outcome."}
        </p>
      </div>

      <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 space-y-4">
        <h3 className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Evolution Milestones</h3>
        <div className="space-y-4">
          {[
            { level: 'Aware', min: 60 },
            { level: 'Controlled', min: 70 },
            { level: 'Consistent', min: 80 },
            { level: 'Professional', min: 90 }
          ].map(m => (
            <div key={m.level} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center border",
                  stats?.thirtyDayAvg >= m.min ? "bg-emerald-500 border-emerald-500 text-zinc-950" : "bg-zinc-950 border-zinc-800 text-zinc-700"
                )}>
                  {stats?.thirtyDayAvg >= m.min ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-[10px] font-bold">{m.min}</span>}
                </div>
                <span className={cn("text-xs font-bold", stats?.thirtyDayAvg >= m.min ? "text-zinc-100" : "text-zinc-700")}>{m.level}</span>
              </div>
              {stats?.thirtyDayAvg < m.min && (
                <span className="text-[10px] text-zinc-700">+{m.min - stats?.thirtyDayAvg} pts needed</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function ProfilePage({ user, onUpdate, onPhilosophy }: { user: User, onUpdate: (u: User) => void, onPhilosophy: () => void }) {
  const [name, setName] = useState(user.name || '');
  const [planned, setPlanned] = useState(user.monthly_planned || 20);
  const [notifs, setNotifs] = useState(user.notifications_enabled === 1);
  const [startHour, setStartHour] = useState(user.trading_start_hour || 8);
  const [endHour, setEndHour] = useState(user.trading_end_hour || 17);
  const [timezone, setTimezone] = useState(user.timezone || 'UTC');
  const [loading, setLoading] = useState(false);

  const requestPermission = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotifs(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/users/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: user.id, 
          name, 
          monthly_planned: planned,
          notifications_enabled: notifs ? 1 : 0,
          trading_start_hour: startHour,
          trading_end_hour: endHour,
          timezone
        })
      });
      if (res.ok) {
        const data = await res.json();
        onUpdate(data.user);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col gap-6"
    >
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Profile</h2>
        <p className="text-zinc-500 text-sm">Set your trading identity and goals.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-2">Trader Name</label>
          <input 
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Your Name"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-lg focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-2">Monthly Planned Trades</label>
          <input 
            type="number" value={planned} onChange={(e) => setPlanned(parseInt(e.target.value) || 0)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-lg font-mono focus:border-emerald-500 transition-colors"
          />
          <p className="text-[10px] text-zinc-500 ml-2 italic">Used to calculate your Monthly Discipline %.</p>
        </div>

        <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-500" />
                Discipline Reminders
              </h3>
              <p className="text-[10px] text-zinc-500">Accountability notifications based on your data.</p>
            </div>
            <button 
              type="button"
              onClick={() => notifs ? setNotifs(false) : requestPermission()}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative",
                notifs ? "bg-emerald-500" : "bg-zinc-800"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                notifs ? "left-7" : "left-1"
              )} />
            </button>
          </div>

          {notifs && (
            <div className="space-y-4 pt-4 border-t border-zinc-800">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Trading Start</label>
                  <select 
                    value={startHour} onChange={(e) => setStartHour(parseInt(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-sm"
                  >
                    {Array.from({ length: 24 }).map((_, i) => (
                      <option key={i} value={i}>{i}:00</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Trading End</label>
                  <select 
                    value={endHour} onChange={(e) => setEndHour(parseInt(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-sm"
                  >
                    {Array.from({ length: 24 }).map((_, i) => (
                      <option key={i} value={i}>{i}:00</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Timezone</label>
                <select 
                  value={timezone} onChange={(e) => setTimezone(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-sm"
                >
                  {['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo', 'Asia/Dubai', 'Asia/Kolkata', 'Australia/Sydney'].map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-zinc-500 italic">Checks for inactivity after trading hours.</p>
            </div>
          )}
        </div>

        <button 
          disabled={loading}
          className="w-full bg-zinc-100 text-zinc-950 font-bold py-4 rounded-2xl text-lg active:scale-[0.98] transition-all"
        >
          {loading ? "Saving..." : "Save Settings"}
        </button>
      </form>

      <div className="pt-6 border-t border-zinc-900">
        <button 
          onClick={onPhilosophy}
          className="w-full flex items-center justify-between p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <span className="text-sm font-bold">App Philosophy</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

function NotificationsModal({ notifications, onClose }: { notifications: any[], onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md"
      />
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[80vh]"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-black uppercase tracking-tight">Accountability Alerts</h3>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          {notifications.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <BellOff className="w-12 h-12 text-zinc-800 mx-auto" />
              <p className="text-zinc-500 text-sm font-bold">No alerts yet. Stay disciplined.</p>
            </div>
          ) : (
            notifications.map(n => (
              <div key={n.id} className={cn(
                "p-4 rounded-2xl border transition-all",
                n.is_read ? "bg-zinc-950/50 border-zinc-800/50 opacity-60" : "bg-zinc-950 border-zinc-800"
              )}>
                <div className="flex justify-between items-start mb-2">
                  <span className={cn(
                    "text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest",
                    n.type === 'INACTIVITY' ? "bg-rose-500/10 text-rose-500" : 
                    n.type === 'SCORE_DROP' ? "bg-amber-500/10 text-amber-500" : 
                    "bg-emerald-500/10 text-emerald-500"
                  )}>{n.type.replace('_', ' ')}</span>
                  <span className="text-[10px] text-zinc-600">{new Date(n.sent_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm font-medium text-zinc-300 leading-relaxed">{n.message}</p>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
function PhilosophyPage({ onBack }: { onBack: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex-1 flex flex-col gap-8 pb-12"
    >
      <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 text-sm font-bold">
        <ChevronRight className="w-4 h-4 rotate-180" /> Back
      </button>

      <div className="space-y-4">
        <h2 className="text-3xl font-black">Philosophy</h2>
        <p className="text-zinc-400 leading-relaxed">
          This app trains discipline like a muscle. Progress is slow, earned, and permanent.
        </p>
      </div>

      <div className="space-y-6">
        <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 space-y-2">
          <h3 className="text-emerald-500 font-bold uppercase text-xs tracking-widest">Long-Term Usage</h3>
          <p className="text-sm text-zinc-300">
            Professional trading is not about one good day. It is about 1,000 disciplined days. We track your rolling 30-day consistency to show you the truth.
          </p>
        </div>

        <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 space-y-2">
          <h3 className="text-emerald-500 font-bold uppercase text-xs tracking-widest">Identity Change</h3>
          <p className="text-sm text-zinc-300">
            You are not "trying" to be disciplined. You are BECOMING a disciplined trader. Your Evolution Level reflects this transformation.
          </p>
        </div>

        <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 space-y-2">
          <h3 className="text-emerald-500 font-bold uppercase text-xs tracking-widest">Professional Mindset</h3>
          <p className="text-sm text-zinc-300">
            Professional Points (PP) are earned through consistency and lost through recklessness. They represent your "skin in the game" over months and years.
          </p>
        </div>
      </div>

      <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl text-center">
        <p className="text-xs text-emerald-500/60 italic font-medium">
          "The goal is not to be right. The goal is to follow the process."
        </p>
      </div>
    </motion.div>
  );
}
