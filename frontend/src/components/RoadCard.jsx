import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const RoadCard = ({ road, index = 0 }) => {
  const utilization = road.budget_sanctioned > 0 ? Math.round((road.budget_spent / road.budget_sanctioned) * 100) : 0;
  const score = road.transparency_score || 0;
  const scoreColor = score >= 75 ? '#34D399' : score >= 50 ? '#FBBF24' : '#F87171';
  const typeClass = { NH: 'badge-nh', SH: 'badge-sh', MDR: 'badge-mdr' }[road.road_type] || 'badge-nh';
  const condClass = { Good: 'badge-good', Fair: 'badge-fair', Poor: 'badge-poor' }[road.condition] || 'badge-fair';

  const repairDays = road.last_repair_date ? Math.floor((Date.now() - new Date(road.last_repair_date).getTime()) / 86400000) : null;
  const repairLabel = repairDays === null ? 'Unknown' : repairDays < 180 ? `${repairDays}d ago` : repairDays < 365 ? `${Math.floor(repairDays / 30)}mo ago` : `${Math.floor(repairDays / 365)}y ago`;
  const repairColor = repairDays === null ? 'text-text-secondary' : repairDays < 180 ? 'text-success' : repairDays < 365 ? 'text-warning' : 'text-danger';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="glass glow-green-hover p-5 flex flex-col gap-4 group cursor-pointer relative overflow-hidden"
    >
      {/* Hover gradient accent */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-accent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-semibold text-[0.95rem] text-text-primary truncate group-hover:text-secondary transition-colors duration-300">{road.road_name}</h3>
          <p className="text-text-secondary text-xs mt-1">{road.district}, {road.state}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`badge ${typeClass}`}>{road.road_type}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={`badge ${condClass}`}>{road.condition}</span>
        <span className={`text-xs font-medium ${repairColor}`}>Repaired: {repairLabel}</span>
      </div>

      {/* Budget */}
      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-text-secondary">Budget Used</span>
          <span className="text-text-primary font-semibold">{utilization}%</span>
        </div>
        <div className="progress-bar">
          <motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${Math.min(utilization, 100)}%` }} transition={{ delay: index * 0.04 + 0.3, duration: 1, ease: 'easeOut' }} />
        </div>
        <div className="flex justify-between text-[0.65rem] mt-1.5 text-text-secondary">
          <span>₹{road.budget_spent} Cr</span>
          <span>₹{road.budget_sanctioned} Cr</span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <div className="score-ring" style={{ '--ring-color': scoreColor, '--score': score }}>
          <span style={{ color: scoreColor }}>{score}</span>
        </div>
        <Link to={`/road/${road.id}`} className="text-sm text-secondary hover:text-accent font-medium transition-colors flex items-center gap-1 group/link">
          Details
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover/link:translate-x-1 transition-transform"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </Link>
      </div>
    </motion.div>
  );
};

export default RoadCard;
