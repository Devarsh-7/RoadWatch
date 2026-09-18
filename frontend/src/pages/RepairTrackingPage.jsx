import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageTransition from '../components/PageTransition';
import RepairTimeline from '../components/RepairTimeline';
import BeforeAfterSlider from '../components/BeforeAfterSlider';
import RepairMediaGallery from '../components/RepairMediaGallery';
import CitizenVerificationWidget from '../components/CitizenVerificationWidget';
import { fetchRoad, fetchRepairHistory, uploadRepairMedia, startRepair } from '../api';

export default function RepairTrackingPage() {
  const { roadId } = useParams();
  const navigate = useNavigate();
  const [road, setRoad] = useState(null);
  const [repairs, setRepairs] = useState([]);
  const [activeRepairIdx, setActiveRepairIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Upload state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [mediaType, setMediaType] = useState('during');
  const [caption, setCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [roadRes, repairRes] = await Promise.all([
        fetchRoad(roadId),
        fetchRepairHistory(roadId)
      ]);
      setRoad(roadRes.data);
      setRepairs(repairRes.data);
      setActiveRepairIdx(0); // select latest repair by default
    } catch (err) {
      console.error(err);
      setError('Failed to fetch road repair details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [roadId]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError("Please select an image or video file to upload.");
      return;
    }
    
    setUploadLoading(true);
    setUploadError('');
    setUploadSuccess(false);

    try {
      await uploadRepairMedia(roadId, selectedFile, mediaType, caption.trim() || null);
      setUploadSuccess(true);
      setCaption('');
      setSelectedFile(null);
      
      // Reload history to show newly uploaded media
      const repairRes = await fetchRepairHistory(roadId);
      setRepairs(repairRes.data);
      
      // Delay closing modal slightly for visual feedback
      setTimeout(() => {
        setUploadOpen(false);
        setUploadSuccess(false);
      }, 1500);
    } catch (err) {
      setUploadError(err.response?.data?.detail || 'Failed to upload repair media.');
    } finally {
      setUploadLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-32 pb-20">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 space-y-6">
          <div className="skeleton h-10 w-2/3" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="skeleton h-96 md:col-span-2" />
            <div className="skeleton h-96" />
          </div>
        </div>
      </div>
    );
  }

  if (!road) {
    return (
      <div className="min-h-screen pt-32 pb-20 flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-heading text-2xl font-bold mb-2 text-danger">Road Stretch Not Found</h2>
          <Link to="/search" className="btn-outline mt-4 inline-block">Back to Search</Link>
        </div>
      </div>
    );
  }

  const activeRepair = repairs[activeRepairIdx];

  // Get before & after images for slider
  const beforeMedia = activeRepair?.media?.find(m => m.media_type === 'before');
  const afterMedia = activeRepair?.media?.find(m => m.media_type === 'after');

  // Fallback seed images for slider demo if empty
  const defaultBefore = "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?w=800";
  const defaultAfter = "https://images.unsplash.com/photo-1594818379496-da1e345b0cd3?w=800";

  return (
    <PageTransition>
      <div className="min-h-screen pt-32 pb-20">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          {/* Top Navigation */}
          <div className="flex items-center justify-between mb-8">
            <button 
              onClick={() => navigate(`/road/${roadId}`)} 
              className="flex items-center gap-1.5 text-text-secondary hover:text-secondary text-sm transition-colors cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5m7-7l-7 7 7 7" /></svg>
              Back to Road Profile
            </button>

            <span className="text-xs text-text-secondary">
              District stretch: <strong className="text-text-primary">{road.district}</strong>
            </span>
          </div>

          {/* Road Summary Glass Box */}
          <div className="glass p-6 rounded-2xl border border-white/5 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="badge badge-nh">{road.road_type}</span>
                <span className={`badge ${road.condition === 'Good' ? 'badge-good' : road.condition === 'Fair' ? 'badge-fair' : 'badge-poor'}`}>
                  Condition: {road.condition}
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold font-heading">{road.road_name}</h1>
              <p className="text-xs text-text-secondary mt-1">{road.district}, {road.state} | Stretch: {road.length_km} KM</p>
            </div>

            {/* Historical repair selector */}
            {repairs.length > 1 && (
              <div className="flex items-center gap-2 bg-surface p-2 rounded-xl border border-white/5">
                <span className="text-xs text-text-secondary pl-1 font-heading">Seasons:</span>
                <select
                  value={activeRepairIdx}
                  onChange={(e) => setActiveRepairIdx(Number(e.target.value))}
                  className="bg-transparent border-0 text-text-primary text-xs font-semibold focus:outline-none cursor-pointer pr-3 font-heading"
                >
                  {repairs.map((rep, idx) => (
                    <option key={rep.id} value={idx} className="bg-surface text-text-primary">
                      {new Date(rep.created_at).getFullYear()} ({rep.repair_status})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Main Visual Comparison Slider */}
          {activeRepair && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start mb-8">
              {/* Left Column: Visual Comparison Slider */}
              <div className="lg:col-span-2 space-y-6">
                <div className="glass p-4 rounded-2xl border border-white/5">
                  <h2 className="text-base font-bold font-heading mb-3 flex items-center gap-2">
                    <span>🔬 Before vs After Inspection Lens</span>
                    {activeRepair.quality_score !== null && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-success/15 border border-success/25 text-success">
                        Verified {activeRepair.quality_score}% Match
                      </span>
                    )}
                  </h2>
                  <BeforeAfterSlider 
                    beforeImage={beforeMedia ? beforeMedia.media_url : defaultBefore}
                    afterImage={afterMedia ? afterMedia.media_url : defaultAfter}
                    beforeLabel={beforeMedia ? `Before (${new Date(beforeMedia.uploaded_at).toLocaleDateString('en-IN')})` : "Reported Surface"}
                    afterLabel={afterMedia ? `After (${new Date(afterMedia.uploaded_at).toLocaleDateString('en-IN')})` : "Completed Repair"}
                  />
                </div>

                {/* Media gallery with tab details */}
                <div className="glass p-5 rounded-2xl border border-white/5">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                    <h3 className="text-base font-bold font-heading">
                      🎥 Audit Media Hub
                    </h3>
                    
                    <button 
                      onClick={() => setUploadOpen(true)}
                      className="btn-outline py-2 px-4 rounded-xl text-xs font-semibold font-heading"
                    >
                      + Upload Progress File
                    </button>
                  </div>
                  <RepairMediaGallery media={activeRepair.media || []} />
                </div>
              </div>

              {/* Right Column: Timeline & Citizen audits */}
              <div className="space-y-6">
                {/* Active Repair Stage Info */}
                <div className="glass p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-surface to-surface-light">
                  <span className="text-[10px] uppercase tracking-wider text-text-secondary block mb-1">
                    Live Repair Stage
                  </span>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`badge uppercase text-[10px] font-bold ${
                      activeRepair.repair_status === 'Repair Completed' ? 'repair-stage-4' : 
                      activeRepair.repair_status === 'Quality Verification' ? 'repair-stage-5' : 
                      'repair-stage-3'
                    }`}>
                      {activeRepair.repair_status}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <p className="text-text-secondary leading-relaxed">
                      {activeRepair.notes || 'No project description added by contractor.'}
                    </p>
                    <div className="pt-2.5 border-t border-white/5 space-y-1 text-[11px] text-text-secondary">
                      <p>👷 Contractor: <strong className="text-text-primary">{activeRepair.contractor_name || 'Assigned Authority'}</strong></p>
                      {activeRepair.expected_completion && (
                        <p>🗓️ Target Date: <strong className="text-text-primary">{new Date(activeRepair.expected_completion).toLocaleDateString('en-IN')}</strong></p>
                      )}
                      {activeRepair.repair_cost && (
                        <p>💰 Funds Spent: <strong className="text-accent">₹ {activeRepair.repair_cost} Lakhs</strong></p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Star rating consensus & citizen quality audit selectors */}
                {activeRepair.repair_status && (activeRepair.repair_status === "Repair Completed" || activeRepair.repair_status === "Quality Verification") && (
                  <CitizenVerificationWidget 
                    repairId={activeRepair.id} 
                    initialRepair={activeRepair}
                    onUpdate={(updatedRepair) => {
                      const updated = [...repairs];
                      updated[activeRepairIdx] = updatedRepair;
                      setRepairs(updated);
                    }}
                  />
                )}

                {/* Audit Timeline */}
                <div className="glass p-5 rounded-2xl border border-white/5">
                  <h3 className="text-base font-bold font-heading mb-4 border-b border-white/5 pb-3">
                    📋 Immutable Repair Log
                  </h3>
                  <RepairTimeline repair={activeRepair} logs={activeRepair.progress_logs || []} />
                </div>
              </div>
            </div>
          )}

          {!activeRepair && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24 glass rounded-2xl border border-white/5">
              <span className="text-3xl block mb-3">🛠️</span>
              <h3 className="font-heading text-lg font-bold mb-1.5">No Repair History Found</h3>
              <p className="text-xs text-text-secondary max-w-sm mx-auto mb-6">
                This road stretch does not have any ongoing or historical repair tracking files registered on our platform.
              </p>
              <button 
                onClick={async () => {
                  setLoading(true);
                  try {
                    // Create default repair to start tracking
                    await startRepair(roadId, {
                      contractor_name: road.contractor_name || "PWD Authorized Division",
                      notes: "Citizens requested emergency tracking. Initializing Repair Profile."
                    });
                    loadData();
                  } catch (err) {
                    setError('Failed to auto-start repair profile.');
                    setLoading(false);
                  }
                }}
                className="btn-accent px-6 py-3.5 text-xs rounded-xl font-bold uppercase tracking-wider"
              >
                Launch Repair Tracking File
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* File Upload Modal Overlay */}
      {uploadOpen && (
        <div className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-strong p-6 rounded-2xl border border-white/10 w-full max-w-md relative"
          >
            <button 
              onClick={() => setUploadOpen(false)}
              className="absolute top-4 right-4 text-text-secondary hover:text-white font-bold cursor-pointer"
            >
              ✕
            </button>

            <h3 className="text-base font-bold font-heading mb-4 flex items-center gap-2">
              <span>📤 Upload Progress File</span>
            </h3>

            {uploadSuccess ? (
              <div className="text-center py-8">
                <span className="text-3xl block mb-2">🎉</span>
                <h4 className="text-sm font-bold font-heading text-secondary mb-1">File Uploaded Successfully</h4>
                <p className="text-xs text-text-secondary">Associating file with audit log timeline...</p>
              </div>
            ) : (
              <form onSubmit={handleUploadSubmit} className="space-y-4">
                {/* Media stage type */}
                <div>
                  <label className="block text-[11px] text-text-secondary mb-1.5 font-semibold font-heading uppercase tracking-wide">
                    Media Phase
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['before', 'during', 'after'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setMediaType(type)}
                        className={`py-2 rounded-xl text-[10px] font-bold tracking-wider uppercase border cursor-pointer ${
                          mediaType === type 
                            ? 'bg-secondary/15 border-secondary text-secondary' 
                            : 'bg-surface border-white/5 text-text-secondary'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Caption info */}
                <div>
                  <label className="block text-[11px] text-text-secondary mb-1.5 font-semibold font-heading uppercase tracking-wide">
                    Observation caption
                  </label>
                  <input
                    type="text"
                    placeholder="Describe potholes, active scrapers, finished tarmac..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="input-field text-xs"
                    required
                  />
                </div>

                {/* File Drop Area */}
                <div>
                  <label className="block text-[11px] text-text-secondary mb-1.5 font-semibold font-heading uppercase tracking-wide">
                    Select File (Image/Video)
                  </label>
                  
                  <div className="border border-dashed border-white/10 rounded-xl p-4 bg-white/2 flex flex-col items-center justify-center text-center">
                    <input 
                      type="file" 
                      accept="image/*,video/*"
                      onChange={handleFileChange}
                      className="hidden"
                      id="upload-file-input"
                    />
                    <label 
                      htmlFor="upload-file-input"
                      className="cursor-pointer text-xs font-semibold text-secondary hover:underline block py-2"
                    >
                      {selectedFile ? `✓ Selected: ${selectedFile.name}` : 'Click here to choose file'}
                    </label>
                    <span className="text-[10px] text-text-secondary block mt-1">
                      Max file size: 10MB
                    </span>
                  </div>
                </div>

                {uploadError && (
                  <p className="text-xs text-danger font-semibold text-center">
                    ⚠️ {uploadError}
                  </p>
                )}

                <div className="flex gap-3 justify-end pt-2">
                  <button 
                    type="button"
                    onClick={() => setUploadOpen(false)}
                    className="btn-outline py-2.5 px-5 rounded-xl text-xs"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={uploadLoading}
                    className="btn-primary py-2.5 px-6 rounded-xl text-xs shrink-0"
                  >
                    {uploadLoading ? 'Uploading...' : 'Upload File'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </PageTransition>
  );
}
