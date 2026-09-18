import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import PageTransition from '../components/PageTransition';
import { fetchRoad, fetchComplaints, fetchRepairHistory } from '../api';
import ComplaintActionWidget from '../components/ComplaintActionWidget';
import RepairTimeline from '../components/RepairTimeline';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const condClass = { Good: 'badge-good', Fair: 'badge-fair', Poor: 'badge-poor' };
const typeClass = { NH: 'badge-nh', SH: 'badge-sh', MDR: 'badge-mdr' };

export default function RoadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [road, setRoad] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [sortBy, setSortBy] = useState('recent');
  const [loading, setLoading] = useState(true);

  const loadRoadData = async () => {
    try { setRoad((await fetchRoad(id)).data); } catch { setRoad(null); }
  };

  const loadComplaints = async () => {
    try { setComplaints((await fetchComplaints(id, sortBy)).data); } catch { setComplaints([]); }
  };

  const loadRepairs = async () => {
    try { setRepairs((await fetchRepairHistory(id)).data); } catch { setRepairs([]); }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadRoadData(), loadComplaints(), loadRepairs()]);
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    loadComplaints();
  }, [sortBy, id]);

  if (loading) return (
    <div className="min-h-screen pt-32 pb-20"><div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 space-y-6">
      <div className="skeleton h-10 w-2/3" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass p-5 space-y-3"><div className="skeleton h-4 w-1/2" /><div className="skeleton h-6 w-3/4" /></div>)}</div>
    </div></div>
  );

  if (!road) return (
    <div className="min-h-screen pt-32 pb-20 flex items-center justify-center"><div className="text-center">
      <h2 className="font-heading text-2xl font-bold mb-2 text-danger">Road Not Found</h2>
      <Link to="/search" className="btn-outline mt-4 inline-block">Back to Search</Link>
    </div></div>
  );

  const util = road.budget_sanctioned > 0 ? Math.round((road.budget_spent / road.budget_sanctioned) * 100) : 0;
  const score = road.transparency_score || 0;
  const scoreColor = score >= 75 ? '#34D399' : score >= 50 ? '#FBBF24' : '#F87171';
  const mapCenter = road.latitude_start ? [(road.latitude_start + (road.latitude_end || road.latitude_start)) / 2, (road.longitude_start + (road.longitude_end || road.longitude_start)) / 2] : [20.59, 78.96];
  const roadLine = road.latitude_start && road.latitude_end ? [[road.latitude_start, road.longitude_start], [road.latitude_end, road.longitude_end]] : null;

  const infoCards = [
    { label: 'Contractor', value: road.contractor_name, sub: road.contractor_contact },
    { label: 'Last Relaying', value: road.last_repair_date || 'N/A' },
    { label: 'Length', value: `${road.length_km} km` },
    { label: 'Data Source', value: road.data_source || 'RTI' },
  ];

  return (
    <PageTransition>
      <div className="min-h-screen pt-32 pb-20">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          {/* Back */}
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => navigate(-1)} className="flex items-center gap-1 text-text-secondary hover:text-secondary text-sm mb-6 transition-colors cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5m7-7l-7 7 7 7" /></svg>
            Back
          </motion.button>

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`badge ${typeClass[road.road_type]}`}>{road.road_type}</span>
              <span className={`badge ${condClass[road.condition]}`}>{road.condition}</span>
              <div className="score-ring ml-1" style={{ '--ring-color': scoreColor, '--score': score, width: '42px', height: '42px', fontSize: '0.75rem' }}>
                <span style={{ color: scoreColor }}>{score}</span>
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-heading">{road.road_name}</h1>
            <p className="text-text-secondary mt-1 text-sm">{road.district}, {road.state}</p>
          </motion.div>

          {/* Info Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {infoCards.map((c, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="glass p-4 group hover:border-secondary/20">
                <p className="text-text-secondary text-[0.65rem] uppercase tracking-wider mb-1">{c.label}</p>
                <p className="font-heading font-semibold text-sm">{c.value}</p>
                {c.sub && <p className="text-text-secondary text-xs mt-0.5">{c.sub}</p>}
              </motion.div>
            ))}
          </div>

          {/* Budget */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass p-6 mb-8">
            <h2 className="font-heading font-semibold text-lg mb-5">Budget Breakdown</h2>
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div><p className="text-text-secondary text-[0.65rem] uppercase tracking-wider mb-1">Sanctioned</p><p className="text-xl font-bold font-heading text-accent">₹{road.budget_sanctioned} Cr</p></div>
              <div><p className="text-text-secondary text-[0.65rem] uppercase tracking-wider mb-1">Spent</p><p className="text-xl font-bold font-heading text-secondary">₹{road.budget_spent} Cr</p></div>
              <div><p className="text-text-secondary text-[0.65rem] uppercase tracking-wider mb-1">Utilization</p><p className="text-xl font-bold font-heading">{util}%</p></div>
            </div>
            <div className="progress-bar h-4"><motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${Math.min(util, 100)}%` }} transition={{ duration: 1.5, ease: 'easeOut' }} /></div>
          </motion.div>

          {/* Authority */}
          {road.authority && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass p-6 mb-8">
              <h2 className="font-heading font-semibold text-lg mb-4">Responsible Authority</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-text-secondary text-[0.65rem] uppercase tracking-wider mb-1">Executive Engineer</p>
                  <p className="font-heading font-semibold">{road.authority.name}</p>
                  <p className="text-text-secondary text-sm">{road.authority.designation}</p>
                </div>
                <div className="space-y-2">
                  {road.authority.contact && <p className="text-sm"><span className="text-text-secondary">Phone:</span> <span className="text-secondary">{road.authority.contact}</span></p>}
                  {road.authority.email && <p className="text-sm"><span className="text-text-secondary">Email:</span> <span className="text-secondary">{road.authority.email}</span></p>}
                </div>
              </div>
              <Link to={`/complaint?road_id=${road.id}`} className="btn-accent inline-flex mt-5 text-sm py-3 px-6">
                File Complaint Against This Road
              </Link>
            </motion.div>
          )}

          {/* Map */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass p-4 mb-8 overflow-hidden">
            <h2 className="font-heading font-semibold text-lg mb-4 px-2">Road Map</h2>
            <div className="h-72 rounded-2xl overflow-hidden">
              <MapContainer center={mapCenter} zoom={8} className="h-full w-full" scrollWheelZoom={false}>
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {road.latitude_start && <Marker position={[road.latitude_start, road.longitude_start]}><Popup>Start</Popup></Marker>}
                {road.latitude_end && <Marker position={[road.latitude_end, road.longitude_end]}><Popup>End</Popup></Marker>}
                {roadLine && <Polyline positions={roadLine} pathOptions={{ color: '#52B788', weight: 4, opacity: 0.8, dashArray: '8 4' }} />}
                
                {/* Community Complaint Pins */}
                {complaints.filter(c => c.latitude && c.longitude).map(c => {
                  const markerColor = c.priority_score > 50 ? '#EF4444' : c.priority_score >= 31 ? '#F97316' : c.priority_score >= 16 ? '#FBBF24' : '#10B981';
                  const sizeMultiplier = c.upvotes >= 5 ? 1.4 : 1.0;
                  const isCritical = c.priority_score > 50;

                  const iconHtml = `
                    <div style="position: relative; width: ${20 * sizeMultiplier}px; height: ${20 * sizeMultiplier}px;">
                      <div class="${isCritical ? 'pulse-live' : ''}" style="
                        position: absolute;
                        width: 100%;
                        height: 100%;
                        background: ${markerColor};
                        border-radius: 50%;
                        border: 2px solid #060B18;
                        box-shadow: 0 0 10px ${markerColor}66;
                      "></div>
                      ${c.upvotes >= 5 ? `
                        <div style="
                          position: absolute;
                          top: -6px;
                          right: -6px;
                          background: #FFD166;
                          color: #060B18;
                          font-size: 8px;
                          font-weight: 900;
                          border-radius: 50%;
                          width: 12px;
                          height: 12px;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
                        ">★</div>
                      ` : ''}
                    </div>
                  `;

                  const customIcon = L.divIcon({
                    html: iconHtml,
                    className: 'custom-leaflet-marker',
                    iconSize: [20 * sizeMultiplier, 20 * sizeMultiplier],
                    iconAnchor: [10 * sizeMultiplier, 10 * sizeMultiplier]
                  });

                  return (
                    <Marker key={c.id} position={[c.latitude, c.longitude]} icon={customIcon}>
                      <Popup>
                        <div className="p-1 min-w-[150px] text-text-primary">
                          <h4 className="font-heading font-bold text-xs m-0 text-secondary">{c.issue_type}</h4>
                          <p className="text-[10px] text-text-secondary m-0 mt-1">{c.description || 'No description'}</p>
                          <div className="flex justify-between items-center mt-2 pt-1 border-t border-white/5 text-[9px]">
                            <span className="text-text-secondary">Upvotes: <b className="text-secondary">{c.upvotes}</b></span>
                            <span className="text-accent font-bold">Priority: {c.priority_score} Pts</span>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          </motion.div>

          {/* Before vs After Repair Tracking */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="glass p-6 mb-8">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-white/5 pb-4">
              <div>
                <h2 className="font-heading font-semibold text-lg flex items-center gap-2">
                  <span>🛠️ Before vs After Repair Tracking</span>
                  {repairs.length > 0 && <span className="pulse-live" />}
                </h2>
                <p className="text-text-secondary text-xs mt-0.5">Citizen-driven infrastructure lifecycle monitoring</p>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-secondary">Current Stage:</span>
                <span className={`badge uppercase text-[10px] font-bold ${
                  repairs.length > 0 
                    ? (repairs[0].repair_status === 'Repair Completed' ? 'repair-stage-4' : repairs[0].repair_status === 'Quality Verification' ? 'repair-stage-5' : 'repair-stage-3')
                    : 'repair-stage-0'
                }`}>
                  {repairs.length > 0 ? repairs[0].repair_status : 'No Active Repair'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              <div className="md:col-span-2 space-y-4">
                <p className="text-xs text-text-secondary leading-relaxed">
                  {repairs.length > 0 
                    ? "This road stretch is currently under active lifecycle monitoring. Open the interactive tracker to drag side-by-side surface comparison sliders, upload progress files, and verify quality audits."
                    : "No active repair files are currently registered for this road stretch. Are you noticing potholes or bad surfaces? Initialize a tracking file to begin tracking civic repairs from before-repair through completion!"
                  }
                </p>
                
                <div className="pt-2">
                  <Link to={`/repair/${road.id}`} className="btn-primary inline-flex text-xs py-3 px-6 rounded-xl font-bold uppercase tracking-wider">
                    {repairs.length > 0 ? "Open Before vs After Repair Tracker" : "Launch Repair Tracking Profile"}
                  </Link>
                </div>
              </div>

              {repairs.length > 0 ? (
                <div className="bg-white/2 rounded-2xl border border-white/5 p-4 max-h-[300px] overflow-y-auto pr-2">
                  <h3 className="text-xs font-bold font-heading mb-3 border-b border-white/5 pb-2 text-text-secondary">
                    Active Lifecycle Log
                  </h3>
                  <RepairTimeline repair={repairs[0]} logs={repairs[0].progress_logs || []} />
                </div>
              ) : (
                <div className="bg-white/2 rounded-2xl border border-white/5 p-5 text-center flex flex-col items-center justify-center min-h-[140px] w-full">
                  <span className="text-2xl mb-1.5">📷</span>
                  <p className="text-[11px] text-text-secondary">Awaiting first before-repair photo upload.</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Complaints */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-white/5 pb-4">
              <div>
                <h2 className="font-heading font-semibold text-lg">Community Audit Center</h2>
                <p className="text-text-secondary text-xs mt-0.5">Validate and support citizen complaints</p>
              </div>

              {/* Sorting Filter */}
              <div className="flex items-center gap-2">
                <span className="text-text-secondary text-xs">Sort:</span>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)} 
                  className="bg-surface border border-white/10 text-text-primary rounded-xl text-xs py-1.5 px-3 focus:outline-none focus:border-secondary cursor-pointer"
                >
                  <option value="recent">Recently Reported</option>
                  <option value="upvotes">Most Upvoted</option>
                  <option value="severity">Critical Severity</option>
                </select>
              </div>
            </div>

            {complaints.length > 0 ? (
              <div className="space-y-4">
                {complaints.map((c) => (
                  <ComplaintActionWidget 
                    key={c.id} 
                    complaint={c} 
                    onUpdate={() => { loadComplaints(); loadRoadData(); }} 
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-10 rounded-2xl bg-surface-light/20 border border-dashed border-white/5">
                <p className="text-text-secondary text-sm">No active complaints filed against this road stretch yet.</p>
                <Link to={`/complaint?road_id=${road.id}`} className="btn-outline text-xs mt-4 inline-flex py-2.5 px-5">
                  File First Complaint
                </Link>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}
