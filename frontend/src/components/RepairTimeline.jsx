import { motion } from 'framer-motion';

const STAGES = [
  { name: "Complaint Registered", desc: "Citizen complaint received and categorized by PWD/NHAI routing engines." },
  { name: "Inspection Pending", desc: "Structural assessment survey scheduled by regional executive engineer." },
  { name: "Repair Approved", desc: "Project sanctioned, budget allocated, and contractor assigned." },
  { name: "Repair In Progress", desc: "Machinery mobilized. Grading, milling, and paving works live." },
  { name: "Repair Completed", desc: "Wearing coats rolled and lane markings finalized. Citizen checking live." },
  { name: "Quality Verification", desc: "Community audit consensus validates quality scores before closing." }
];

export default function RepairTimeline({ repair, logs = [] }) {
  if (!repair) return null;

  const currentStatus = repair.repair_status || "Complaint Registered";
  const currentStageIndex = STAGES.findIndex(s => s.name.toLowerCase() === currentStatus.toLowerCase());

  // Group logs by stage name for easy reference
  const logsByStage = {};
  logs.forEach(log => {
    logsByStage[log.stage] = log;
  });

  return (
    <div className="relative pl-8 md:pl-12 py-4">
      {/* Vertical connector track line */}
      <div className="repair-timeline-track" />

      <div className="space-y-10">
        {STAGES.map((stage, idx) => {
          const isCompleted = idx < currentStageIndex;
          const isActive = idx === currentStageIndex;
          const isPending = idx > currentStageIndex;

          const stageLog = logsByStage[stage.name];
          const timestamp = stageLog ? new Date(stageLog.logged_at).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) : null;

          return (
            <motion.div 
              key={stage.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.4 }}
              className="relative flex flex-col md:flex-row md:items-start gap-4 md:gap-8"
            >
              {/* Timeline Bubble Node */}
              <div className="absolute -left-12 md:-left-16 top-0 flex items-center justify-center">
                <div className={`repair-timeline-node ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                  {isCompleted ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" className="text-white" viewBox="0 0 16 16">
                      <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                    </svg>
                  ) : isActive ? (
                    <div className="w-3.5 h-3.5 rounded-50% bg-secondary pulse-live" />
                  ) : (
                    <span className="text-xs font-bold text-text-secondary">{idx + 1}</span>
                  )}
                </div>
              </div>

              {/* Stage description & logs card */}
              <div className={`flex-1 glass p-5 rounded-2xl border transition-all duration-300 ${
                isActive ? 'border-secondary/40 glow-green' : 'border-white/5 opacity-70'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h4 className={`text-base font-bold font-heading ${isActive ? 'text-secondary' : 'text-text-primary'}`}>
                    {stage.name}
                  </h4>
                  {timestamp && (
                    <span className="text-xs text-secondary font-medium px-2.5 py-0.5 rounded-full bg-secondary/10 border border-secondary/15">
                      {timestamp}
                    </span>
                  )}
                </div>

                <p className="text-xs text-text-secondary leading-relaxed mb-3">
                  {stage.desc}
                </p>

                {/* Audit details if logs exist */}
                {stageLog && (
                  <div className="mt-3 pt-3 border-t border-white/5 bg-white/2 rounded-xl p-3">
                    <p className="text-xs text-text-primary italic leading-relaxed">
                      "{stageLog.note || 'Status transitioned by authority engine.'}"
                    </p>
                    {stageLog.logged_by && (
                      <span className="block mt-2 text-[10px] text-text-secondary text-right font-medium font-heading">
                        — Authorized by: {stageLog.logged_by}
                      </span>
                    )}
                  </div>
                )}

                {/* Additional metadata context */}
                {isActive && stage.name === "Repair Approved" && repair.contractor_name && (
                  <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] bg-white/3 rounded-xl p-3 border border-white/5">
                    <div>
                      <span className="text-text-secondary block">Assigned Contractor</span>
                      <strong className="text-text-primary">{repair.contractor_name}</strong>
                    </div>
                    <div>
                      <span className="text-text-secondary block">Projected Cost</span>
                      <strong className="text-accent">₹ {repair.repair_cost ? `${repair.repair_cost} Lakhs` : 'Not Sanctioned'}</strong>
                    </div>
                  </div>
                )}

                {isActive && stage.name === "Repair In Progress" && repair.expected_completion && (
                  <div className="mt-3 text-[11px] bg-white/3 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-text-secondary block">Estimated Completion Date</span>
                      <strong className="text-text-primary">
                        {new Date(repair.expected_completion).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </strong>
                    </div>
                    {new Date(repair.expected_completion) < new Date() && (
                      <span className="badge badge-poor text-[10px] flex items-center gap-1">
                        ⚠️ PROJECT DELAYED
                      </span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
