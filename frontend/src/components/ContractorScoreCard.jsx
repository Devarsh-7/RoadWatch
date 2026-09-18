import { motion } from 'framer-motion';

export default function ContractorScoreCard({ contractor, index }) {
  if (!contractor) return null;

  const score = contractor.accountability_score || 0;
  
  // Color code based on performance
  const getScoreColor = (s) => {
    if (s >= 80) return 'text-success border-success/20 bg-success/5';
    if (s >= 60) return 'text-warning border-warning/20 bg-warning/5';
    return 'text-danger border-danger/20 bg-danger/5';
  };

  const getRankBadge = (idx) => {
    if (idx === 0) return '🥇 Rank 1';
    if (idx === 1) return '🥈 Rank 2';
    if (idx === 2) return '🥉 Rank 3';
    return `#${idx + 1}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={`glass p-5 rounded-2xl border ${getScoreColor(score)} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
    >
      <div className="space-y-2 flex-1">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold font-heading px-2 py-0.5 rounded bg-white/5 text-text-primary">
            {getRankBadge(index)}
          </span>
          <h4 className="text-sm font-bold font-heading text-text-primary">
            {contractor.contractor_name}
          </h4>
        </div>

        {/* Accountability KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-black/15 rounded-xl p-2 border border-white/5">
            <span className="text-[9px] uppercase tracking-wider text-text-secondary block">
              Total Repairs
            </span>
            <strong className="text-xs text-text-primary">
              {contractor.total_repairs} projects
            </strong>
          </div>

          <div className="bg-black/15 rounded-xl p-2 border border-white/5">
            <span className="text-[9px] uppercase tracking-wider text-text-secondary block">
              Success Rate
            </span>
            <strong className="text-xs text-success">
              {contractor.success_rate}%
            </strong>
          </div>

          <div className="bg-black/15 rounded-xl p-2 border border-white/5">
            <span className="text-[9px] uppercase tracking-wider text-text-secondary block">
              Public Rating
            </span>
            <strong className="text-xs text-accent">
              ★ {contractor.average_rating ? contractor.average_rating.toFixed(1) : 'N/A'}
            </strong>
          </div>

          <div className="bg-black/15 rounded-xl p-2 border border-white/5">
            <span className="text-[9px] uppercase tracking-wider text-text-secondary block">
              Repeat Repairs
            </span>
            <strong className={`text-xs ${contractor.repeat_repairs > 0 ? 'text-danger' : 'text-success'}`}>
              {contractor.repeat_repairs} failures
            </strong>
          </div>
        </div>
      </div>

      {/* Accountability score circular meter */}
      <div className="flex items-center gap-3 justify-end sm:border-l sm:border-white/5 sm:pl-6">
        <div className="text-right">
          <span className="text-[9px] uppercase tracking-wider text-text-secondary block">
            Accountability Index
          </span>
          <span className="text-xs font-bold text-text-primary block font-heading">
            {score >= 80 ? '🔒 HIGH TRUST' : score >= 60 ? '⚠️ MEDIUM RISK' : '🚨 CRITICAL PENALTY'}
          </span>
        </div>

        <div className="score-ring" style={{ '--score': score, '--ring-color': score >= 80 ? 'var(--color-success)' : score >= 60 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
          <span className="text-sm font-bold text-text-primary">{score}%</span>
        </div>
      </div>
    </motion.div>
  );
}
