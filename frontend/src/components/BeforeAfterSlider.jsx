import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function BeforeAfterSlider({ beforeImage, afterImage, beforeLabel = "Before", afterLabel = "After" }) {
  const [sliderPosition, setSliderPosition] = useState(50); // percentage 0-100
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const handleMove = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const position = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(position);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    if (e.touches && e.touches[0]) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchend', handleMouseUp);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('touchmove', handleTouchMove);
    }

    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isDragging]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  return (
    <div 
      ref={containerRef} 
      className="comparison-slider-container"
      onMouseDown={handleMouseDown}
      onTouchStart={() => setIsDragging(true)}
    >
      {/* Before Image (underneath, left side showing) */}
      <img 
        src={beforeImage || "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?w=800"} 
        alt="Before Repair" 
        className="comparison-slider-image"
      />
      <div className="comparison-label before">{beforeLabel}</div>

      {/* After Image Overlay (revealed on the right side) */}
      <div 
        className="comparison-slider-overlay" 
        style={{ width: `${100 - sliderPosition}%` }}
      >
        <img 
          src={afterImage || "https://images.unsplash.com/photo-1594818379496-da1e345b0cd3?w=800"} 
          alt="After Repair" 
          className="comparison-slider-overlay-image"
          style={{ width: containerRef.current ? `${containerRef.current.offsetWidth}px` : '100%', right: 0 }}
        />
      </div>
      <div className="comparison-label after">{afterLabel}</div>

      {/* Drag Bar Handle */}
      <div 
        className="comparison-slider-handle" 
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="comparison-slider-handle-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
            <path fillRule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 0 1h-13A.5.5 0 0 1 1 8Zm7.5-3.5a.5.5 0 0 1 1 0v7a.5.5 0 0 1-1 0v-7Zm-3 0a.5.5 0 0 1 1 0v7a.5.5 0 0 1-1 0v-7Z"/>
          </svg>
        </div>
      </div>
      
      {/* Instructions Overlay */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-4 py-1 text-xs text-white/80 pointer-events-none tracking-wide font-heading">
        ↔ Drag handle to compare
      </div>
    </div>
  );
}
