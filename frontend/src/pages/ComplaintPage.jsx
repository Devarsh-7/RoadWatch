import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import PageTransition from '../components/PageTransition';
import { searchRoads, fetchRoad, fileComplaint, queueComplaint } from '../api';

const issueTypes = ['Pothole', 'Bad surface', 'No signage', 'Flooding', 'Missing barrier', 'Other'];
const steps = [{ n: 1, l: 'Select Road' }, { n: 2, l: 'Issue Details' }, { n: 3, l: 'Review' }];

export default function ComplaintPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const [roadQuery, setRoadQuery] = useState('');
  const [roadOptions, setRoadOptions] = useState([]);
  const [selectedRoad, setSelectedRoad] = useState(null);
  const [searching, setSearching] = useState(false);

  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [gps, setGps] = useState({ lat: '', lng: '' });

  useEffect(() => {
    const rid = params.get('road_id');
    if (rid) fetchRoad(rid).then(r => { setSelectedRoad(r.data); setStep(2); }).catch(() => {});
  }, [params]);

  useEffect(() => {
    if (roadQuery.length < 2) { setRoadOptions([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try { const r = await searchRoads(roadQuery); setRoadOptions(r.data); } catch { setRoadOptions([]); }
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [roadQuery]);

  const detectGps = () => navigator.geolocation?.getCurrentPosition(
    (p) => setGps({ lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) }),
    () => alert('Could not get location')
  );

  const submit = async () => {
    setSubmitting(true);
    const payload = { road_id: selectedRoad.id, issue_type: issueType, description, latitude: gps.lat ? +gps.lat : null, longitude: gps.lng ? +gps.lng : null };
    try {
      const res = await fileComplaint(payload);
      setResult(res.data);
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#2D6A4F', '#52B788', '#FFD166'] });
    } catch {
      queueComplaint(payload);
      setResult({ complaint_ref_id: 'QUEUED', status: 'Offline — will sync automatically' });
    }
    setSubmitting(false);
    setStep(4);
  };

  const routedTo = selectedRoad?.road_type === 'NH' ? 'NHAI Regional Officer' : selectedRoad?.road_type === 'SH' ? 'State PWD Executive Engineer' : 'District Collector Office';

  return (
    <PageTransition>
      <div className="min-h-screen pt-32 pb-20">
        <div className="max-w-2xl mx-auto px-6 sm:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-bold font-heading mb-1">File a Complaint</h1>
            <p className="text-text-secondary text-sm mb-8">Automatically routed to the correct authority.</p>
          </motion.div>

          {/* Stepper */}
          {step <= 3 && (
            <div className="flex items-center gap-2 mb-10">
              {steps.map((s, i) => (
                <div key={s.n} className="flex items-center gap-2 flex-1">
                  <motion.div animate={{ scale: step === s.n ? 1.15 : 1 }} className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all duration-300 ${step > s.n ? 'bg-secondary text-bg' : step === s.n ? 'bg-gradient-to-br from-primary to-secondary text-white shadow-lg shadow-primary/30' : 'bg-surface-light text-text-secondary'}`}>
                    {step > s.n ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg> : s.n}
                  </motion.div>
                  <span className={`text-xs font-medium hidden sm:block ${step >= s.n ? 'text-text-primary' : 'text-text-secondary'}`}>{s.l}</span>
                  {i < 2 && <div className={`flex-1 h-0.5 rounded-full transition-all duration-500 ${step > s.n ? 'bg-secondary' : 'bg-surface-light'}`} />}
                </div>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* Step 1 */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="glass p-8">
                <h2 className="font-heading font-semibold text-lg mb-4">Select Road</h2>
                <input type="text" value={roadQuery} onChange={(e) => setRoadQuery(e.target.value)} placeholder="Search road by name..." className="input-field mb-3" />
                {searching && <div className="skeleton h-12 w-full mb-2" />}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {roadOptions.map((r) => (
                    <motion.button key={r.id} whileHover={{ x: 4 }} onClick={() => { setSelectedRoad(r); setStep(2); }} className="w-full text-left p-3.5 rounded-xl bg-surface-light/40 hover:bg-surface-light border border-transparent hover:border-secondary/20 transition-all cursor-pointer">
                      <p className="font-medium text-sm">{r.road_name}</p>
                      <p className="text-text-secondary text-xs">{r.district}, {r.state} • {r.road_type}</p>
                    </motion.button>
                  ))}
                </div>
                <button onClick={detectGps} className="mt-4 flex items-center gap-2 text-text-secondary hover:text-secondary text-sm transition-colors cursor-pointer">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4m10-10h-4M6 12H2" /></svg>
                  Detect from my location
                </button>
              </motion.div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="glass p-8">
                <h2 className="font-heading font-semibold text-lg mb-4">Issue Details</h2>
                {selectedRoad && (
                  <div className="p-3.5 rounded-xl bg-surface-light/40 mb-4 border border-secondary/10">
                    <p className="font-medium text-sm">{selectedRoad.road_name}</p>
                    <p className="text-text-secondary text-xs">{selectedRoad.district || ''}, {selectedRoad.state || ''}</p>
                  </div>
                )}

                <label className="block mb-4">
                  <span className="text-sm text-text-secondary mb-2 block">Issue Type *</span>
                  <div className="grid grid-cols-3 gap-2">
                    {issueTypes.map((t) => (
                      <motion.button key={t} whileTap={{ scale: 0.95 }} onClick={() => setIssueType(t)} className={`p-2.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${issueType === t ? 'bg-secondary/15 border-secondary/30 text-secondary' : 'bg-surface-light/40 border-white/5 text-text-secondary hover:border-white/10'}`}>
                        {t}
                      </motion.button>
                    ))}
                  </div>
                </label>

                <label className="block mb-4">
                  <span className="text-sm text-text-secondary mb-2 block">Description</span>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Describe the issue..." className="input-field resize-none" />
                </label>

                <div className="grid grid-cols-2 gap-3 mb-2">
                  <input type="text" value={gps.lat} onChange={(e) => setGps(p => ({ ...p, lat: e.target.value }))} placeholder="Latitude" className="input-field text-sm" />
                  <input type="text" value={gps.lng} onChange={(e) => setGps(p => ({ ...p, lng: e.target.value }))} placeholder="Longitude" className="input-field text-sm" />
                </div>
                <button onClick={detectGps} className="text-text-secondary hover:text-secondary text-xs transition-colors cursor-pointer mb-6">Auto-detect GPS</button>

                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="btn-outline text-sm flex-1">Back</button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => issueType && setStep(3)} disabled={!issueType} className="btn-primary text-sm flex-1 disabled:opacity-40 disabled:cursor-not-allowed">Continue</motion.button>
                </div>
              </motion.div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="glass p-8">
                <h2 className="font-heading font-semibold text-lg mb-4">Review & Submit</h2>
                <div className="space-y-3 mb-6">
                  {[
                    { l: 'Road', v: selectedRoad?.road_name },
                    { l: 'Issue', v: issueType },
                    { l: 'Description', v: description || 'None' },
                    { l: 'Routed To', v: routedTo, highlight: true },
                  ].map((item) => (
                    <div key={item.l} className="p-3.5 rounded-xl bg-surface-light/40">
                      <p className="text-text-secondary text-[0.65rem] uppercase tracking-wider mb-0.5">{item.l}</p>
                      <p className={`text-sm font-medium ${item.highlight ? 'text-secondary' : ''}`}>{item.v}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="btn-outline text-sm flex-1">Back</button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={submit} disabled={submitting} className="btn-accent text-sm flex-1 disabled:opacity-60">
                    {submitting ? 'Submitting...' : 'Submit Complaint'}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Step 4 - Success */}
            {step === 4 && result && (
              <motion.div key="s4" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass p-12 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }} className="w-20 h-20 mx-auto mb-5 rounded-full bg-secondary/15 flex items-center justify-center">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#52B788" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                </motion.div>
                <h2 className="font-heading text-2xl font-bold mb-2">Complaint Filed!</h2>
                <p className="text-text-secondary mb-6">Registered and routed to the responsible authority.</p>
                <div className="inline-block p-5 rounded-2xl bg-surface-light/50 mb-6 border border-accent/20">
                  <p className="text-text-secondary text-[0.65rem] uppercase tracking-wider mb-1">Reference ID</p>
                  <p className="font-heading text-2xl font-bold text-accent">{result.complaint_ref_id}</p>
                </div>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => navigate('/search')} className="btn-outline text-sm">Search Roads</button>
                  <button onClick={() => { setStep(1); setResult(null); setSelectedRoad(null); setIssueType(''); setDescription(''); }} className="btn-primary text-sm">File Another</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}
