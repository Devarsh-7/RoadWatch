import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const resolveMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  // Strip trailing slash if present
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  // Ensure url starts with slash
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${cleanBase}${cleanUrl}`;
};

export default function RepairMediaGallery({ media = [] }) {
  const [activeTab, setActiveTab] = useState('all');
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const filteredMedia = activeTab === 'all' 
    ? media 
    : media.filter(m => m.media_type === activeTab);

  const openLightbox = (index) => {
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
  };

  const nextMedia = () => {
    setLightboxIndex((prev) => (prev + 1) % filteredMedia.length);
  };

  const prevMedia = () => {
    setLightboxIndex((prev) => (prev - 1 + filteredMedia.length) % filteredMedia.length);
  };

  const tabs = [
    { id: 'all', label: 'All Media' },
    { id: 'before', label: 'Before Repair' },
    { id: 'during', label: 'During Progress' },
    { id: 'after', label: 'After Completion' }
  ];

  return (
    <div className="space-y-6">
      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/5 pb-4">
        {tabs.map((tab) => {
          const count = tab.id === 'all' 
            ? media.length 
            : media.filter(m => m.media_type === tab.id).length;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold font-heading cursor-pointer transition-all ${
                activeTab === tab.id 
                  ? 'bg-secondary text-white shadow-lg shadow-secondary/25' 
                  : 'bg-white/3 text-text-secondary hover:bg-white/5 border border-white/5'
              }`}
            >
              {tab.label} <span className="ml-1 opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Media Grid */}
      {filteredMedia.length === 0 ? (
        <div className="text-center py-12 bg-white/2 border border-white/5 rounded-2xl">
          <span className="text-2xl block mb-2">📸</span>
          <p className="text-xs text-text-secondary">No media files uploaded in this category yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredMedia.map((item, idx) => (
              <motion.div
                layout
                key={item.id || idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                onClick={() => openLightbox(idx)}
                className="group relative cursor-pointer overflow-hidden rounded-xl border border-white/5 bg-white/3 aspect-video hover:border-secondary/30"
              >
                <img
                  src={resolveMediaUrl(item.media_url)}
                  alt={item.caption}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Media Label Badge */}
                <div className="absolute top-2 left-2 z-10">
                  <span className={`badge text-[9px] px-2 py-0.5 font-bold ${
                    item.media_type === 'before' ? 'badge-poor' : 
                    item.media_type === 'during' ? 'badge-sh' : 'badge-good'
                  }`}>
                    {item.media_type}
                  </span>
                </div>

                {/* Info Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                  <p className="text-[11px] font-semibold text-white line-clamp-1">
                    {item.caption || `${item.media_type.charAt(0).toUpperCase() + item.media_type.slice(1)} repair image`}
                  </p>
                  <span className="text-[9px] text-text-secondary block mt-0.5">
                    {new Date(item.uploaded_at).toLocaleDateString('en-IN')}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Fullscreen Lightbox Portal */}
      <AnimatePresence>
        {lightboxIndex !== null && filteredMedia[lightboxIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4"
          >
            {/* Close Button */}
            <button 
              onClick={closeLightbox}
              className="absolute top-6 right-6 text-white/70 hover:text-white text-2xl font-bold cursor-pointer bg-white/5 w-11 h-11 rounded-full flex items-center justify-center border border-white/10"
            >
              ✕
            </button>

            {/* Slider Content */}
            <div className="relative w-full max-w-4xl max-h-[70vh] flex items-center justify-center">
              {/* Prev Button */}
              {filteredMedia.length > 1 && (
                <button 
                  onClick={prevMedia}
                  className="absolute -left-4 sm:left-4 z-20 text-white/70 hover:text-white bg-white/5 w-11 h-11 rounded-full flex items-center justify-center border border-white/10 text-xl"
                >
                  ◀
                </button>
              )}

              {/* Main Image */}
              <motion.img
                key={lightboxIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                src={resolveMediaUrl(filteredMedia[lightboxIndex].media_url)}
                alt={filteredMedia[lightboxIndex].caption}
                className="max-w-full max-h-[70vh] object-contain rounded-xl border border-white/5 shadow-2xl"
              />

              {/* Next Button */}
              {filteredMedia.length > 1 && (
                <button 
                  onClick={nextMedia}
                  className="absolute -right-4 sm:right-4 z-20 text-white/70 hover:text-white bg-white/5 w-11 h-11 rounded-full flex items-center justify-center border border-white/10 text-xl"
                >
                  ▶
                </button>
              )}
            </div>

            {/* Caption Info bottom card */}
            <div className="mt-6 text-center max-w-xl px-4">
              <span className={`badge text-[9px] font-bold tracking-wider mb-2.5 ${
                filteredMedia[lightboxIndex].media_type === 'before' ? 'badge-poor' : 
                filteredMedia[lightboxIndex].media_type === 'during' ? 'badge-sh' : 'badge-good'
              }`}>
                {filteredMedia[lightboxIndex].media_type} stage
              </span>
              <h4 className="text-sm font-bold font-heading text-white">
                {filteredMedia[lightboxIndex].caption || 'No description provided.'}
              </h4>
              {filteredMedia[lightboxIndex].file_name && (
                <span className="block text-[10px] text-text-secondary mt-1 font-mono">
                  File: {filteredMedia[lightboxIndex].file_name}
                </span>
              )}
              <span className="text-[10px] text-text-secondary block mt-1.5 font-heading">
                Date Uploaded: {new Date(filteredMedia[lightboxIndex].uploaded_at).toLocaleString('en-IN')}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
