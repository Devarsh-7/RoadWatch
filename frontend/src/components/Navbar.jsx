import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const navLinks = [
  { path: '/', label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4' },
  { path: '/search', label: 'Search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { path: '/repair-dashboard', label: 'Repair Tracker', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
  { path: '/dashboard', label: 'Dashboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m14 0V9a2 2 0 00-2-2h-2a2 2 0 00-2 2v10m0 0h6m-6 0H9' },
  { path: '/chatbot', label: 'AI Chat', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { path: '/admin-login', label: 'Officer Portal', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(true);
  const [activeToast, setActiveToast] = useState(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('admin_token');
      const role = localStorage.getItem('admin_role');
      setIsAdminLoggedIn(!!(token && role));
    };

    checkAuth();
    // Monitor storage updates or route changes for rapid response
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, [location.pathname]);

  const links = useMemo(() => {
    return navLinks.map(link => {
      if (link.path === '/admin-login' && isAdminLoggedIn) {
        return {
          ...link,
          path: '/admin-dashboard',
          label: 'Officer Console',
          isConsole: true
        };
      }
      return link;
    });
  }, [isAdminLoggedIn]);

  const [notifications, setNotifications] = useState([
    { id: 1, text: "Verification alert: Pothole report on NH-44 reached the community threshold!", time: "5m ago", type: "threshold" },
    { id: 2, text: "Resolution confirmed! Community SENTINEL consensus marked SH-68 Salem link as Resolved.", time: "1h ago", type: "resolved" },
    { id: 3, text: "NHAI engineer Er. Ramanathan responded to NH-44 Chennai Section complaint.", time: "2h ago", type: "authority" }
  ]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    const goOff = () => setIsOffline(true);
    const goOn = () => setIsOffline(false);
    window.addEventListener('scroll', onScroll);
    window.addEventListener('offline', goOff);
    window.addEventListener('online', goOn);
    return () => { 
      window.removeEventListener('scroll', onScroll); 
      window.removeEventListener('offline', goOff); 
      window.removeEventListener('online', goOn); 
    };
  }, []);

  useEffect(() => { setIsOpen(false); setShowNotifications(false); }, [location]);

  // Periodic Notification Simulator (Simulates real-world citizen activity)
  useEffect(() => {
    const alerts = [
      { text: "Nearby citizen marked 'Severity Increased' on SH-21 Kanpur link.", type: "severity" },
      { text: "Citizen Level Up! You've been awarded the 'Truth Seeker' badge.", type: "badge" },
      { text: "Your support vote on RW-2026-POT68 has been counted. Score updated!", type: "vote" },
      { text: "PWD scheduled maintenance relaying for SH-68 Salem link starting next week.", type: "authority" }
    ];

    let alertIdx = 0;
    const interval = setInterval(() => {
      if (alertIdx >= alerts.length) {
        clearInterval(interval);
        return;
      }
      
      const newAlert = {
        id: Date.now(),
        text: alerts[alertIdx].text,
        time: "Just now",
        type: alerts[alertIdx].type
      };

      setNotifications(prev => [newAlert, ...prev]);
      setUnreadNotifications(true);
      setActiveToast(newAlert.text);

      // Dismiss Toast after 5 seconds
      setTimeout(() => setActiveToast(null), 5000);
      alertIdx++;
    }, 45000); // Trigger a realistic alert every 45s

    return () => clearInterval(interval);
  }, []);

  const handleMarkRead = () => {
    setUnreadNotifications(false);
  };

  return (
    <>
      {isOffline && <div className="offline-badge">Offline Mode — Limited features</div>}

      {/* Real-time Toast Notification */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, x: 100, y: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed top-20 right-5 z-[9999] max-w-sm glass-strong p-4 border border-secondary/30 shadow-2xl flex gap-3 items-center"
          >
            <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center text-secondary text-sm shrink-0">
              🔔
            </div>
            <div>
              <p className="text-[0.65rem] text-text-secondary uppercase tracking-wider leading-none font-bold">Civic Event Alert</p>
              <p className="text-xs font-semibold text-text-primary mt-1 leading-snug">{activeToast}</p>
            </div>
            <button onClick={() => setActiveToast(null)} className="text-text-secondary hover:text-text-primary shrink-0 self-start text-xs cursor-pointer">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? 'glass-strong shadow-2xl' : ''
        }`}
        style={scrolled ? {} : { background: 'linear-gradient(180deg, rgba(6,11,24,0.9) 0%, transparent 100%)' }}
      >
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex items-center justify-between h-16 md:h-18">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <motion.div
                whileHover={{ rotate: 10, scale: 1.1 }}
                className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19L12 5L20 19" /><path d="M8 15H16" />
                </svg>
              </motion.div>
              <span className="text-lg font-bold font-heading tracking-tight">
                Road<span className="text-secondary">Watch</span>
              </span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-3 md:ml-8 lg:ml-16">
              {links.map(({ path, label, icon, isConsole }) => {
                const active = location.pathname === path;
                return (
                  <Link key={path} to={path} className="relative px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 group">
                    {active && (
                      <motion.div layoutId="navIndicator" className="absolute inset-0 bg-secondary/10 rounded-xl border border-secondary/35 shadow-[0_2px_12px_rgba(82,183,136,0.18)]" transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
                    )}
                    <span className={`relative z-10 flex items-center gap-2 ${active ? 'text-secondary' : 'text-text-secondary group-hover:text-text-primary'}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d={icon} />
                      </svg>
                      <span>{label}</span>
                      {isConsole && (
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse shadow-[0_0_6px_#52B788] ml-0.5" />
                      )}
                    </span>
                  </Link>
                );
              })}

              {/* Glowing Notification Bell (Desktop) */}
              <div className="relative ml-2 mr-1">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    handleMarkRead();
                  }}
                  className={`p-2.5 rounded-xl border transition-colors cursor-pointer relative ${
                    showNotifications 
                      ? 'bg-secondary/10 border-secondary/30 text-secondary' 
                      : 'bg-white/5 border-white/5 text-text-secondary hover:border-secondary/25 hover:text-text-primary'
                  }`}
                  aria-label="Civic Alerts"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {unreadNotifications && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_#52B788]" />
                  )}
                </motion.button>

                {/* Notifications Sliding Dropdown Dropdown */}
                <AnimatePresence>
                  {showNotifications && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 15, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 15, scale: 0.95 }}
                        className="absolute right-0 mt-3 w-80 glass-strong p-4 shadow-2xl z-20"
                      >
                        <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-3">
                          <span className="text-xs font-bold font-heading">Civic Alerts Portal</span>
                          <span className="text-[0.65rem] text-text-secondary uppercase tracking-wider">Live Tracking</span>
                        </div>

                        <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                          {notifications.map((notif) => (
                            <div key={notif.id} className="flex gap-2.5 items-start p-2 rounded-xl bg-surface-light/35 border border-white/5">
                              <span className="text-sm mt-0.5 select-none">
                                {notif.type === 'threshold' ? '🔥' : notif.type === 'resolved' ? '✅' : notif.type === 'authority' ? '🏛️' : notif.type === 'severity' ? '⚠️' : '⚡'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[0.7rem] leading-snug font-medium text-text-primary text-left">
                                  {notif.text}
                                </p>
                                <p className="text-[0.55rem] text-text-secondary mt-1">{notif.time}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <Link to="/complaint" className="ml-2 btn-accent text-xs py-2.5 px-5 shrink-0">
                Report Road
              </Link>
            </div>

            {/* Mobile notification & menu toggles */}
            <div className="md:hidden flex items-center gap-1.5">
              {/* Notifications bell for Mobile */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    handleMarkRead();
                  }}
                  className="p-2.5 rounded-xl border border-white/5 text-text-secondary bg-white/5"
                  aria-label="Civic Alerts"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {unreadNotifications && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_#52B788]" />
                  )}
                </button>

                {/* Mobile Notification Dropdown Panel */}
                <AnimatePresence>
                  {showNotifications && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 15 }}
                        className="fixed left-6 right-6 top-18 glass-strong p-4 shadow-2xl z-20 max-w-sm mx-auto"
                      >
                        <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-3">
                          <span className="text-xs font-bold font-heading">Civic Alerts Portal</span>
                          <span className="text-[0.65rem] text-text-secondary uppercase tracking-wider">Live</span>
                        </div>

                        <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                          {notifications.map((notif) => (
                            <div key={notif.id} className="flex gap-2.5 items-start p-2 rounded-xl bg-surface-light/35 border border-white/5 text-left">
                              <span className="text-sm select-none">
                                {notif.type === 'threshold' ? '🔥' : notif.type === 'resolved' ? '✅' : notif.type === 'authority' ? '🏛️' : notif.type === 'severity' ? '⚠️' : '⚡'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[0.68rem] leading-snug font-medium text-text-primary">
                                  {notif.text}
                                </p>
                                <p className="text-[0.55rem] text-text-secondary mt-1">{notif.time}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile menu toggle */}
              <button onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-xl hover:bg-white/5 transition-colors" aria-label="Toggle menu">
                {isOpen ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu panel */}
        <AnimatePresence>
          {isOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="md:hidden overflow-hidden glass-strong border-t border-white/5">
              <div className="p-4 space-y-1">
                {links.map(({ path, label, icon, isConsole }) => (
                  <Link key={path} to={path} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${location.pathname === path ? 'text-secondary bg-secondary/10' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
                    <span>{label}</span>
                    {isConsole && (
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse shadow-[0_0_6px_#52B788] ml-auto" />
                    )}
                  </Link>
                ))}
                <Link to="/complaint" className="block mt-3 btn-accent text-sm text-center py-3">
                  Report Road
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
    </>
  );
}
