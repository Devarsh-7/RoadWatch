import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageTransition from '../components/PageTransition';
import RoadCard from '../components/RoadCard';
import { searchRoads, fetchRoads, fetchNearbyRoads } from '../api';

const filters = ['All', 'NH', 'SH', 'MDR'];
const condFilters = ['All Conditions', 'Good', 'Fair', 'Poor'];

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [activeFilter, setActiveFilter] = useState('All');
  const [condFilter, setCondFilter] = useState('All Conditions');
  const [roads, setRoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadRoads(); }, [params, activeFilter]);

  const loadRoads = async () => {
    setLoading(true); setError('');
    try {
      const lat = params.get('lat'), lng = params.get('lng'), q = params.get('q');
      const type = activeFilter === 'All' ? undefined : activeFilter;
      let res;
      if (lat && lng) res = await fetchNearbyRoads(+lat, +lng);
      else if (q) res = await searchRoads(q, type);
      else res = await fetchRoads({ road_type: type });
      setRoads(res.data);
    } catch { setError('Failed to load roads.'); }
    setLoading(false);
  };

  const filtered = condFilter === 'All Conditions' ? roads : roads.filter(r => r.condition === condFilter);

  return (
    <PageTransition>
      <div className="min-h-screen pt-32 pb-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          {/* Search */}
          <form onSubmit={(e) => { e.preventDefault(); query.trim() ? setParams({ q: query.trim() }) : setParams({}); }} className="flex gap-3 mb-8">
            <div className="relative flex-1">
              <svg className="absolute left-5 top-1/2 -translate-y-1/2 text-text-secondary" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search roads by name, NH number, state..." className="input-field !pl-12" />
            </div>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" className="btn-primary px-6 text-sm shrink-0">Search</motion.button>
          </form>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-5">
            {filters.map((f) => (
              <motion.button key={f} whileTap={{ scale: 0.95 }} onClick={() => setActiveFilter(f)} className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${activeFilter === f ? 'bg-secondary/15 border-secondary/30 text-secondary' : 'bg-surface-light/50 border-white/5 text-text-secondary hover:border-white/10 hover:text-text-primary'}`}>
                {f === 'All' ? 'All Types' : f}
              </motion.button>
            ))}
            <span className="text-text-secondary/20 mx-1 self-center">|</span>
            {condFilters.map((f) => (
              <motion.button key={f} whileTap={{ scale: 0.95 }} onClick={() => setCondFilter(f)} className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${condFilter === f ? 'bg-secondary/15 border-secondary/30 text-secondary' : 'bg-surface-light/50 border-white/5 text-text-secondary hover:border-white/10 hover:text-text-primary'}`}>
                {f}
              </motion.button>
            ))}
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-8 mt-2">
            <h2 className="font-heading text-xl font-semibold">
              {params.get('q') ? `Results for "${params.get('q')}"` : params.get('lat') ? 'Nearby Roads' : 'All Roads'}
            </h2>
            <div className="flex items-center gap-2">
              <div className="pulse-live" />
              <span className="text-text-secondary text-xs">{filtered.length} found</span>
            </div>
          </div>

          {error && (
            <div className="glass p-6 text-center text-danger mb-6">
              <p>{error}</p>
              <button onClick={loadRoads} className="btn-outline mt-3 text-sm">Retry</button>
            </div>
          )}

          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass p-5 space-y-3"><div className="skeleton h-6 w-3/4" /><div className="skeleton h-4 w-1/2" /><div className="skeleton h-3 w-full mt-4" /><div className="skeleton h-3 w-2/3" /></div>
              ))}
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((road, i) => <RoadCard key={road.id} road={road} index={i} />)}
            </div>
          )}

          {!loading && filtered.length === 0 && !error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-surface-light flex items-center justify-center">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-secondary"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /><path d="M8 11h6" /></svg>
              </div>
              <h3 className="font-heading text-lg font-semibold mb-2">No Roads Found</h3>
              <p className="text-text-secondary text-sm">Try a different search or adjust filters</p>
            </motion.div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
