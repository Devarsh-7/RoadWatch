import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import AdminExitHeader from '../components/AdminExitHeader';

const OFFICER_ROLES = [
  { role: 'Super Admin', username: 'admin', desc: 'Global system overview & authority control' },
  { role: 'State Authority', username: 'maharashtra_auth', desc: 'Maharashtra state level oversight' },
  { role: 'District Collector', username: 'pune_collector', desc: 'Pune district restricted scope' },
  { role: 'PWD Engineer', username: 'pwd_engineer', desc: 'Tamil Nadu Salem field execution scope' },
  { role: 'NHAI Officer', username: 'nhai_officer', desc: 'Tamil Nadu National Highways scope' },
  { role: 'Complaint Inspector', username: 'inspector', desc: 'Field inspections & verification' },
];

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Reset Password Modal States
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState(1); // 1: Request token, 2: Submit new password
  const [resetLoading, setResetLoading] = useState(false);
  const [resetStatus, setResetStatus] = useState({ type: '', text: '' });

  // Email verification resend state
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendStatus, setResendStatus] = useState('');

  const API_BASE = import.meta.env.VITE_API_URL || '';
  const isDemoMode = import.meta.env.VITE_DEMO_MODE !== 'false' && (import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true');

  // Validate active session on mount
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const role = localStorage.getItem('admin_role');

    if (token && role) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          if (payload.exp && payload.exp * 1000 > Date.now()) {
            navigate('/admin-dashboard');
            return;
          }
        }
      } catch (e) {
        // Corrupted token, wipe
      }
      // Expired or invalid
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_role');
      localStorage.removeItem('admin_name');
      localStorage.removeItem('admin_state');
      localStorage.removeItem('admin_district');
      setInfoMessage('Your previous session has expired. Please authenticate to continue.');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setError('');
    setInfoMessage('');
    setResendStatus('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE}/api/admin/login`, {
        username,
        password,
      });

      const { access_token, role, name, state, district } = response.data;
      localStorage.setItem('admin_token', access_token);
      localStorage.setItem('admin_role', role);
      localStorage.setItem('admin_name', name);
      localStorage.setItem('admin_state', state || '');
      localStorage.setItem('admin_district', district || '');

      navigate('/admin-dashboard');
    } catch (err) {
      const detail = err.response?.data?.detail || 'Authentication failed. Please verify credentials.';
      setError(detail);

      if (err.response?.status === 403 && detail.toLowerCase().includes('email verification')) {
        setUnverifiedEmail(username);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (officer) => {
    setUsername(officer.username);
    setPassword('');
    setError('');
    setInfoMessage(`Filled username for ${officer.role}. Enter your secure password.`);
  };

  const handleRequestResetToken = async (e) => {
    e.preventDefault();
    if (!resetEmail) {
      setResetStatus({ type: 'error', text: 'Please enter your registered email or username.' });
      return;
    }

    setResetLoading(true);
    setResetStatus({ type: '', text: '' });

    try {
      const res = await axios.post(`${API_BASE}/api/admin/forgot-password`, { email: resetEmail });
      setResetStatus({
        type: 'success',
        text: res.data.message || 'Reset token generated and expires in 15 minutes.'
      });
      if (res.data.dev_token) {
        setResetToken(res.data.dev_token);
      }
      setResetStep(2);
    } catch (err) {
      setResetStatus({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to request password reset token.'
      });
    } finally {
      setResetLoading(false);
    }
  };

  const handleConfirmReset = async (e) => {
    e.preventDefault();
    if (!resetToken || !newPassword) {
      setResetStatus({ type: 'error', text: 'Token and new password are required.' });
      return;
    }

    setResetLoading(true);
    setResetStatus({ type: '', text: '' });

    try {
      const res = await axios.post(`${API_BASE}/api/admin/reset-password`, {
        token: resetToken,
        new_password: newPassword,
      });

      setResetStatus({
        type: 'success',
        text: res.data.message || 'Password reset successfully! Please log in with your new password.'
      });
      setTimeout(() => {
        setShowResetModal(false);
        setResetStep(1);
        setResetStatus({ type: '', text: '' });
        setInfoMessage('Password successfully updated. You may now log in.');
      }, 2000);
    } catch (err) {
      setResetStatus({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to reset password. Token may have expired.'
      });
    } finally {
      setResetLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return;
    try {
      setResendStatus('Dispatching verification token...');
      const res = await axios.post(`${API_BASE}/api/admin/resend-verification`, {
        email: unverifiedEmail
      });
      setResendStatus(res.data.message || 'Verification email dispatched.');
    } catch (err) {
      setResendStatus(err.response?.data?.detail || 'Failed to resend verification link.');
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col w-full bg-bg">
      <AdminExitHeader subtitle="Smart Governance Authorization" />

      <div className="flex-1 flex items-center justify-center px-4 py-12 relative overflow-hidden">
        {/* Background Decorative Rings */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-secondary/5 blur-[100px] pointer-events-none" />

        {/* Main Container */}
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 z-10">
          
          {/* Left column: Role Directory */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-5 flex flex-col justify-center text-left"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="pulse-live" />
              <span className="text-secondary font-heading font-semibold text-sm uppercase tracking-widest">Smart Governance System</span>
            </div>
            <h1 className="text-4xl font-heading font-bold text-glow mb-4 leading-tight">
              Authority portal <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-secondary via-primary-light to-accent">RoadWatch Command</span>
            </h1>
            <p className="text-text-secondary text-sm mb-8 leading-relaxed">
              Welcome to the secure administrative control dashboard. Inspect citizen reports, approve road works, track contractor SLA breaches, manage sanction limits, and leverage predictive diagnostics.
            </p>

            {/* Officer Accounts Directory (Evaluation & Sandbox Mode) */}
            {isDemoMode ? (
              <div className="glass p-6 border-secondary/15">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-heading font-semibold text-sm text-accent flex items-center gap-2">
                    <span>🛡️</span> Officer Roles & Scopes
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20 font-medium">
                    Demo Sandbox
                  </span>
                </div>
                <p className="text-xs text-text-secondary mb-4">
                  Evaluation mode: Click any role to pre-fill the username for that administrative jurisdiction:
                </p>
                <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {OFFICER_ROLES.map((officer) => (
                    <button
                      key={officer.role}
                      type="button"
                      onClick={() => handleQuickFill(officer)}
                      className="w-full text-left text-xs p-2.5 rounded-lg bg-surface-light/40 border border-white/5 hover:border-secondary/40 hover:bg-surface-light/80 transition-all flex items-center justify-between group"
                    >
                      <div>
                        <div className="font-medium text-text-primary group-hover:text-secondary transition-colors">{officer.role}</div>
                        <div className="text-[10px] text-text-secondary">{officer.desc}</div>
                      </div>
                      <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded border border-secondary/10 group-hover:bg-secondary group-hover:text-white transition-all">Select</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="glass p-6 border-white/10 text-left">
                <h3 className="font-heading font-semibold text-sm text-text-primary mb-2 flex items-center gap-2">
                  <span>🔒</span> Restricted Authority Access
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  This portal is reserved for authorized PWD, NHAI, District Collectorate, and Municipal road authorities. Unauthorized access attempts are monitored and logged.
                </p>
              </div>
            )}
          </motion.div>

          {/* Right column: Login Form Card */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="lg:col-span-7 flex items-center justify-center"
          >
            <div className="glass-strong glow-green w-full max-w-lg p-8 sm:p-10 border-white/5">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-heading font-bold text-text-primary mb-2">Secure Authentication</h2>
                <p className="text-xs text-text-secondary">Protected by rate limiting & adaptive cryptographic tokens</p>
              </div>

              {infoMessage && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary-light text-left flex items-start gap-3"
                >
                  <span>ℹ️</span>
                  <div>{infoMessage}</div>
                </motion.div>
              )}

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 rounded-xl bg-danger/10 border border-danger/20 text-xs text-danger text-left flex flex-col gap-2"
                >
                  <div className="flex items-start gap-2">
                    <span>⚠️</span>
                    <div>{error}</div>
                  </div>
                  {unverifiedEmail && (
                    <div className="pt-2 border-t border-danger/15 flex items-center justify-between">
                      <span className="text-[11px] text-text-secondary">Need a verification link?</span>
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        className="text-[11px] font-semibold text-secondary hover:underline"
                      >
                        Resend Verification
                      </button>
                    </div>
                  )}
                  {resendStatus && (
                    <div className="text-[11px] text-accent mt-1">{resendStatus}</div>
                  )}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6 text-left">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter administrator username"
                    className="input-field"
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Access Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field"
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-text-secondary pt-2">
                  <span className="text-[11px] text-text-muted">60-minute encrypted sessions</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetModal(true);
                      setResetStep(1);
                      setResetStatus({ type: '', text: '' });
                    }}
                    className="hover:text-secondary transition-colors text-xs font-medium"
                  >
                    Forgot key / password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full mt-4 flex items-center justify-center py-4 rounded-xl"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <span className="typing-dot" />
                      <span className="typing-dot animate-pulse" />
                      <span className="typing-dot" />
                    </div>
                  ) : (
                    <>
                      <span>Authorize Portal Session</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </motion.div>

        </div>
      </div>

      {/* Forgot / Reset Password Modal */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-strong border-white/10 rounded-2xl w-full max-w-md p-6 relative text-left"
            >
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="absolute top-4 right-4 text-text-muted hover:text-text-primary text-xl"
              >
                ✕
              </button>

              <h3 className="text-xl font-heading font-bold text-text-primary mb-1">
                {resetStep === 1 ? 'Recover Officer Access' : 'Set New Secure Password'}
              </h3>
              <p className="text-xs text-text-secondary mb-4">
                {resetStep === 1 
                  ? 'Request an expiring cryptographic reset token (15-minute window).' 
                  : 'Enter your verification token and set a strong new password.'}
              </p>

              {resetStatus.text && (
                <div className={`p-3 rounded-xl mb-4 text-xs ${
                  resetStatus.type === 'error'
                    ? 'bg-danger/10 border border-danger/20 text-danger'
                    : 'bg-secondary/10 border border-secondary/20 text-secondary'
                }`}>
                  {resetStatus.text}
                </div>
              )}

              {resetStep === 1 ? (
                <form onSubmit={handleRequestResetToken} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Registered Email or Username</label>
                    <input
                      type="text"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="e.g. admin@roadwatch.gov.in or admin"
                      className="input-field"
                      disabled={resetLoading}
                    />
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      onClick={() => setResetStep(2)}
                      className="text-xs text-secondary hover:underline"
                    >
                      Already have a token?
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="btn-primary py-2.5 px-5 rounded-lg text-xs"
                    >
                      {resetLoading ? 'Requesting...' : 'Send Reset Token'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleConfirmReset} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Reset Token</label>
                    <input
                      type="text"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Paste 32-character token"
                      className="input-field font-mono text-xs"
                      disabled={resetLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">New Password (min 8 chars, letters & numbers)</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="input-field"
                      disabled={resetLoading}
                    />
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      onClick={() => setResetStep(1)}
                      className="text-xs text-text-secondary hover:text-text-primary"
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="btn-primary py-2.5 px-5 rounded-lg text-xs"
                    >
                      {resetLoading ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
