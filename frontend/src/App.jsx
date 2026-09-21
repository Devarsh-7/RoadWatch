/**
 * App.jsx — Root component with routing, page transitions, and layout.
 */
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useEffect, lazy, Suspense } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './pages/LandingPage';

const SearchPage = lazy(() => import('./pages/SearchPage'));
const RoadDetailPage = lazy(() => import('./pages/RoadDetailPage'));
const ComplaintPage = lazy(() => import('./pages/ComplaintPage'));
const ChatbotPage = lazy(() => import('./pages/ChatbotPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const RepairTrackingPage = lazy(() => import('./pages/RepairTrackingPage'));
const RepairDashboardPage = lazy(() => import('./pages/RepairDashboardPage'));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));

function PageFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-secondary/20 border-t-secondary animate-spin" />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Suspense fallback={<PageFallback />}>
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
      </Suspense>
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
      try {
        const { syncQueuedComplaints } = await import('./api');
        const synced = await syncQueuedComplaints();
        if (synced > 0) {
          console.log(`Synced ${synced} queued complaint(s)`);
        }
      } catch (e) {
        console.error('Failed to sync complaints:', e);
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
