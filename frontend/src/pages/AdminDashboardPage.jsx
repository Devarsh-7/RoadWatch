import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from 'react-leaflet';
import axios from 'axios';
import AdminExitHeader from '../components/AdminExitHeader';

// Map Tiles (OpenStreetMap - Free & No API key needed)
const DARK_MAP_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminRole, setAdminRole] = useState('');
  const [adminScope, setAdminScope] = useState({ state: '', district: '' });

  // Data States
  const [metrics, setMetrics] = useState({});
  const [budgetByState, setBudgetByState] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [roads, setRoads] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [budgetData, setBudgetData] = useState({ project_allocations: [], anomalies: [] });
  const [aiInsights, setAiInsights] = useState({ deterioration_predictions: [], suspicious_budget_utilization: [], hotspots: [] });
  const [notifications, setNotifications] = useState([]);
  const [analytics, setAnalytics] = useState({ district_rankings: [], department_scorecard: {} });
  
  // Interactive Filters
  const [filters, setFilters] = useState({
    state: '',
    district: '',
    roadType: '',
    severity: '',
    status: ''
  });

  // Action Modals States
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);
  const [remarkModalOpen, setRemarkModalOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [escalateTo, setEscalateTo] = useState('District Collector');
  const [actionNotes, setActionNotes] = useState('');
  const [remarkMessage, setRemarkMessage] = useState('');
  const [repairModalOpen, setRepairModalOpen] = useState(false);
  
  // New Repair Project Form
  const [newRepair, setNewRepair] = useState({
    road_id: '',
    contractor_name: 'L&T Infrastructure',
    contractor_contact: '+91 44 2345 6789',
    repair_cost: 45.0,
    expected_completion: '',
    notes: ''
  });

  // Sidebar Open
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const API_BASE = import.meta.env.VITE_API_URL || '';

  // Token validation helper
  const isTokenValid = (token) => {
    if (!token) return false;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.exp && payload.exp * 1000 <= Date.now()) {
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  };

  const clearSessionAndRedirect = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_role');
    localStorage.removeItem('admin_name');
    localStorage.removeItem('admin_state');
    localStorage.removeItem('admin_district');
    navigate('/admin-login');
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (token) {
        await axios.post(`${API_BASE}/api/admin/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (e) {
      // Proceed with client logout even if network request fails
    }
    clearSessionAndRedirect();
  };

  // Auth check, session monitoring, and initial load
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const role = localStorage.getItem('admin_role');
    const name = localStorage.getItem('admin_name');
    const state = localStorage.getItem('admin_state');
    const district = localStorage.getItem('admin_district');

    if (!token || !role || !isTokenValid(token)) {
      clearSessionAndRedirect();
      return;
    }

    setAdminName(name || '');
    setAdminRole(role || '');
    setAdminScope({ state: state || '', district: district || '' });
    
    // Auto-fill filters with scope restrictions
    setFilters(prev => ({
      ...prev,
      state: state || '',
      district: district || ''
    }));

    fetchAllData(token);

    // Periodic session expiration monitor (checks every 30 seconds)
    const sessionTimer = setInterval(() => {
      const activeToken = localStorage.getItem('admin_token');
      if (!isTokenValid(activeToken)) {
        clearInterval(sessionTimer);
        clearSessionAndRedirect();
      }
    }, 30000);

    // Axios interceptor for 401 unauthorized / expired session
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          clearSessionAndRedirect();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      clearInterval(sessionTimer);
      axios.interceptors.response.eject(interceptor);
    };
  }, [navigate]);

  const getHeaders = (token = null) => {
    const activeToken = token || localStorage.getItem('admin_token');
    return {
      headers: { Authorization: `Bearer ${activeToken}` }
    };
  };

  const fetchAllData = async (token) => {
    setLoading(true);
    setError('');
    try {
      const headers = getHeaders(token);
      
      // Fetch core and secondary data streams in parallel
      const [
        dashRes,
        compRes,
        roadsRes,
        repairsRes,
        contrRes,
        budgetRes,
        aiRes,
        notRes,
        alyRes
      ] = await Promise.allSettled([
        axios.get(`${API_BASE}/api/admin/dashboard`, headers),
        axios.get(`${API_BASE}/api/admin/complaints`, headers),
        axios.get(`${API_BASE}/api/roads`, headers),
        axios.get(`${API_BASE}/api/repairs/dashboard`, headers),
        axios.get(`${API_BASE}/api/admin/contracts`, headers),
        axios.get(`${API_BASE}/api/admin/budget`, headers),
        axios.get(`${API_BASE}/api/admin/ai-insights`, headers),
        axios.get(`${API_BASE}/api/admin/notifications`, headers),
        axios.get(`${API_BASE}/api/admin/analytics`, headers),
      ]);

      if (dashRes.status === 'fulfilled') {
        setMetrics(dashRes.value.data.metrics);
        setBudgetByState(dashRes.value.data.budget_by_state);
      }
      if (compRes.status === 'fulfilled') setComplaints(compRes.value.data);
      if (roadsRes.status === 'fulfilled') setRoads(roadsRes.value.data);
      if (repairsRes.status === 'fulfilled') setRepairs(repairsRes.value.data.district_wise_activity || []);
      if (contrRes.status === 'fulfilled') setContractors(contrRes.value.data);
      if (budgetRes.status === 'fulfilled') setBudgetData(budgetRes.value.data);
      if (aiRes.status === 'fulfilled') setAiInsights(aiRes.value.data);
      if (notRes.status === 'fulfilled') setNotifications(notRes.value.data);
      if (alyRes.status === 'fulfilled') setAnalytics(alyRes.value.data);

      // If the primary dashboard metrics request failed, surface the error
      if (dashRes.status === 'rejected') {
        const err = dashRes.reason;
        if (err.response?.status === 401 || err.response?.status === 403) {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_role');
          localStorage.removeItem('admin_name');
          localStorage.removeItem('admin_state');
          localStorage.removeItem('admin_district');
          navigate('/admin-login');
          return;
        }
        throw err;
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_role');
        localStorage.removeItem('admin_name');
        localStorage.removeItem('admin_state');
        localStorage.removeItem('admin_district');
        navigate('/admin-login');
        return;
      }
      const fallbackDetail = API_BASE ? `Please verify backend availability at ${API_BASE}` : 'Please verify uvicorn backend connection on port 8000.';
      setError(`Failed to fetch administrative data streams: ${err.message}. Status: ${err.response?.status || 'Network Error'}. Detail: ${err.response?.data?.detail || fallbackDetail}`);
    } finally {
      setLoading(false);
    }
  };


  // Handle complaint filters
  const handleFilterChange = async (e) => {
    const { name, value } = e.target;
    const newFilters = { ...filters, [name]: value };
    setFilters(newFilters);

    try {
      const headers = getHeaders();
      const response = await axios.get(`${API_BASE}/api/admin/complaints`, {
        ...headers,
        params: {
          state: newFilters.state || undefined,
          district: newFilters.district || undefined,
          road_type: newFilters.roadType || undefined,
          severity: newFilters.severity || undefined,
          status: newFilters.status || undefined
        }
      });
      setComplaints(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Assign Complaint API Action
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assigneeId) return;

    try {
      const headers = getHeaders();
      await axios.post(`${API_BASE}/api/admin/complaints/${selectedComplaint.id}/assign`, {
        officer_id: parseInt(assigneeId),
        notes: actionNotes
      }, headers);

      setAssignModalOpen(false);
      setAssigneeId('');
      setActionNotes('');
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Assignment failed.');
    }
  };

  // Escalate Complaint API Action
  const handleEscalateSubmit = async (e) => {
    e.preventDefault();
    try {
      const headers = getHeaders();
      await axios.post(`${API_BASE}/api/admin/complaints/${selectedComplaint.id}/escalate`, {
        escalated_to: escalateTo,
        reason: actionNotes
      }, headers);

      setEscalateModalOpen(false);
      setEscalateTo('District Collector');
      setActionNotes('');
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Escalation failed.');
    }
  };

  // Citizen Response Remark API Action
  const handleRemarkSubmit = async (e) => {
    e.preventDefault();
    if (!remarkMessage) return;

    try {
      const headers = getHeaders();
      await axios.post(`${API_BASE}/api/admin/citizen-response`, {
        complaint_id: selectedComplaint.id,
        message: remarkMessage
      }, headers);

      setRemarkModalOpen(false);
      setRemarkMessage('');
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit response.');
    }
  };

  // Create Repair Campaign Action
  const handleRepairSubmit = async (e) => {
    e.preventDefault();
    if (!newRepair.road_id) return;

    try {
      const headers = getHeaders();
      await axios.post(`${API_BASE}/api/admin/repairs/create`, {
        road_id: parseInt(newRepair.road_id),
        contractor_name: newRepair.contractor_name,
        contractor_contact: newRepair.contractor_contact,
        repair_cost: parseFloat(newRepair.repair_cost),
        expected_completion: newRepair.expected_completion ? new Date(newRepair.expected_completion).toISOString() : undefined,
        notes: newRepair.notes
      }, headers);

      setRepairModalOpen(false);
      setNewRepair({
        road_id: '',
        contractor_name: 'L&T Infrastructure',
        contractor_contact: '+91 44 2345 6789',
        repair_cost: 45.0,
        expected_completion: '',
        notes: ''
      });
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to authorize repair project.');
    }
  };

  // Simulated PDF export function
  const handleExport = async (format, type) => {
    try {
      const headers = getHeaders();
      const res = await axios.get(`${API_BASE}/api/admin/reports/export`, {
        ...headers,
        params: { format, report_type: type }
      });
      
      const { filename, data_url } = res.data;
      
      // Simulate file download trigger in browser
      const element = document.createElement("a");
      const file = new Blob([data_url], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = filename;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (err) {
      alert('Report generation failed.');
    }
  };

  // Simulated interactive maps polyline positions (Salem approach NH-44)
  const ROAD_MARKERS = [
    { id: 1, name: 'NH-44 Chennai-Madurai', coords: [13.0827, 80.2707], condition: 'Good', score: 94 },
    { id: 2, name: 'SH-68 Salem-Namakkal', coords: [11.6643, 78.1460], condition: 'Poor', score: 25 },
    { id: 3, name: 'MDR-127 Thanjavur Kumbakonam', coords: [10.7867, 79.1378], condition: 'Poor', score: 15 },
    { id: 4, name: 'NH-19 Agra-Lucknow', coords: [27.1767, 78.0081], condition: 'Good', score: 88 },
    { id: 5, name: 'NH-75 Bengaluru-Mangaluru', coords: [12.9716, 77.5946], condition: 'Good', score: 90 },
  ];

  // Helper colors for condition
  const getConditionColor = (cond) => {
    if (cond === 'Good') return '#10B981';
    if (cond === 'Fair') return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col lg:flex-row p-0 lg:p-5 gap-0 lg:gap-5 relative overflow-hidden lg:h-screen w-full">
      
      <aside className={`glass-strong border border-white/5 bg-surface/90 backdrop-blur-2xl z-50 transition-all duration-300 flex flex-col fixed lg:relative inset-y-0 left-0 lg:h-full h-screen ${sidebarOpen ? 'w-full lg:w-72 translate-x-0 rounded-none lg:rounded-2xl' : 'w-0 lg:w-20 overflow-hidden -translate-x-full lg:translate-x-0 rounded-none lg:rounded-2xl'}`}>
        {/* Brand header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-heading font-bold text-white text-base">RW</div>
            {sidebarOpen && <span className="font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-text-secondary text-sm tracking-wider uppercase">Command Portal</span>}
          </div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-text-secondary hover:text-white transition-colors cursor-pointer">
            {sidebarOpen ? '◂' : '▸'}
          </button>
        </div>

        {/* User Card */}
        {sidebarOpen && (
          <div className="p-6 border-b border-white/5 bg-surface-light/20 m-4 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary/15 border border-secondary/30 flex items-center justify-center font-heading font-bold text-secondary">{adminName.charAt(0)}</div>
            <div className="text-left overflow-hidden">
              <div className="text-xs font-semibold text-text-primary truncate">{adminName}</div>
              <div className="text-[10px] text-accent font-medium truncate">{adminRole}</div>
            </div>
          </div>
        )}

        {/* Tab Items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {[
            { id: 'overview', label: 'Overview Dashboard', icon: '📊' },
            { id: 'complaints', label: 'Complaints Panel', icon: '📁' },
            { id: 'roads', label: 'Roads Monitoring', icon: '🛣️' },
            { id: 'repairs', label: 'Repair Management', icon: '🛠️' },
            { id: 'contractors', label: 'Contractors', icon: '🏗️' },
            { id: 'budget', label: 'Budget Analytics', icon: '💰' },
            { id: 'escalation', label: 'Escalation Center', icon: '⚡' },
            { id: 'officer', label: 'Officer Performance', icon: '🎖️' },
            { id: 'notifications', label: 'Notifications Center', icon: '🔔' },
            { id: 'reports', label: 'Reports & Exports', icon: '🖨️' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-xs font-heading font-medium transition-all text-left ${activeTab === tab.id ? 'bg-gradient-to-r from-primary/25 to-secondary/10 border border-secondary/20 text-secondary' : 'text-text-secondary hover:bg-surface-light/45 hover:text-white border border-transparent'}`}
            >
              <span className="text-base">{tab.icon}</span>
              {sidebarOpen && <span>{tab.label}</span>}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-xs font-heading font-medium text-danger hover:bg-danger/10 border border-transparent transition-all text-left"
          >
            <span className="text-base">🚪</span>
            {sidebarOpen && <span>Logout Command</span>}
          </button>
        </div>
      </aside>

      {/* ─── MAIN COMMAND WINDOW ────────────────────────── */}
      <div className="flex-1 flex flex-col lg:h-full h-screen overflow-hidden max-w-full glass-strong border border-white/5 rounded-none lg:rounded-2xl bg-surface/40">
        <AdminExitHeader 
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          showToggle={true}
          subtitle={`Session active: ${adminRole} ${adminScope.state ? `• Scope: ${adminScope.state}` : ''}`}
        />
        
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {/* Top Navigation / Summary Bar */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="text-left">
            <h1 className="text-3xl font-heading font-bold text-glow">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace('-', ' ')}
            </h1>
            <p className="text-xs text-text-secondary mt-1">
              Command status: <span className="text-secondary font-medium font-heading">Secure Link Online</span>
              {adminScope.state && <span> | Scope: {adminScope.state} {adminScope.district && `(${adminScope.district})`}</span>}
            </p>
          </div>
          
          {/* Quick Stats in Header */}
          <div className="flex items-center gap-3 bg-surface-light/20 p-2.5 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 px-3 border-r border-white/5">
              <span className="w-2.5 h-2.5 rounded-full bg-danger animate-ping" />
              <span className="text-xs font-heading font-medium text-text-primary">{metrics.critical_complaints || 0} Critical</span>
            </div>
            <div className="flex items-center gap-2 px-3">
              <span className="text-xs font-heading font-medium text-text-secondary">SLA Escalations:</span>
              <span className="text-xs font-heading font-semibold text-accent">{metrics.escalations_count || 0}</span>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <span className="typing-dot" />
              <span className="typing-dot animate-bounce" />
              <span className="typing-dot" />
            </div>
            <span className="text-xs font-heading font-medium text-text-secondary">Decrypting secure administrative ledger...</span>
          </div>
        ) : error ? (
          <div className="p-8 glass bg-danger/10 border-danger/25 text-center my-12 rounded-2xl">
            <p className="text-danger font-heading font-semibold">{error}</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              
              {/* ═════════ SECTION 1: OVERVIEW ═════════ */}
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  {/* Grid of counter statistic cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { title: 'Total Registered Roads', val: metrics.total_roads, color: 'text-indigo', bg: 'rgba(129,140,248,0.15)', desc: 'NH/SH/MDR track limit' },
                      { title: 'Active Complaints', val: (metrics.pending_complaints + metrics.forwarded_complaints), color: 'text-warning', bg: 'rgba(245,158,11,0.15)', desc: 'Inspection/Escalate active queue' },
                      { title: 'Resolved Infrastructure', val: metrics.resolved_complaints, color: 'text-success', bg: 'rgba(16,185,129,0.15)', desc: 'Citizen verifications passed' },
                      { title: 'Budget Allocation', val: `₹${metrics.budget_sanctioned} Cr`, color: 'text-accent', bg: 'rgba(255,209,102,0.15)', desc: 'Sanctioned vs spent ₹' + metrics.budget_spent + ' Cr' }
                    ].map((card, idx) => (
                      <motion.div
                        key={idx}
                        whileHover={{ y: -5 }}
                        className="glass p-6 text-left relative overflow-hidden group border-white/5"
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full pointer-events-none opacity-20 transition-all group-hover:scale-110" style={{ backgroundColor: card.color === 'text-success' ? '#10B981' : card.color === 'text-warning' ? '#F59E0B' : card.color === 'text-indigo' ? '#818CF8' : '#FFD166' }} />
                        <h4 className="text-text-secondary text-[11px] font-semibold uppercase tracking-wider">{card.title}</h4>
                        <div className={`text-3xl font-heading font-bold mt-2 ${card.color}`}>{card.val}</div>
                        <p className="text-[10px] text-text-secondary mt-1">{card.desc}</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Recharts Analytics Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Complaints Trend Line Chart */}
                    <div className="lg:col-span-8 glass p-6 border-white/5">
                      <h3 className="font-heading font-bold text-sm text-glow text-left mb-6">Complaint Trends & Dynamic Overviews</h3>
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={[
                              { month: 'Jan', Pothole: 18, Flooding: 8, Safety: 12 },
                              { month: 'Feb', Pothole: 25, Flooding: 5, Safety: 15 },
                              { month: 'Mar', Pothole: 42, Flooding: 15, Safety: 20 },
                              { month: 'Apr', Pothole: 30, Flooding: 28, Safety: 18 },
                              { month: 'May', Pothole: 48, Flooding: 35, Safety: 22 }
                            ]}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="month" stroke="rgba(255,255,255,0.4)" />
                            <YAxis stroke="rgba(255,255,255,0.4)" />
                            <Tooltip contentStyle={{ backgroundColor: '#0E1525', borderColor: 'rgba(82,183,136,0.3)', color: '#F1F5F9' }} />
                            <Legend />
                            <Line type="monotone" dataKey="Pothole" stroke="#FFD166" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                            <Line type="monotone" dataKey="Flooding" stroke="#818CF8" strokeWidth={2} />
                            <Line type="monotone" dataKey="Safety" stroke="#EF4444" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Regional breakdown chart */}
                    <div className="lg:col-span-4 glass p-6 border-white/5">
                      <h3 className="font-heading font-bold text-sm text-glow text-left mb-6">Road Condition Ratios</h3>
                      <div className="h-64 w-full flex justify-center items-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Good Condition', value: 12, color: '#10B981' },
                                { name: 'Fair Condition', value: 5, color: '#F59E0B' },
                                { name: 'Critical Deterioration', value: 3, color: '#EF4444' }
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              <Cell fill="#10B981" />
                              <Cell fill="#F59E0B" />
                              <Cell fill="#EF4444" />
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#0E1525', borderColor: 'rgba(82,183,136,0.3)' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center gap-4 text-xs font-semibold mt-4">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-success" /> Good</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-warning" /> Fair</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-danger" /> Poor</span>
                      </div>
                    </div>
                  </div>

                  {/* AI insights highlight panel */}
                  <div className="glass p-6 bg-gradient-to-br from-primary/10 to-secondary/5 border-secondary/20 flex flex-col md:flex-row items-center justify-between gap-6 text-left">
                    <div>
                      <h3 className="font-heading font-bold text-sm text-glow text-accent flex items-center gap-2">
                        <span>🤖</span> RoadWatch AI Deterioration Advisor
                      </h3>
                      <p className="text-xs text-text-secondary mt-2 max-w-xl">
                        AI predicts high deterioration probability on <span className="font-semibold text-white">SH-68 (Salem – Namakkal)</span> due to rising rain indices and structural age. Recommendation: Authorize re-carpeting tender immediately.
                      </p>
                    </div>
                    <button onClick={() => setActiveTab('escalation')} className="btn-accent py-3 px-6 rounded-xl text-xs font-heading font-bold shrink-0">
                      Run AI Diagnostics
                    </button>
                  </div>
                </div>
              )}

              {/* ═════════ SECTION 2: COMPLAINTS PANEL ═════════ */}
              {activeTab === 'complaints' && (
                <div className="space-y-6">
                  {/* Filters Block */}
                  <div className="glass p-6 border-white/5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-2">State Scope</label>
                      <select name="state" value={filters.state} onChange={handleFilterChange} className="input-field py-2.5 px-3">
                        <option value="">All States</option>
                        <option value="Tamil Nadu">Tamil Nadu</option>
                        <option value="Maharashtra">Maharashtra</option>
                        <option value="Uttar Pradesh">Uttar Pradesh</option>
                        <option value="Karnataka">Karnataka</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-2">District Scope</label>
                      <input
                        type="text"
                        name="district"
                        value={filters.district}
                        onChange={handleFilterChange}
                        placeholder="Filter district..."
                        className="input-field py-2.5 px-3"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-2">Road Type</label>
                      <select name="roadType" value={filters.roadType} onChange={handleFilterChange} className="input-field py-2.5 px-3">
                        <option value="">All Road Types</option>
                        <option value="NH">National Highway</option>
                        <option value="SH">State Highway</option>
                        <option value="MDR">Major District Road</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-2">Severity Rank</label>
                      <select name="severity" value={filters.severity} onChange={handleFilterChange} className="input-field py-2.5 px-3">
                        <option value="">All Severities</option>
                        <option value="Critical">Critical (Priority &gt; 30)</option>
                        <option value="High">High (Priority &gt; 15)</option>
                        <option value="Medium">Medium (Priority &gt; 5)</option>
                        <option value="Low">Low (Priority &lt;= 5)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-2">SLA Status</label>
                      <select name="status" value={filters.status} onChange={handleFilterChange} className="input-field py-2.5 px-3">
                        <option value="">All Statuses</option>
                        <option value="Pending">Pending</option>
                        <option value="Forwarded">Forwarded/Assigned</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </div>
                  </div>

                  {/* Complaints Grid Table */}
                  <div className="glass overflow-hidden border-white/5">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 bg-surface-light/35 text-[11px] font-heading font-semibold uppercase tracking-wider text-text-secondary">
                            <th className="p-4">Ref ID</th>
                            <th className="p-4">Issue / Road</th>
                            <th className="p-4">District / State</th>
                            <th className="p-4 text-center">Priority</th>
                            <th className="p-4">Trust Level</th>
                            <th className="p-4">SLA Status</th>
                            <th className="p-4 text-center">Actions</th>
                          </tr>
                        </thead>
                      </table>
                    </div>
                      
                      {complaints.length === 0 ? (
                        <div className="p-12 text-center text-xs text-text-secondary">
                          No active complaints match your filtered authority scope.
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto pr-1">
                          {complaints.map((c) => (
                            <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-surface-light/20 transition-all text-xs">
                              {/* Ref ID & Issue */}
                              <div className="sm:w-1/4 text-left">
                                <span className="font-heading font-bold text-accent">{c.complaint_ref_id}</span>
                                <div className="text-[10px] text-text-secondary mt-0.5">{c.issue_type}</div>
                              </div>

                              {/* Road Name */}
                              <div className="sm:w-1/4 text-left">
                                <span className="font-medium text-text-primary">{c.road.road_name}</span>
                                <div className="text-[10px] text-text-secondary mt-0.5">{c.road.district}, {c.road.state}</div>
                              </div>

                              {/* Priority */}
                              <div className="sm:w-1/12 text-center">
                                <span className={`font-bold font-heading px-2.5 py-1 rounded-lg ${c.priority_score > 30 ? 'bg-danger/10 text-danger border border-danger/15' : c.priority_score > 15 ? 'bg-warning/10 text-warning border border-warning/15' : 'bg-success/10 text-success border border-success/15'}`}>
                                  {c.priority_score}
                                </span>
                              </div>

                              {/* Trust / Upvotes */}
                              <div className="sm:w-1/8 text-left">
                                <span className="font-semibold text-text-primary">🔼 {c.upvotes} Votes</span>
                                <div className="text-[10px] text-text-secondary mt-0.5">{c.trust_level}</div>
                              </div>

                              {/* Status Badge */}
                              <div className="sm:w-1/8 text-left">
                                <span className={`badge ${c.status === 'Resolved' ? 'badge-good' : c.status === 'Forwarded' ? 'badge-fair' : 'badge-poor'}`}>
                                  {c.status}
                                </span>
                              </div>

                              {/* Actions Block */}
                              <div className="sm:w-1/6 flex items-center justify-end gap-2 mt-2 sm:mt-0">
                                <button
                                  onClick={() => { setSelectedComplaint(c); setAssignModalOpen(true); }}
                                  disabled={c.status === 'Resolved'}
                                  className="px-2 py-1 rounded bg-secondary/15 hover:bg-secondary text-secondary hover:text-white transition-all text-[10px] font-heading font-bold disabled:opacity-30 disabled:pointer-events-none"
                                >
                                  Assign
                                </button>
                                <button
                                  onClick={() => { setSelectedComplaint(c); setEscalateModalOpen(true); }}
                                  disabled={c.status === 'Resolved'}
                                  className="px-2 py-1 rounded bg-accent/15 hover:bg-accent text-accent hover:text-white transition-all text-[10px] font-heading font-bold disabled:opacity-30 disabled:pointer-events-none"
                                >
                                  Escalate
                                </button>
                                <button
                                  onClick={() => { setSelectedComplaint(c); setRemarkModalOpen(true); }}
                                  className="px-2 py-1 rounded bg-indigo/15 hover:bg-indigo text-indigo hover:text-white transition-all text-[10px] font-heading font-bold"
                                >
                                  Respond
                                </button>
                              </div>

                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              )}

              {/* ═════════ SECTION 3: ROADS MONITORING ═════════ */}
              {activeTab === 'roads' && (
                <div className="space-y-8">
                  {/* Grid layout containing Road search inventory + Leaflet map */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Road Search Inventory List */}
                    <div className="lg:col-span-5 glass p-6 border-white/5 flex flex-col h-[550px]">
                      <h3 className="font-heading font-bold text-sm text-glow text-left mb-4">Road Inventory List</h3>
                      
                      <div className="mb-4">
                        <input
                          type="text"
                          placeholder="Search road name, district..."
                          className="input-field py-2.5 px-3"
                          onChange={async (e) => {
                            const val = e.target.value;
                            try {
                              const headers = getHeaders();
                              const res = val 
                                ? await axios.get(`${API_BASE}/api/roads/search`, { ...headers, params: { q: val } })
                                : await axios.get(`${API_BASE}/api/roads`, headers);
                              setRoads(res.data);
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                        />
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        {roads.map((road) => (
                          <div
                            key={road.id}
                            className="p-3.5 rounded-xl bg-surface-light/45 border border-white/5 flex items-center justify-between text-xs hover:border-secondary/30 transition-all text-left cursor-pointer"
                          >
                            <div>
                              <div className="font-heading font-bold text-text-primary">{road.road_name}</div>
                              <div className="text-[10px] text-text-secondary mt-0.5">{road.district}, {road.state} • {road.road_type}</div>
                            </div>
                            <div className="text-right">
                              <span className={`badge ${road.condition === 'Good' ? 'badge-good' : road.condition === 'Fair' ? 'badge-fair' : 'badge-poor'}`}>
                                {road.condition}
                              </span>
                              <div className="text-[10px] font-heading font-bold text-accent mt-1">Score: {road.transparency_score}/100</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Launch New Repair Tender Action */}
                      <button
                        onClick={() => setRepairModalOpen(true)}
                        className="btn-accent w-full py-3.5 mt-4 rounded-xl font-heading font-bold text-xs"
                      >
                        Launch Maintenance Campaign
                      </button>
                    </div>

                    {/* Interactive Leaflet dark-styled map overlay */}
                    <div className="lg:col-span-7 glass overflow-hidden border-white/5 relative h-[550px]">
                      {/* Leaflet container */}
                      <MapContainer
                        center={[11.6643, 78.1460]} // Salem center coord
                        zoom={6}
                        className="w-full h-full min-h-[480px] z-10"
                      >
                        <TileLayer url={DARK_MAP_TILES} attribution="&copy; OpenStreetMap contributors" />
                        
                        {/* Circular indicators with color codes */}
                        {ROAD_MARKERS.map((marker) => (
                          <CircleMarker
                            key={marker.id}
                            center={marker.coords}
                            radius={14}
                            pathOptions={{
                              fillColor: getConditionColor(marker.condition),
                              fillOpacity: 0.65,
                              color: 'white',
                              weight: 1
                            }}
                          >
                            <Popup>
                              <div className="text-left text-xs p-1">
                                <span className="font-heading font-bold text-glow">{marker.name}</span>
                                <div className="text-[10px] text-text-secondary mt-1">Condition: <span className="font-bold" style={{ color: getConditionColor(marker.condition) }}>{marker.condition}</span></div>
                                <div className="text-[10px] text-text-secondary">Health Index: <span className="text-accent font-bold">{marker.score}/100</span></div>
                              </div>
                            </Popup>
                          </CircleMarker>
                        ))}
                      </MapContainer>

                      {/* Map Legends absolute */}
                      <div className="absolute bottom-4 left-4 z-20 glass p-3 border-white/10 text-xs font-semibold space-y-1.5 text-left bg-surface/90">
                        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-success" /> Green → Healthy (Good condition)</div>
                        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-warning" /> Yellow → Fair condition</div>
                        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-danger" /> Red → Critical decay</div>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* ═════════ SECTION 4: REPAIR MANAGEMENT ═════════ */}
              {activeTab === 'repairs' && (
                <div className="space-y-8">
                  {/* Detailed repair timelines Gantt representation */}
                  <div className="glass p-6 border-white/5">
                    <h3 className="font-heading font-bold text-sm text-glow text-left mb-6">Contractor Repair Timelines & Life Cycle</h3>
                    
                    <div className="space-y-6">
                      {repairs.map((rep) => (
                        <div key={rep.id} className="p-5 rounded-2xl bg-surface-light/25 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 text-left hover:border-secondary/20 transition-all">
                          <div className="space-y-2">
                            <span className="text-[10px] font-heading font-bold text-accent uppercase tracking-widest">Active Campaign #{rep.id}</span>
                            <h4 className="font-heading font-bold text-base text-text-primary">{rep.road_name || 'NH-44 Approach Stretches'}</h4>
                            <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
                              <span>👷 Contractor: <strong className="text-text-primary">{rep.contractor_name || 'L&T Infrastructure'}</strong></span>
                              <span>📅 Expected: <strong className="text-text-primary">15 June 2026</strong></span>
                              <span>💰 Cost: <strong className="text-secondary">₹45 Lakhs</strong></span>
                            </div>
                          </div>
                          
                          {/* Current stage indicator */}
                          <div className="flex flex-col items-start md:items-end gap-2">
                            <span className="badge badge-sh">
                              {rep.repair_status || 'Repair In Progress'}
                            </span>
                            <span className="text-[10px] text-text-secondary">Sanctioned: Salem PWD Division</span>
                          </div>
                        </div>
                      ))}

                      {repairs.length === 0 && (
                        <div className="p-12 text-center text-xs text-text-secondary">
                          No active repair campaigns listed in your local district range.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ═════════ SECTION 5: CONTRACTORS ═════════ */}
              {activeTab === 'contractors' && (
                <div className="space-y-8">
                  {/* Contractor Scoreboard */}
                  <div className="glass overflow-hidden border-white/5">
                    <h3 className="font-heading font-bold text-sm text-glow text-left p-6 border-b border-white/5">Contractor Quality Leaderboard</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 bg-surface-light/35 text-[11px] font-heading font-semibold uppercase tracking-wider text-text-secondary">
                            <th className="p-4">Contractor Name</th>
                            <th className="p-4 text-center">Quality</th>
                            <th className="p-4 text-center">Budget Speed</th>
                            <th className="p-4 text-center">Projects (Completed/Delayed)</th>
                            <th className="p-4 text-center">Recurrence Rate</th>
                            <th className="p-4 text-center">Citizen Rating</th>
                            <th className="p-4 text-center">Composite Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs">
                          {contractors.map((c) => (
                            <tr key={c.id} className="hover:bg-surface-light/20 transition-all">
                              <td className="p-4 font-semibold text-text-primary text-left">{c.contractor_name}</td>
                              <td className="p-4 text-center font-heading text-glow text-success">{c.efficiency_metrics.quality}%</td>
                              <td className="p-4 text-center font-heading text-indigo">{c.efficiency_metrics.speed}% / {c.efficiency_metrics.budget}%</td>
                              <td className="p-4 text-center">{c.projects_completed} / <span className="text-danger font-semibold">{c.projects_delayed}</span></td>
                              <td className="p-4 text-center text-danger font-semibold">{c.recurrence_rate}%</td>
                              <td className="p-4 text-center font-medium text-accent">⭐ {c.citizen_rating}/5</td>
                              <td className="p-4 text-center">
                                <span className={`font-bold font-heading px-2.5 py-1 rounded-lg ${c.composite_score > 80 ? 'bg-success/15 text-success border border-success/15' : c.composite_score > 60 ? 'bg-warning/15 text-warning border border-warning/15' : 'bg-danger/15 text-danger border border-danger/15'}`}>
                                  {c.composite_score}/100
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ═════════ SECTION 6: BUDGET ANALYTICS ═════════ */}
              {activeTab === 'budget' && (
                <div className="space-y-8">
                  {/* Pie / Bar Chart visualizations comparing sanctioned vs spent */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Sanctioned vs Spent Bar Chart */}
                    <div className="lg:col-span-8 glass p-6 border-white/5">
                      <h3 className="font-heading font-bold text-sm text-glow text-left mb-6">Sanctioned vs Spent Budget By State (₹ Crores)</h3>
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={budgetByState}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="state" stroke="rgba(255,255,255,0.4)" />
                            <YAxis stroke="rgba(255,255,255,0.4)" />
                            <Tooltip contentStyle={{ backgroundColor: '#0E1525', borderColor: 'rgba(82,183,136,0.3)', color: '#F1F5F9' }} />
                            <Legend />
                            <Bar dataKey="sanctioned" fill="#52B788" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="spent" fill="#818CF8" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Suspicious Budget Utilization Anomaly List */}
                    <div className="lg:col-span-4 glass p-6 border-white/5 flex flex-col h-[400px]">
                      <h3 className="font-heading font-bold text-sm text-glow text-left text-danger mb-4 flex items-center gap-2">
                        <span>⚠️</span> Budget Anomalies Detection
                      </h3>
                      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
                        {budgetData.anomalies.map((anom, idx) => (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-xl text-xs text-left border ${anom.severity === 'High' ? 'bg-danger/10 border-danger/25 text-danger' : 'bg-warning/10 border-warning/25 text-warning'}`}
                          >
                            <div className="font-heading font-bold flex items-center gap-1.5">
                              <span>🚨</span> {anom.type}
                            </div>
                            <div className="text-[10px] text-text-primary font-semibold mt-1">{anom.road_name}</div>
                            <p className="text-[10px] text-text-secondary mt-1 leading-relaxed">{anom.message}</p>
                          </div>
                        ))}
                        {budgetData.anomalies.length === 0 && (
                          <div className="p-12 text-center text-xs text-text-secondary">
                            All budgets are fully aligned within the correct bounds.
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* ═════════ SECTION 7: ESCALATION CENTER ═════════ */}
              {activeTab === 'escalation' && (
                <div className="space-y-8">
                  {/* AI deterioration predictions + SLA escalations */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* AI Predictor for deterioration */}
                    <div className="lg:col-span-6 glass p-6 border-white/5 text-left flex flex-col">
                      <h3 className="font-heading font-bold text-sm text-glow text-accent mb-4 flex items-center gap-2">
                        <span>🤖</span> Deterioration Warnings (Road Age & Complaint Spikes)
                      </h3>
                      <div className="space-y-3.5 overflow-y-auto flex-1 pr-1">
                        {aiInsights.deterioration_predictions.map((pred, idx) => (
                          <div key={idx} className="p-4 rounded-xl bg-surface-light/30 border border-white/5 text-xs flex justify-between items-start gap-4">
                            <div>
                              <div className="font-heading font-bold text-text-primary">{pred.road_name}</div>
                              <div className="text-[10px] text-text-secondary mt-0.5">{pred.district} • Condition: {pred.condition}</div>
                              <p className="text-[10px] text-accent mt-2 font-medium">💡 Rec: {pred.recommendation}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-heading font-bold text-glow text-danger text-sm">{pred.probability_percent}%</span>
                              <div className="text-[9px] text-text-secondary mt-0.5">Deterioration Prob</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SLA Escalation Warning Cards */}
                    <div className="lg:col-span-6 glass p-6 border-white/5 text-left flex flex-col">
                      <h3 className="font-heading font-bold text-sm text-glow text-danger mb-4 flex items-center gap-2">
                        <span>⚡</span> Active SLA Breaches (7 / 15 / 30 Days)
                      </h3>
                      <div className="space-y-3.5 overflow-y-auto flex-1 pr-1">
                        {complaints.filter(c => c.priority_score > 25 && c.status !== 'Resolved').map((comp, idx) => (
                          <div key={idx} className="p-4 rounded-xl bg-danger/5 border border-danger/15 text-xs flex justify-between items-center gap-4">
                            <div>
                              <span className="font-heading font-bold text-danger">{comp.complaint_ref_id}</span>
                              <div className="font-medium text-text-primary mt-1">{comp.road.road_name}</div>
                              <p className="text-[10px] text-text-secondary mt-1">{comp.description || 'No description provided.'}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-heading font-bold text-glow text-accent">{comp.priority_score} Pts</span>
                              <div className="text-[9px] text-text-secondary mt-0.5 font-semibold text-danger">⚠️ Breaching Limit!</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* ═════════ SECTION 8: OFFICER PERFORMANCE ═════════ */}
              {activeTab === 'officer' && (
                <div className="space-y-8">
                  {/* Resolution speed rankings & department scorecard */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* District Rankings */}
                    <div className="lg:col-span-7 glass p-6 border-white/5">
                      <h3 className="font-heading font-bold text-sm text-glow text-left mb-6">District Governance Performance Ranking</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-white/5 bg-surface-light/35 text-[11px] font-heading font-semibold uppercase tracking-wider text-text-secondary">
                              <th className="p-4 text-center">Rank</th>
                              <th className="p-4">District / State</th>
                              <th className="p-4 text-center">Health Index</th>
                              <th className="p-4 text-center">SLA Resolution</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-xs">
                            {analytics.district_rankings.map((r) => (
                              <tr key={r.rank} className="hover:bg-surface-light/20 transition-all">
                                <td className="p-4 text-center font-bold text-secondary font-heading">#{r.rank}</td>
                                <td className="p-4 text-left">
                                  <div className="font-semibold text-text-primary">{r.district}</div>
                                  <div className="text-[10px] text-text-secondary mt-0.5">{r.state}</div>
                                </td>
                                <td className="p-4 text-center font-bold font-heading text-accent">{r.health_index}</td>
                                <td className="p-4 text-center font-semibold text-glow text-success">{r.resolution_rate}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Department scorecards */}
                    <div className="lg:col-span-5 glass p-6 border-white/5 text-left">
                      <h3 className="font-heading font-bold text-sm text-glow mb-6">Department Execution Efficiency</h3>
                      <div className="space-y-5">
                        {Object.entries(analytics.department_scorecard).map(([dept, sc]) => (
                          <div key={dept} className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <span className="text-text-primary">{dept}</span>
                              <span className="text-secondary font-heading font-bold">{sc.efficiency}%</span>
                            </div>
                            <div className="progress-bar">
                              <div className="progress-fill" style={{ width: `${sc.efficiency}%` }} />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-text-secondary">
                              <span>Volume: {sc.volume} complaints</span>
                              <span>Speed: ⭐ {sc.speed_rating}/5.0</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* ═════════ SECTION 9: NOTIFICATIONS ═════════ */}
              {activeTab === 'notifications' && (
                <div className="glass p-6 border-white/5 text-left max-w-4xl mx-auto">
                  <h3 className="font-heading font-bold text-sm text-glow mb-6 flex items-center gap-2">
                    <span>🔔</span> Real-Time Emergency Alerts Feed
                  </h3>
                  
                  <div className="space-y-4">
                    {notifications.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-4 rounded-xl border flex items-start gap-4 text-xs transition-all ${alert.severity === 'Critical' ? 'bg-danger/10 border-danger/25 text-danger' : alert.severity === 'High' ? 'bg-warning/10 border-warning/25 text-warning' : 'bg-surface-light/35 border-white/5 text-text-primary'}`}
                      >
                        <span className="text-lg">📢</span>
                        <div className="flex-1 space-y-1">
                          <div className="font-heading font-bold flex items-center justify-between">
                            <span>{alert.title}</span>
                            <span className="text-[10px] text-text-secondary font-medium font-body">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-[10px] text-text-secondary leading-relaxed">{alert.message}</p>
                          <div className="pt-1.5 flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${alert.severity === 'Critical' ? 'bg-danger/20 text-danger' : alert.severity === 'High' ? 'bg-warning/20 text-warning' : 'bg-surface-light text-text-secondary'}`}>{alert.severity} Severity</span>
                            <span className="text-[9px] text-text-secondary font-semibold">• {alert.type}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ═════════ SECTION 10: REPORTS ═════════ */}
              {activeTab === 'reports' && (
                <div className="glass p-8 border-white/5 text-left max-w-2xl mx-auto">
                  <h3 className="font-heading font-bold text-base text-glow mb-2 flex items-center gap-2">
                    <span>🖨️</span> Report & Export System
                  </h3>
                  <p className="text-xs text-text-secondary mb-8">
                    Generate and download administrative reports filtered by your authority scope. Audit logs register all downloadable activities.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                    <div>
                      <h4 className="text-xs font-semibold text-text-secondary uppercase mb-3">Complaints Reports</h4>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => handleExport('csv', 'complaints')} className="px-3.5 py-2 bg-surface-light/45 hover:bg-secondary/20 hover:text-secondary rounded-lg border border-white/5 hover:border-secondary/30 transition-all text-xs font-heading font-bold">CSV</button>
                        <button onClick={() => handleExport('excel', 'complaints')} className="px-3.5 py-2 bg-surface-light/45 hover:bg-secondary/20 hover:text-secondary rounded-lg border border-white/5 hover:border-secondary/30 transition-all text-xs font-heading font-bold">Excel</button>
                        <button onClick={() => handleExport('pdf', 'complaints')} className="px-3.5 py-2 bg-surface-light/45 hover:bg-secondary/20 hover:text-secondary rounded-lg border border-white/5 hover:border-secondary/30 transition-all text-xs font-heading font-bold">Print PDF</button>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-text-secondary uppercase mb-3">Contractor Audits</h4>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => handleExport('csv', 'contractors')} className="px-3.5 py-2 bg-surface-light/45 hover:bg-secondary/20 hover:text-secondary rounded-lg border border-white/5 hover:border-secondary/30 transition-all text-xs font-heading font-bold">CSV</button>
                        <button onClick={() => handleExport('excel', 'contractors')} className="px-3.5 py-2 bg-surface-light/45 hover:bg-secondary/20 hover:text-secondary rounded-lg border border-white/5 hover:border-secondary/30 transition-all text-xs font-heading font-bold">Excel</button>
                        <button onClick={() => handleExport('pdf', 'contractors')} className="px-3.5 py-2 bg-surface-light/45 hover:bg-secondary/20 hover:text-secondary rounded-lg border border-white/5 hover:border-secondary/30 transition-all text-xs font-heading font-bold">Print PDF</button>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-light/20 border border-white/5 text-xs text-text-secondary">
                    ℹ️ <strong className="text-text-primary">Transparency Mandate:</strong> In compliance with the RTI (Right to Information) Act Section 4(1)(b), all exported ledger details are automatically cross-published to the public transparency portal.
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        )}
      </main>
    </div>

      {/* ─── ACTION MODALS ───────────────────────────────── */}

      {/* 1. Assign Modal */}
      {assignModalOpen && selectedComplaint && (
        <div className="fixed inset-0 bg-bg/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="glass-strong glow-green w-full max-w-md p-6 border-white/5 text-left space-y-4">
            <h3 className="font-heading font-bold text-base text-glow">Assign Complaint</h3>
            <p className="text-xs text-text-secondary">Ref: <strong className="text-accent">{selectedComplaint.complaint_ref_id}</strong> on {selectedComplaint.road.road_name}</p>
            
            <form onSubmit={handleAssignSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-2">Assign to Officer</label>
                <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="input-field" required>
                  <option value="">Select executive engineer...</option>
                  <option value="4">Er. S. Ramanathan (PWD)</option>
                  <option value="5">Er. K. Meenakshi (NHAI)</option>
                  <option value="6">Sanjay Sharma (Inspector)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-2">Officer Remarks</label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Enter specific field instructions..."
                  className="input-field min-h-[80px]"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setAssignModalOpen(false)} className="btn-outline py-2.5 px-5 text-xs rounded-xl font-heading font-semibold">Cancel</button>
                <button type="submit" className="btn-primary py-2.5 px-5 text-xs rounded-xl">Confirm Allocation</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 2. Escalate Modal */}
      {escalateModalOpen && selectedComplaint && (
        <div className="fixed inset-0 bg-bg/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="glass-strong glow-green w-full max-w-md p-6 border-white/5 text-left space-y-4">
            <h3 className="font-heading font-bold text-base text-glow text-danger">Escalate Unresolved Complaint</h3>
            <p className="text-xs text-text-secondary">Ref: <strong className="text-danger">{selectedComplaint.complaint_ref_id}</strong> on {selectedComplaint.road.road_name}</p>
            
            <form onSubmit={handleEscalateSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-2">Escalate to Level</label>
                <select value={escalateTo} onChange={(e) => setEscalateTo(e.target.value)} className="input-field" required>
                  <option value="District Collector">District Collector (Pune Office)</option>
                  <option value="Executive Engineer">State Executive Engineer (PWD)</option>
                  <option value="State Authority">State Authority (Ministry Secretariat)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-2">Escalation Reason</label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Explain why manual bypass is required..."
                  className="input-field min-h-[80px]"
                  required
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setEscalateModalOpen(false)} className="btn-outline py-2.5 px-5 text-xs rounded-xl font-heading font-semibold">Cancel</button>
                <button type="submit" className="btn-primary py-2.5 px-5 text-xs rounded-xl bg-danger border-danger hover:bg-danger-light">Confirm Escalation</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 3. Respond/Remark Modal */}
      {remarkModalOpen && selectedComplaint && (
        <div className="fixed inset-0 bg-bg/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="glass-strong glow-green w-full max-w-md p-6 border-white/5 text-left space-y-4">
            <h3 className="font-heading font-bold text-base text-glow text-indigo">Respond to Citizen</h3>
            <p className="text-xs text-text-secondary">Posting official update for Complaint <strong className="text-indigo">{selectedComplaint.complaint_ref_id}</strong></p>
            
            <form onSubmit={handleRemarkSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-2">Official Message</label>
                <textarea
                  value={remarkMessage}
                  onChange={(e) => setRemarkMessage(e.target.value)}
                  placeholder="Write clear response to citizen. They will be notified immediately..."
                  className="input-field min-h-[120px]"
                  required
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setRemarkModalOpen(false)} className="btn-outline py-2.5 px-5 text-xs rounded-xl font-heading font-semibold">Cancel</button>
                <button type="submit" className="btn-primary py-2.5 px-5 text-xs rounded-xl bg-indigo hover:bg-indigo/80">Send Remarks</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 4. Launch Repair Campaign Modal */}
      {repairModalOpen && (
        <div className="fixed inset-0 bg-bg/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="glass-strong glow-green w-full max-w-lg p-6 border-white/5 text-left space-y-4">
            <h3 className="font-heading font-bold text-base text-glow">Launch Repair Campaign Tender</h3>
            <p className="text-[10px] text-text-secondary">Approve immediate machinery mobilization and contractor assignment.</p>
            
            <form onSubmit={handleRepairSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-2">Target Road</label>
                  <select value={newRepair.road_id} onChange={(e) => setNewRepair({...newRepair, road_id: e.target.value})} className="input-field" required>
                    <option value="">Select road stretch...</option>
                    {roads.map(r => (
                      <option key={r.id} value={r.id}>{r.road_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-2">Allocated Contractor</label>
                  <select value={newRepair.contractor_name} onChange={(e) => setNewRepair({...newRepair, contractor_name: e.target.value})} className="input-field" required>
                    <option value="L&T Infrastructure">L&T Infrastructure</option>
                    <option value="Dilip Buildcon Ltd">Dilip Buildcon Ltd</option>
                    <option value="KNR Constructions">KNR Constructions</option>
                    <option value="Ramky Infrastructure">Ramky Infrastructure</option>
                    <option value="PNC Infratech Ltd">PNC Infratech Ltd</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-2">Repair cost (₹ Lakhs)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newRepair.repair_cost}
                    onChange={(e) => setNewRepair({...newRepair, repair_cost: e.target.value})}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-2">Expected Completion</label>
                  <input
                    type="date"
                    value={newRepair.expected_completion}
                    onChange={(e) => setNewRepair({...newRepair, expected_completion: e.target.value})}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-2">Tender Brief & Scope</label>
                <textarea
                  value={newRepair.notes}
                  onChange={(e) => setNewRepair({...newRepair, notes: e.target.value})}
                  placeholder="Enter specific repair notes and timelines..."
                  className="input-field min-h-[80px]"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setRepairModalOpen(false)} className="btn-outline py-2.5 px-5 text-xs rounded-xl font-heading font-semibold">Cancel</button>
                <button type="submit" className="btn-primary py-2.5 px-5 text-xs rounded-xl">Authorize Project</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
