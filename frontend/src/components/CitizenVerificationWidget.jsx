import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDeviceId, verifyRepairQuality } from '../api';
import confetti from 'canvas-confetti';

const VERDICTS = [
  { id: "successfully_repaired", label: "Successfully Repaired", rating: 5, color: "text-success bg-success/10 border-success/20 hover:bg-success/20", icon: "✅" },
  { id: "partially_fixed", label: "Partially Fixed", rating: 3, color: "text-warning bg-warning/10 border-warning/20 hover:bg-warning/20", icon: "🚧" },
  { id: "poor_quality", label: "Poor Quality Repair", rating: 2, color: "text-accent bg-accent/10 border-accent/20 hover:bg-accent/20", icon: "👎" },
  { id: "issue_still_exists", label: "Issue Still Exists", rating: 1, color: "text-danger bg-danger/10 border-danger/20 hover:bg-danger/20", icon: "🚨" }
];

export default function CitizenVerificationWidget({ repairId, initialRepair, onUpdate }) {
  const [selectedVerdict, setSelectedVerdict] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const deviceId = getDeviceId();
  const repair = initialRepair;
  
  // Check if this device already voted
  const alreadyVoted = repair.verifications?.some(v => v.device_id === deviceId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedVerdict) {
      setError("Please select a verification verdict option.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await verifyRepairQuality(repairId, {
        device_id: deviceId,
        verdict: selectedVerdict,
        rating: rating || VERDICTS.find(v => v.id === selectedVerdict)?.rating || 3,
        comment: comment.trim() || null
      });

      setSuccess(true);
      if (selectedVerdict === "successfully_repaired") {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
      if (onUpdate) {
        onUpdate(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit quality verification.");
    } finally {
      setLoading(false);
    }
  };

  const getVerdictLabel = (id) => {
    return VERDICTS.find(v => v.id === id)?.label || id;
  };

  return (
    <div className="glass p-6 rounded-2xl border border-white/5 glow-green-hover transition-all">
      <h3 className="text-lg font-bold font-heading mb-4 flex items-center gap-2">
        <span>🛡️ Citizen Quality Audit Channel</span>
        <span className="pulse-live inline-block" />
      </h3>

      {/* Verification stats summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white/2 rounded-xl p-4 border border-white/5 text-center">
          <span className="text-[10px] uppercase tracking-wider text-text-secondary block mb-1">
            Consensus Score
          </span>
          <div className="text-2xl font-bold font-heading text-secondary flex items-center justify-center gap-1">
            {repair.quality_score !== null && repair.quality_score !== undefined ? (
              <>
                <span>{repair.quality_score}%</span>
                <span className="text-xs text-text-secondary font-medium">Quality</span>
              </>
            ) : (
              <span className="text-sm font-medium text-text-secondary">Awaiting Audit</span>
            )}
          </div>
        </div>

        <div className="bg-white/2 rounded-xl p-4 border border-white/5 text-center">
          <span className="text-[10px] uppercase tracking-wider text-text-secondary block mb-1">
            Citizen Satisfaction
          </span>
          <div className="text-2xl font-bold font-heading text-accent flex items-center justify-center gap-1">
            {repair.satisfaction_rating !== null && repair.satisfaction_rating !== undefined ? (
              <>
                <span>{repair.satisfaction_rating}</span>
                <span className="text-xs text-text-secondary font-medium">/ 5</span>
              </>
            ) : (
              <span className="text-sm font-medium text-text-secondary">No Ratings</span>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {alreadyVoted || success ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center py-6 bg-white/2 border border-white/5 rounded-2xl p-4"
          >
            <div className="text-3xl mb-2">🏅</div>
            <h4 className="text-sm font-bold font-heading text-secondary mb-1">Citizen Audit Complete</h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              Your device has registered verification feedback. Thank you for holding government contractors accountable!
            </p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-text-secondary leading-relaxed mb-2">
              Have you recently traveled past this stretch? Cast your transparent vote below to verify physical construction completion quality.
            </p>

            {/* Verdict selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {VERDICTS.map(verdict => (
                <button
                  key={verdict.id}
                  type="button"
                  onClick={() => {
                    setSelectedVerdict(verdict.id);
                    setRating(verdict.rating);
                  }}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all duration-300 ${verdict.color} ${
                    selectedVerdict === verdict.id ? 'ring-2 ring-secondary/50 scale-[1.02] border-white/20' : 'opacity-80'
                  }`}
                >
                  <span className="text-lg">{verdict.icon}</span>
                  <span>{verdict.label}</span>
                </button>
              ))}
            </div>

            {/* Interactive Star rating */}
            {selectedVerdict && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-white/2 rounded-xl p-4 border border-white/5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-primary font-heading">
                    Rate Repair Quality:
                  </span>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`star-rating-btn ${star <= rating ? 'active' : ''}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-text-secondary mb-1.5 font-heading">
                    Review / Observation details (Optional)
                  </label>
                  <textarea
                    rows="2"
                    placeholder="Provide details about asphalt quality, debris, speed bumps, markers..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="input-field py-3 text-xs leading-relaxed"
                  />
                </div>
              </motion.div>
            )}

            {error && (
              <p className="text-xs text-danger font-medium text-center">
                ⚠️ {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 rounded-xl text-xs tracking-wider uppercase"
            >
              {loading ? "Submitting Quality Audit..." : "Submit Quality Audit"}
            </button>
          </form>
        )}
      </AnimatePresence>
    </div>
  );
}
