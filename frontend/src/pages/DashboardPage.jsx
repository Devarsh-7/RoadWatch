import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Link } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import PageTransition from '../components/PageTransition';
import { fetchStats, fetchRoads, fetchTrendingComplaints, getDeviceId } from '../api';
import ComplaintActionWidget from '../components/ComplaintActionWidget';

const PIE_COLORS = { Good: '#34D399', Fair: '#FBBF24', Poor: '#F87171' };
const DISTRICT_COLORS = ['#818CF8', '#52B788', '#FFD166', '#F87171', '#EC4899'];

// Setup Leaflet markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* ── AnimatedNumber ───────── */
function AnimNum({ target, suffix = '' }) {
  const [val, setVal] = useState(0);
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.5 });
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / 2000, 1);
      setVal(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

function StatCard({ label, value, suffix, icon, trend, delay }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay, duration: 0.5 }} className="glass p-6 glow-green-hover group">
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-secondary"><path d={icon} /></svg>
        </div>
        {trend && <span className="badge badge-good text-[0.6rem]">{trend}</span>}
      </div>
      <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold font-heading"><AnimNum target={value} suffix={suffix} /></p>
    </motion.div>
  );
}

const tooltipStyle = { backgroundColor: '#0E1525', border: '1px solid rgba(82,183,136,0.2)', borderRadius: '12px', color: '#F1F5F9', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' };

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [roads, setRoads] = useState([]);
  const [trending, setTrending] = useState([]);
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'civic_portal'
  const [loading, setLoading] = useState(true);

  // Mock User Stats for Gamification Profile
  const [userProfile, setUserProfile] = useState({
    username: 'Citizen Vigilante',
    level: 4,
    levelName: 'Civic Sentinel',
    trustScore: 98,
    upvotesGiven: 18,
    issuesAudited: 9,
    resolvedContributions: 4,
    badges: [
      { id: 'patrol', name: 'Pothole Patrol', icon: '🔍', desc: 'Reported or confirmed over 5 road damage issues.' },
      { id: 'auditor', name: 'Citizen Auditor', icon: '📋', desc: 'Contributed 5+ verifications to other citizen complaints.' },
      { id: 'first_resp', name: 'First Responder', icon: '🥇', desc: 'First to verify a critical-level pothole.' },
      { id: 'resolved', name: 'Civic Enforcer', icon: '🛡️', desc: 'Participated in a complaint that community action successfully resolved.' }
    ]
  });

  // Mock Leaderboard
  const leaderboard = [
    { rank: 1, name: 'Ananya Sharma', trust: 99, audits: 37, badge: '👑 Elite Sentinel' },
    { rank: 2, name: 'Rahul Deshmukh', trust: 96, audits: 24, badge: '🛡️ Vigilante' },
    { rank: 3, name: 'Citizen Vigilante (You)', trust: 98, audits: 18, badge: '🔍 Inspector' },
    { rank: 4, name: 'Vikram Singh', trust: 92, audits: 15, badge: '⚡ Contributor' },
    { rank: 5, name: 'Pooja Iyer', trust: 91, audits: 11, badge: '🌱 Active Member' }
  ];

  const loadAllData = async () => {
    try {
      const [statsRes, roadsRes, trendRes] = await Promise.all([
        fetchStats(),
        fetchRoads(),
        fetchTrendingComplaints()
      ]);
      setStats(statsRes.data);
      setRoads(roadsRes.data);
      setTrending(trendRes.data);
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadAllData();
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div className="min-h-screen pt-32 pb-20"><div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 space-y-6">
      <div className="skeleton h-10 w-1/3 mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass p-6 h-32"><div className="skeleton h-8 w-1/2 mb-4" /><div className="skeleton h-5 w-3/4" /></div>)}
      </div>
    </div></div>
  );

  if (!stats) return null;

  const pieData = Object.entries(stats.condition_distribution).map(([name, value]) => ({ name, value }));
  const utilization = Math.round((stats.total_budget_spent / stats.total_budget_sanctioned) * 100);

  return (
    <PageTransition>
      <div className="min-h-screen pt-32 pb-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold font-heading">RoadWatch Analytics Hub</h1>
              <p className="text-text-secondary text-sm mt-1">Real-time civic accountability and road infrastructure intelligence</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Tab Selector */}
              <div className="flex bg-surface border border-white/5 rounded-2xl p-1 shrink-0">
                <button 
                  onClick={() => setActiveTab('analytics')}
                  className={`py-2.5 px-5 rounded-xl text-xs font-bold font-heading cursor-pointer transition-all ${activeTab === 'analytics' ? 'bg-secondary text-bg shadow-lg shadow-secondary/20' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  Infrastructure Analytics
                </button>
                <button 
                  onClick={() => setActiveTab('civic_portal')}
                  className={`py-2.5 px-5 rounded-xl text-xs font-bold font-heading cursor-pointer transition-all ${activeTab === 'civic_portal' ? 'bg-secondary text-bg shadow-lg shadow-secondary/20' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  Citizen Hub & Badges
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="pulse-live" />
                <span className="text-text-secondary text-xs font-medium">Live Stream</span>
              </div>
            </div>
          </motion.div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
            <StatCard label="Total Roads" value={stats.total_roads} suffix="" icon="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" trend="+20 this year" delay={0} />
            <StatCard label="Budget Tracked" value={Math.round(stats.total_budget_sanctioned)} suffix=" Cr" icon="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" delay={0.1} />
            <StatCard label="Community Audits" value={stats.total_votes_cast + stats.total_verifications} suffix="" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" trend={`${stats.resolution_ratio}% resolved`} delay={0.2} />
            <StatCard label="Needing Repair" value={stats.roads_needing_repair} suffix="" icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" trend="High severity" delay={0.3} />
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'analytics' ? (
              <motion.div 
                key="analytics_tab"
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                {/* Advanced Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Budget by State & Most Reported Roads */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Budget by State */}
                    <div className="glass p-6">
                      <h2 className="font-heading font-semibold text-lg mb-1">Statewise Infrastructure Spend</h2>
                      <p className="text-text-secondary text-xs mb-6">Sanctioned vs Disbursed Budgets (₹ Crores)</p>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={stats.budget_by_state} barGap={4}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="state" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={tooltipStyle} formatter={(v) => `₹${v} Cr`} cursor={{ fill: 'rgba(82,183,136,0.05)' }} />
                          <Legend wrapperStyle={{ color: '#94A3B8', fontSize: 12 }} />
                          <Bar dataKey="sanctioned" fill="#2D6A4F" radius={[6, 6, 0, 0]} name="Sanctioned" />
                          <Bar dataKey="spent" fill="#52B788" radius={[6, 6, 0, 0]} name="Spent" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Most Reported Roads */}
                    <div className="glass p-6">
                      <h2 className="font-heading font-semibold text-lg mb-1">Most Reported Road Sections</h2>
                      <p className="text-text-secondary text-xs mb-6">Top stretches highlighted by citizens for systemic issues</p>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={stats.most_reported_roads} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis type="number" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis dataKey="road_name" type="category" width={150} tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="count" fill="#FFD166" radius={[0, 6, 6, 0]} name="Complaints Filed" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Right Column: Road Condition & Affected Districts */}
                  <div className="space-y-6">
                    {/* Condition pie chart */}
                    <div className="glass p-6">
                      <h2 className="font-heading font-semibold text-lg mb-1">Infrastructure Health</h2>
                      <p className="text-text-secondary text-xs mb-4">Distribution across all logged segments</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`} stroke="none">
                            {pieData.map((e) => <Cell key={e.name} fill={PIE_COLORS[e.name] || '#6B7280'} />)}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex justify-center gap-4 mt-2">
                        {pieData.map((e) => (
                          <div key={e.name} className="flex items-center gap-1.5 text-xs">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[e.name] }} />
                            <span className="text-text-secondary">{e.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top Affected Districts */}
                    <div className="glass p-6">
                      <h2 className="font-heading font-semibold text-lg mb-1">Top Distress Zones</h2>
                      <p className="text-text-secondary text-xs mb-4">Districts experiencing highest audit failures</p>
                      <div className="space-y-4">
                        {stats.top_districts.map((item, idx) => (
                          <div key={item.district} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-medium">
                              <span>{item.district}</span>
                              <span className="text-secondary font-bold">{item.count} Active</span>
                            </div>
                            <div className="h-2 rounded-full bg-surface-light/40 overflow-hidden">
                              <div 
                                className="h-full rounded-full" 
                                style={{ 
                                  width: `${(item.count / (stats.top_districts[0]?.count || 1)) * 100}%`,
                                  background: DISTRICT_COLORS[idx % DISTRICT_COLORS.length]
                                }} 
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Coverage Map + Budget Utilization Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Coverage Map */}
                  <div className="glass p-4 overflow-hidden">
                    <h2 className="font-heading font-semibold text-lg mb-4 px-2">Distress Map</h2>
                    <div className="h-72 rounded-2xl overflow-hidden">
                      <MapContainer center={[18.52, 73.85]} zoom={5} className="h-full w-full" scrollWheelZoom={false}>
                        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        
                        {/* Interactive Pins on Dashboard Map */}
                        {trending.filter(c => c.latitude && c.longitude).map(c => {
                          const color = c.priority_score > 50 ? '#EF4444' : c.priority_score >= 31 ? '#F97316' : c.priority_score >= 16 ? '#FBBF24' : '#10B981';
                          const divIcon = L.divIcon({
                            html: `<div style="width: 12px; height: 12px; background: ${color}; border-radius: 50%; border: 1.5px solid #fff; box-shadow: 0 0 8px ${color};"></div>`,
                            className: 'dashboard-complaint-dot',
                            iconSize: [12, 12]
                          });

                          return (
                            <Marker key={c.id} position={[c.latitude, c.longitude]} icon={divIcon}>
                              <Popup>
                                <div className="text-text-primary p-0.5">
                                  <h4 className="font-heading font-bold text-xs m-0 text-secondary">{c.issue_type}</h4>
                                  <p className="text-[10px] text-text-secondary m-0 mt-1">{c.description || 'No details'}</p>
                                  <div className="mt-2.5 pt-1 border-t border-white/5 flex items-center justify-between text-[9px]">
                                    <Link to={`/road/${c.road_id}`} className="text-secondary hover:text-accent font-bold">Investigate Stretch</Link>
                                    <span className="text-accent font-bold">Score: {c.priority_score}</span>
                                  </div>
                                </div>
                              </Popup>
                            </Marker>
                          );
                        })}
                      </MapContainer>
                    </div>
                  </div>

                  {/* Budget Utilization Summary */}
                  <div className="glass p-6">
                    <h2 className="font-heading font-semibold text-lg mb-6">Finances & Utilization</h2>
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between text-sm mb-2"><span className="text-text-secondary">Overall Budget Utilized</span><span className="font-bold text-text-primary">{utilization}%</span></div>
                        <div className="progress-bar h-4"><div className="progress-fill" style={{ width: `${utilization}%` }} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-surface-light/50 border border-white/5">
                          <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Sanctioned</p>
                          <p className="text-xl font-bold font-heading text-accent">₹{stats.total_budget_sanctioned} Cr</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-surface-light/50 border border-white/5">
                          <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Spent</p>
                          <p className="text-xl font-bold font-heading text-secondary">₹{stats.total_budget_spent} Cr</p>
                        </div>
                      </div>
                      <div className="p-4 rounded-2xl bg-surface-light/50 border border-white/5 flex justify-between items-center">
                        <div>
                          <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Disbursed Balance</p>
                          <p className="text-xl font-bold font-heading text-text-primary">₹{(stats.total_budget_sanctioned - stats.total_budget_spent).toFixed(1)} Cr</p>
                        </div>
                        <span className="badge badge-nh">RTI Audit Approved</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="civic_portal_tab"
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -15 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                {/* Left Columns: Citizen profile, leaderboard */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Citizen Profile Card */}
                  <div className="glass p-6 relative overflow-hidden bg-gradient-to-br from-surface to-surface-light/40 border-secondary/25 shadow-lg">
                    {/* Badge holograms */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-secondary/5 rounded-full filter blur-3xl pointer-events-none" />

                    <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between mb-6 pb-6 border-b border-white/5">
                      <div className="flex gap-4 items-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary to-primary-light flex items-center justify-center text-bg text-3xl font-heading font-extrabold shadow-lg shadow-secondary/30">
                          {userProfile.username.charAt(0)}
                        </div>
                        <div>
                          <h2 className="font-heading font-bold text-xl">{userProfile.username}</h2>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="badge badge-sh text-[0.6rem] font-bold">LVL {userProfile.level}</span>
                            <span className="text-secondary text-xs font-semibold">{userProfile.levelName}</span>
                          </div>
                        </div>
                      </div>

                      {/* Citizen Trust Rating Ring */}
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[0.6rem] text-text-secondary uppercase tracking-wider leading-none">Citizen Trust</p>
                          <p className="text-lg font-bold font-heading text-secondary">{userProfile.trustScore}%</p>
                        </div>
                        <div className="w-11 h-11 rounded-full bg-secondary/15 border border-secondary/20 flex items-center justify-center font-heading font-extrabold text-sm text-secondary">
                          {userProfile.trustScore}
                        </div>
                      </div>
                    </div>

                    {/* Stats Metrics */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="p-3.5 rounded-xl bg-surface-light/50 border border-white/5 text-center">
                        <p className="text-[0.6rem] text-text-secondary uppercase tracking-wider mb-1">Upvotes Cast</p>
                        <p className="text-xl font-bold font-heading text-text-primary">{userProfile.upvotesGiven}</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-surface-light/50 border border-white/5 text-center">
                        <p className="text-[0.6rem] text-text-secondary uppercase tracking-wider mb-1">Audits Verified</p>
                        <p className="text-xl font-bold font-heading text-secondary">{userProfile.issuesAudited}</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-surface-light/50 border border-white/5 text-center">
                        <p className="text-[0.6rem] text-text-secondary uppercase tracking-wider mb-1">Resolved Stretches</p>
                        <p className="text-xl font-bold font-heading text-accent">{userProfile.resolvedContributions}</p>
                      </div>
                    </div>

                    {/* Contribution Badges */}
                    <div>
                      <h3 className="font-heading font-semibold text-sm mb-4">My Earned Badges</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {userProfile.badges.map((b) => (
                          <div key={b.id} className="p-3.5 rounded-xl bg-surface-light/40 border border-white/5 flex gap-3 group hover:border-secondary/20 hover:bg-surface-light/60 transition-colors">
                            <div className="text-2xl shrink-0 filter drop-shadow-[0_2px_4px_rgba(82,183,136,0.3)]">{b.icon}</div>
                            <div>
                              <p className="text-xs font-bold font-heading text-text-primary leading-tight">{b.name}</p>
                              <p className="text-[0.65rem] text-text-secondary leading-normal mt-0.5">{b.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Leaderboard of Top Contributors */}
                  <div className="glass p-6">
                    <h2 className="font-heading font-semibold text-lg mb-1">Civic Sentinel Leaderboard</h2>
                    <p className="text-text-secondary text-xs mb-6">Top community auditors ranked by verified contributions and trust</p>
                    <div className="space-y-2">
                      {leaderboard.map((item, index) => {
                        const isSelf = item.name.includes('(You)');
                        return (
                          <div 
                            key={index} 
                            className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-colors ${
                              isSelf 
                                ? 'bg-secondary/10 border-secondary/30 text-secondary' 
                                : 'bg-surface-light/20 border-white/5 hover:bg-surface-light/40'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`font-heading font-bold text-sm w-5 text-center ${index === 0 ? 'text-accent' : 'text-text-secondary'}`}>
                                {item.rank}
                              </span>
                              <div className="truncate">
                                <p className="text-xs font-bold truncate leading-none">{item.name}</p>
                                <p className="text-[0.6rem] text-text-secondary mt-1">{item.badge}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 shrink-0 text-right">
                              <div>
                                <p className="text-[0.55rem] text-text-secondary uppercase tracking-wider">Audited</p>
                                <p className="text-xs font-bold font-heading">{item.audits}</p>
                              </div>
                              <div>
                                <p className="text-[0.55rem] text-text-secondary uppercase tracking-wider">Trust</p>
                                <p className="text-xs font-bold font-heading text-secondary">{item.trust}%</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Trending Complaints Feed */}
                <div className="space-y-6">
                  <div className="glass p-6">
                    <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                      <div>
                        <h2 className="font-heading font-semibold text-lg">Trending Feed</h2>
                        <p className="text-text-secondary text-xs">Community-supported road issues</p>
                      </div>
                      <span className="badge badge-nh">Active</span>
                    </div>

                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                      {trending.length > 0 ? (
                        trending.map((comp) => (
                          <ComplaintActionWidget 
                            key={comp.id} 
                            complaint={comp} 
                            onUpdate={loadAllData} 
                          />
                        ))
                      ) : (
                        <p className="text-text-secondary text-xs text-center py-10">No active complaints on hot roads right now.</p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}
