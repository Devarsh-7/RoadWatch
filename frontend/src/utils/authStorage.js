/**
 * authStorage.js — Secure session-scoped storage for admin authentication.
 * Uses sessionStorage so credentials/tokens are automatically wiped on tab/browser close,
 * and purges legacy localStorage keys to prevent stale session persistence.
 */

const KEYS = [
  'admin_token',
  'admin_role',
  'admin_name',
  'admin_state',
  'admin_district'
];

export const authStorage = {
  getToken: () => sessionStorage.getItem('admin_token'),
  getRole: () => sessionStorage.getItem('admin_role'),
  getName: () => sessionStorage.getItem('admin_name'),
  getState: () => sessionStorage.getItem('admin_state'),
  getDistrict: () => sessionStorage.getItem('admin_district'),

  setSession: ({ token, role, name, state, district }) => {
    if (token) sessionStorage.setItem('admin_token', token);
    if (role) sessionStorage.setItem('admin_role', role);
    if (name) sessionStorage.setItem('admin_name', name);
    sessionStorage.setItem('admin_state', state || '');
    sessionStorage.setItem('admin_district', district || '');

    // Purge any legacy localStorage keys
    KEYS.forEach((k) => localStorage.removeItem(k));
    window.dispatchEvent(new Event('admin-auth-changed'));
  },

  clearSession: () => {
    KEYS.forEach((k) => {
      sessionStorage.removeItem(k);
      localStorage.removeItem(k);
    });
    window.dispatchEvent(new Event('admin-auth-changed'));
  },

  isLoggedIn: () => {
    return !!(sessionStorage.getItem('admin_token') && sessionStorage.getItem('admin_role'));
  },

  purgeLegacyLocalStorage: () => {
    KEYS.forEach((k) => localStorage.removeItem(k));
  }
};
