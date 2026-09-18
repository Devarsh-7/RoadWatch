import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import PageTransition from '../components/PageTransition';

const HeroScene = lazy(() => import('../components/HeroScene'));

/* ── Animated number counter (no external dep) ────── */
function AnimatedNumber({ target, suffix = '', duration = 2000 }) {
  const [val, setVal] = useState(0);
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.5 });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const startTime = performance.now();
    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setVal(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {val.toLocaleString()}{suffix}
    </span>
  );
}

/* ── Floating Particles ────── */
function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="particle"
          style={{
            left: `${Math.random() * 100}%`,
            bottom: `-10px`,
            opacity: Math.random() * 0.4 + 0.1,
            width: `${Math.random() * 3 + 2}px`,
            height: `${Math.random() * 3 + 2}px`,
            animationDuration: `${Math.random() * 15 + 10}s`,
            animationDelay: `${Math.random() * 10}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ── Text Typewriter ────── */
function TypeWriter({ words, className }) {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const word = words[idx];
    const speed = deleting ? 40 : 80;
    const timer = setTimeout(() => {
      if (!deleting && text === word) {
        setTimeout(() => setDeleting(true), 2000);
      } else if (deleting && text === '') {
        setDeleting(false);
        setIdx((prev) => (prev + 1) % words.length);
      } else {
        setText(deleting ? word.slice(0, text.length - 1) : word.slice(0, text.length + 1));
      }
    }, speed);
    return () => clearTimeout(timer);
  }, [text, deleting, idx, words]);

  return (
    <span className={className}>
      {text}<span className="animate-pulse text-accent">|</span>
    </span>
  );
}

const features = [
  {
    icon: <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />,
    iconExtra: <circle cx="12" cy="10" r="3" />,
    title: 'Road Intelligence',
    desc: 'Search any NH, SH, or MDR. Instantly see contractor, repair timeline, and condition rating.',
    color: 'from-primary to-secondary',
  },
  {
    icon: <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />,
    iconExtra: <path d="M2 12h4m12 0h4M12 2v4m0 12v4" />,
    title: 'Budget Transparency',
    desc: 'Real-time sanctioned vs spent tracking. Transparency scores backed by RTI data sources.',
    color: 'from-accent to-warning',
  },
  {
    icon: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />,
    iconExtra: null,
    title: 'AI-Powered Insights',
    desc: 'Ask our RAG chatbot anything about road quality. Powered by Gemini + vector search.',
    color: 'from-indigo to-secondary',
  },
];

const stats = [
  { val: 500, suffix: '+', label: 'Roads Tracked', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
  { val: 2400, suffix: ' Cr', label: 'Budget Monitored', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  { val: 12000, suffix: '+', label: 'Complaints Filed', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { val: 14, suffix: '', label: 'States Covered', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064' },
];

export default function LandingPage() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) navigate(`/search?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <PageTransition>
      {/* ── Hero ─────────────────────────────── */}
      <motion.section ref={heroRef} style={{ opacity: heroOpacity, scale: heroScale }} className="relative min-h-screen flex items-center overflow-hidden">
        <Particles />

        <div className="absolute inset-0 md:left-[40%] opacity-50 md:opacity-70">
          <Suspense fallback={<div className="w-full h-full" />}>
            <HeroScene />
          </Suspense>
        </div>

        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/95 to-bg/30 z-10" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-bg to-transparent z-10" />

        <div className="relative z-20 max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 pt-32 pb-20 w-full">
          <div className="max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}>
              <div className="flex items-center gap-2 mb-6">
                <div className="pulse-live" />
                <span className="badge badge-nh">Live Road Data Platform</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold font-heading leading-[1.1] mb-2">
                Know Your Road.
              </h1>
              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold font-heading leading-[1.1] mb-6">
                <span className="text-glow text-secondary">
                  <TypeWriter words={['Hold Them Accountable.', 'Track Every Rupee.', 'Demand Better Roads.']} />
                </span>
              </h1>

              <p className="text-text-secondary text-base sm:text-lg leading-relaxed mb-10 max-w-xl">
                India's first open road data platform. Search any road, see who built it, how much was spent, and file complaints that reach the right authority.
              </p>
            </motion.div>

            {/* Search bar */}
            <motion.form
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              onSubmit={handleSearch}
              className="flex flex-col sm:flex-row gap-3"
            >
              <div className="relative flex-1">
                <svg className="absolute left-5 top-1/2 -translate-y-1/2 text-text-secondary" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                <input
                  type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Enter road name, NH number, or state..."
                  className="input-field !pl-12 py-4 text-sm"
                />
              </div>
              <button type="submit" className="btn-primary px-8 py-4 text-sm shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                Search
              </button>
            </motion.form>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="flex items-center gap-4 mt-4">
              <button
                onClick={() => navigator.geolocation?.getCurrentPosition((p) => navigate(`/search?lat=${p.coords.latitude}&lng=${p.coords.longitude}`), () => alert('Location denied'))}
                className="flex items-center gap-2 text-text-secondary hover:text-secondary text-sm transition-colors cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4m10-10h-4M6 12H2" /></svg>
                Use My Location
              </button>
              <span className="text-text-secondary/30">|</span>
              <button onClick={() => navigate('/search')} className="text-text-secondary hover:text-secondary text-sm transition-colors cursor-pointer">Browse All Roads</button>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* ── Stats ────────────────────────────── */}
      <section className="relative z-20 -mt-14 mb-20">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="glass glow-green p-6 md:p-8 grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }} className="text-center group">
                <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-secondary"><path d={s.icon} /></svg>
                </div>
                <p className="text-2xl md:text-3xl font-bold font-heading text-accent mb-0.5">
                  <AnimatedNumber target={s.val} suffix={s.suffix} />
                </p>
                <p className="text-text-secondary text-xs">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────── */}
      <section className="py-20 relative">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <span className="badge badge-nh mb-4">Core Features</span>
            <h2 className="text-3xl md:text-4xl font-bold font-heading mb-4">
              Transparency at Your <span className="text-secondary text-glow">Fingertips</span>
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto leading-relaxed">
              RoadWatch combines open government data, AI intelligence, and citizen power to keep road authorities accountable.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.6 }}
                whileHover={{ y: -8 }}
                className="glass p-8 group cursor-pointer relative overflow-hidden"
              >
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${f.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${f.color} bg-opacity-10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
                  style={{ background: `linear-gradient(135deg, rgba(45,106,79,0.15), rgba(82,183,136,0.1))` }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-secondary">
                    {f.icon}{f.iconExtra}
                  </svg>
                </div>
                <h3 className="font-heading font-semibold text-lg mb-3 group-hover:text-secondary transition-colors">{f.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────── */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-heading mb-4">How It Works</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-12 left-[16.5%] right-[16.5%] h-0.5 bg-gradient-to-r from-primary via-secondary to-accent opacity-30" />
            {[
              { step: '01', title: 'Search', desc: 'Enter any road name, NH number, or use your GPS location to find nearby roads.' },
              { step: '02', title: 'Investigate', desc: 'See full details — contractor, budget spent vs sanctioned, last repair date, and transparency score.' },
              { step: '03', title: 'Take Action', desc: 'File a complaint routed automatically to NHAI, PWD, or District Collector based on road type.' },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.2 }} className="text-center relative">
                <motion.div whileHover={{ scale: 1.1, rotate: 5 }} className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xl font-bold font-heading shadow-lg shadow-primary/20">
                  {s.step}
                </motion.div>
                <h3 className="font-heading font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed max-w-xs mx-auto">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────── */}
      <section className="py-16 mb-10">
        <div className="max-w-4xl mx-auto px-6 sm:px-8">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="glass glow-green p-10 md:p-16 text-center relative overflow-hidden">
            <Particles />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold font-heading mb-4">Seen a Bad Road?</h2>
              <p className="text-text-secondary mb-8 max-w-lg mx-auto">
                Your complaint is automatically routed to the correct authority: NH → NHAI, SH → State PWD, MDR → District Collector.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={() => navigate('/complaint')} className="btn-accent text-base px-10 py-4">
                  File a Complaint Now
                </button>
                <button onClick={() => navigate('/chatbot')} className="btn-outline text-base px-10 py-4">
                  Ask AI Assistant
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </PageTransition>
  );
}
