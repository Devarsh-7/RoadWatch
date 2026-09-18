/**
 * App.jsx — Root component with routing, page transitions, and layout.
 */
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { syncQueuedComplaints } from './api';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './pages/LandingPage';
import SearchPage from './pages/SearchPage';
import RoadDetailPage from './pages/RoadDetailPage';
import ComplaintPage from './pages/ComplaintPage';
import ChatbotPage from './pages/ChatbotPage';
import DashboardPage from './pages/DashboardPage';
import RepairTrackingPage from './pages/RepairTrackingPage';
import RepairDashboardPage from './pages/RepairDashboardPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/road/:id" element={<RoadDetailPage />} />
        <Route path="/complaint" element={<ComplaintPage />} />
        <Route path="/chatbot" element={<ChatbotPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/repair/:roadId" element={<RepairTrackingPage />} />
        <Route path="/repair-dashboard" element={<RepairDashboardPage />} />
        <Route path="/admin-login" element={<AdminLoginPage />} />
        <Route path="/admin-dashboard" element={<AdminDashboardPage />} />
      </Routes>
    </AnimatePresence>
  );
}

function LayoutWrapper({ children }) {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin-dashboard') || location.pathname.startsWith('/admin-login');

  return (
    <div className="min-h-screen flex flex-col">
      {!isAdmin && <Navbar />}
      <main className="flex-1">
        {children}
      </main>
      {!isAdmin && <Footer />}
    </div>
  );
}

export default function App() {
  // Sync queued complaints when coming back online
  useEffect(() => {
    const handleOnline = async () => {
      const synced = await syncQueuedComplaints();
      if (synced > 0) {
        console.log(`Synced ${synced} queued complaint(s)`);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return (
    <Router>
      <LayoutWrapper>
        <AnimatedRoutes />
      </LayoutWrapper>
    </Router>
  );
}
