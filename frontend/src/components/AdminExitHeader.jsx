import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * AdminExitHeader — A unified premium navigation header for administrative portals.
 * Renders a sticky glassmorphic exit bar with clear, non-ambiguous call-to-actions,
 * visual micro-animations, and responsive mobile panel toggles.
 *
 * @param {boolean} sidebarOpen - Current state of the dashboard sidebar
 * @param {function} onToggleSidebar - Callback to toggle the dashboard sidebar
 * @param {boolean} showToggle - Whether to show the mobile menu hamburger toggle
 * @param {string} subtitle - Secondary text under the portal title
 */
export default function AdminExitHeader({ 
  sidebarOpen = false, 
  onToggleSidebar = null, 
  showToggle = false,
  subtitle = "Secure Ledger System"
}) {
  const [isHovered, setIsHovered] = useState(false);

  const arrowVariants = {
    hover: { 
      x: -5,
      transition: { type: 'spring', stiffness: 300, damping: 15 } 
    },
    initial: { 
      x: 0,
      transition: { type: 'spring', stiffness: 300, damping: 15 } 
    }
  };

  return (
    <header className="glass-strong border-b border-white/5 bg-surface/85 backdrop-blur-xl px-6 lg:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40 w-full transition-all duration-300 rounded-t-none lg:rounded-t-2xl">
      
      {/* Left side: Mobile Toggle & Brand Indicator */}
      <div className="flex items-center gap-3">
        {showToggle && onToggleSidebar && (
          <button 
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-xl bg-white/5 border border-white/5 hover:border-secondary/20 hover:bg-secondary/10 text-text-secondary hover:text-secondary transition-all cursor-pointer"
            aria-label="Toggle Dashboard Menu"
          >
            {sidebarOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            )}
          </button>
        )}

        <div className="flex flex-col text-left">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse shadow-[0_0_8px_#52B788]" />
            <span className="font-heading font-bold text-xs uppercase tracking-wider text-text-primary">
              Road<span className="text-secondary">Watch</span> Command
            </span>
          </div>
          <span className="text-[10px] text-text-secondary leading-none mt-0.5">{subtitle}</span>
        </div>
      </div>

      {/* Right side: Premium Unambiguous Escape Hatch Button */}
      <div className="flex items-center gap-3">
        <Link 
          to="/"
          className="relative inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-heading font-bold text-text-primary hover:text-white bg-white/5 hover:bg-secondary/15 border border-white/5 hover:border-secondary/35 shadow-[0_2px_12px_rgba(82,183,136,0.08)] transition-all duration-300 group cursor-pointer"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <motion.span
            variants={arrowVariants}
            animate={isHovered ? "hover" : "initial"}
            className="text-sm leading-none"
          >
            ←
          </motion.span>
          <span className="tracking-wide">Back to Citizen Portal</span>
        </Link>
      </div>

    </header>
  );
}
