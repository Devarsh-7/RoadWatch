import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { voteComplaint, verifyComplaint, getDeviceId } from '../api';

export default function ComplaintActionWidget({ complaint: initialComplaint, onUpdate }) {
  const [complaint, setComplaint] = useState(initialComplaint);
  const [userVote, setUserVote] = useState(null); // 'upvote' | 'downvote' | null
  const [userVerifications, setUserVerifications] = useState([]); // Array of strings e.g. ['confirm']
  const [voting, setVoting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showVerifyDropdown, setShowVerifyDropdown] = useState(false);
  const [verifFeedback, setVerifFeedback] = useState(null);

  // Sync state with parent complaint updates
  useEffect(() => {
    setComplaint(initialComplaint);
  }, [initialComplaint]);

  // Load user actions from localStorage on mount
  useEffect(() => {
    const votes = JSON.parse(localStorage.getItem('rw_votes') || '{}');
    const verifs = JSON.parse(localStorage.getItem('rw_verifications') || '{}');
    if (votes[complaint.id]) setUserVote(votes[complaint.id]);
    if (verifs[complaint.id]) setUserVerifications(verifs[complaint.id]);
  }, [complaint.id]);

  const handleVote = async (type) => {
    if (voting) return;
    setVoting(true);

    const deviceId = getDeviceId();
    try {
      const res = await voteComplaint(complaint.id, { deviceId, voteType: type });
      const updated = res.data;
      setComplaint(updated);

      // Save to localStorage
      const votes = JSON.parse(localStorage.getItem('rw_votes') || '{}');
      if (userVote === type) {
        // Toggled off
        delete votes[complaint.id];
        setUserVote(null);
      } else {
        votes[complaint.id] = type;
        setUserVote(type);
      }
      localStorage.setItem('rw_votes', JSON.stringify(votes));

      if (onUpdate) onUpdate(updated);
    } catch (e) {
      console.error('Vote failed:', e);
    } finally {
      setVoting(false);
    }
  };

  const handleVerify = async (actionType) => {
    if (verifying || userVerifications.includes(actionType)) return;
    setVerifying(true);

    const deviceId = getDeviceId();
    try {
      const res = await verifyComplaint(complaint.id, { deviceId, actionType });
      const updated = res.data;
      setComplaint(updated);

      // Save to localStorage
      const verifs = JSON.parse(localStorage.getItem('rw_verifications') || '{}');
      const current = verifs[complaint.id] || [];
      const updatedList = [...current, actionType];
      verifs[complaint.id] = updatedList;
      setUserVerifications(updatedList);
      localStorage.setItem('rw_verifications', JSON.stringify(verifs));

      // Trigger feedback animation
      const feedbackMsgs = {
        confirm: 'Issue Confirmed! +1 Verification Score',
        resolved: 'Resolution Marked! Thank you for auditing.',
        severity_increased: 'Severity Increased! Flagged for engineer attention.'
      };
      setVerifFeedback(feedbackMsgs[actionType]);
      setTimeout(() => setVerifFeedback(null), 3000);

      setShowVerifyDropdown(false);
      if (onUpdate) onUpdate(updated);
    } catch (e) {
      alert(e.response?.data?.detail || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  // Get Priority UI Settings
  const getPriorityInfo = (score) => {
    if (score > 50) return { label: 'Critical', bg: 'bg-red-500/20 border-red-500/30 text-red-400', glow: 'shadow-[0_0_15px_rgba(239,68,68,0.25)]' };
    if (score >= 31) return { label: 'High Priority', bg: 'bg-orange-500/20 border-orange-500/30 text-orange-400', glow: '' };
    if (score >= 16) return { label: 'Medium Priority', bg: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400', glow: '' };
    return { label: 'Low Priority', bg: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400', glow: '' };
  };

  // Get Trust Level UI
  const getTrustInfo = (level) => {
    if (level === 'High Trust') return { label: 'High Trust', bg: 'from-indigo-600/30 to-purple-600/30 border-indigo-500/40 text-indigo-300', glow: 'shadow-[0_0_15px_rgba(129,140,248,0.25)]' };
    if (level === 'Verified') return { label: 'Verified', bg: 'from-emerald-600/20 to-teal-600/20 border-emerald-500/40 text-emerald-300', glow: 'shadow-[0_0_15px_rgba(52,211,153,0.2)]' };
    return { label: 'Unverified', bg: 'from-gray-600/10 to-slate-600/10 border-white/5 text-text-secondary', glow: '' };
  };

  const priority = getPriorityInfo(complaint.priority_score);
  const trust = getTrustInfo(complaint.trust_level);

  return (
    <div className="flex flex-col gap-4 p-5 rounded-2xl bg-surface/50 border border-white/5 hover:border-secondary/20 transition-all duration-300 relative overflow-hidden">
      {/* Dynamic Glow Accents */}
      {complaint.trust_level !== 'Unverified' && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full filter blur-2xl pointer-events-none" />
      )}

      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Issue Type */}
          <span className="font-heading font-bold text-sm tracking-wide text-text-primary">
            {complaint.issue_type}
          </span>
          <span className="text-text-secondary text-xs">•</span>
          <span className="text-text-secondary text-[0.65rem] uppercase tracking-wider">
            {complaint.complaint_ref_id}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Priority Badge */}
          <span className={`badge border text-[0.65rem] py-1 px-3 ${priority.bg} ${priority.glow}`}>
            {priority.label} ({complaint.priority_score})
          </span>
          {/* Trust Badge */}
          <span className={`badge bg-gradient-to-r border text-[0.65rem] py-1 px-3 ${trust.bg} ${trust.glow} flex items-center gap-1`}>
            {complaint.trust_level === 'High Trust' && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            )}
            {complaint.trust_level === 'Verified' && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
            )}
            {trust.label}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-text-secondary text-xs leading-relaxed">
        {complaint.description || 'No description provided.'}
      </p>

      {/* Verification Feedback Banner */}
      <AnimatePresence>
        {verifFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-2.5 rounded-xl bg-secondary/15 border border-secondary/30 text-secondary text-center text-xs font-semibold"
          >
            {verifFeedback}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Complaint Status & Timestamp */}
      <div className="flex items-center justify-between text-[0.7rem] text-text-secondary mt-1 border-t border-white/5 pt-3">
        <span>Reported: {complaint.created_at ? new Date(complaint.created_at).toLocaleDateString() : 'N/A'}</span>
        <span className={`badge ${complaint.status === 'Resolved' ? 'badge-good' : complaint.status === 'Forwarded' ? 'badge-fair' : 'badge-poor'}`}>
          {complaint.status}
        </span>
      </div>

      {/* Interactive Actions Grid */}
      <div className="flex items-center gap-2.5 mt-2">
        {/* Upvote Downvote Controls */}
        <div className="flex items-center gap-1.5 bg-surface-light/40 border border-white/5 rounded-xl p-1 shrink-0">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleVote('upvote')}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              userVote === 'upvote' 
                ? 'bg-secondary/20 text-secondary border border-secondary/30' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
            data-tooltip="Audit support (Upvote)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill={userVote === 'upvote' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
          </motion.button>
          
          <span className="text-xs font-bold font-heading px-1 min-w-[1.2rem] text-center">
            {complaint.upvotes - complaint.downvotes}
          </span>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleVote('downvote')}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              userVote === 'downvote' 
                ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                : 'text-text-secondary hover:text-red-400'
            }`}
            data-tooltip="Audit dispute (Downvote)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill={userVote === 'downvote' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm12-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
            </svg>
          </motion.button>
        </div>

        {/* Verification Trigger Button */}
        <div className="relative flex-1">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowVerifyDropdown(!showVerifyDropdown)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold font-heading border border-secondary/30 bg-secondary/10 hover:bg-secondary/20 text-secondary transition-all cursor-pointer"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3"/>
            </svg>
            Audit & Verify
          </motion.button>

          {/* Verification Dropdown Modal */}
          <AnimatePresence>
            {showVerifyDropdown && (
              <>
                {/* Backdrop cover */}
                <div className="fixed inset-0 z-10" onClick={() => setShowVerifyDropdown(false)} />
                
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full mb-2 right-0 left-0 sm:left-auto sm:w-64 glass-strong p-3 z-20 space-y-1.5 shadow-2xl"
                >
                  <p className="text-[0.65rem] text-text-secondary uppercase tracking-wider font-bold mb-2 px-1 text-center">
                    Community Verification
                  </p>
                  
                  {[
                    {
                      id: 'confirm',
                      label: 'I Confirm This Issue',
                      desc: 'Validates road distress exists.',
                      weight: '+1 score',
                      icon: <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                    },
                    {
                      id: 'severity_increased',
                      label: 'Severity Increased',
                      desc: 'Condition worsened significantly.',
                      weight: '+2 score',
                      icon: <path d="M18 15l-6-6-6 6"/>
                    },
                    {
                      id: 'resolved',
                      label: 'Issue Resolved',
                      desc: 'Audit repair completeness.',
                      weight: 'Citizen close',
                      icon: <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3"/>
                    }
                  ].map((act) => {
                    const active = userVerifications.includes(act.id);
                    return (
                      <button
                        key={act.id}
                        disabled={active || verifying}
                        onClick={() => handleVerify(act.id)}
                        className={`w-full text-left p-2 rounded-xl border transition-all flex items-start gap-2 cursor-pointer ${
                          active 
                            ? 'bg-secondary/10 border-secondary/20 text-secondary opacity-60' 
                            : 'bg-surface-light/30 border-white/5 hover:bg-surface-light hover:border-secondary/20'
                        }`}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mt-0.5 text-secondary shrink-0">
                          {act.icon}
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold leading-tight flex items-center justify-between gap-1">
                            <span className="truncate">{act.label}</span>
                            <span className="text-[0.6rem] font-bold text-accent shrink-0 uppercase tracking-wide bg-accent/10 px-1.5 py-0.5 rounded-full">
                              {act.weight}
                            </span>
                          </p>
                          <p className="text-[0.55rem] text-text-secondary mt-0.5 truncate leading-none">
                            {act.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
