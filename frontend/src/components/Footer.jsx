import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const links = [
  { to: '/search', label: 'Search Roads' },
  { to: '/complaint', label: 'File Complaint' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/chatbot', label: 'AI Chatbot' },
];

const sources = ['NHAI PMIS Portal', 'State PWD Records', 'District Collector Offices', 'RTI Responses'];

export default function Footer() {
  return (
    <footer className="border-t border-white/5 mt-16 relative z-10" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(14,21,37,0.8) 100%)' }}>
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2.5 mb-4 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M4 19L12 5L20 19" /><path d="M8 15H16" /></svg>
              </div>
              <span className="text-lg font-bold font-heading">Road<span className="text-secondary">Watch</span></span>
            </Link>
            <p className="text-text-secondary text-sm max-w-sm leading-relaxed mb-4">
              India's first AI-powered road transparency platform. Track budgets, report issues, and hold authorities accountable.
            </p>
            <div className="flex gap-3">
              {['github', 'twitter'].map((s) => (
                <motion.a key={s} href="#" whileHover={{ y: -2 }} className="w-9 h-9 rounded-xl bg-surface-light/50 flex items-center justify-center text-text-secondary hover:text-secondary hover:bg-surface-light transition-all">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>
                </motion.a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-xs uppercase tracking-widest text-text-secondary mb-4">Quick Links</h4>
            <div className="space-y-2.5">
              {links.map(({ to, label }) => (
                <Link key={to} to={to} className="block text-sm text-text-secondary hover:text-secondary transition-colors hover:translate-x-1 transform duration-200">{label}</Link>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-xs uppercase tracking-widest text-text-secondary mb-4">Data Sources</h4>
            <div className="space-y-2.5">
              {sources.map((s) => <p key={s} className="text-sm text-text-secondary">{s}</p>)}
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-text-secondary text-xs">&copy; 2026 RoadWatch. Built for IIT Madras Road Safety Hackathon.</p>
          <p className="text-text-secondary/50 text-xs">Made with transparency in mind</p>
        </div>
      </div>
    </footer>
  );
}
