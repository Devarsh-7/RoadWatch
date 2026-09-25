/**
 * api.js — Axios instance & API service for RoadWatch.
 * All backend calls go through here. Includes offline queue for complaints.
 */
import axios from 'axios';

import { authStorage } from './utils/authStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000, // 60s timeout to allow Render free tier cold-starts (typically takes 45-55s)
  headers: { 'Content-Type': 'application/json' },
});

// Automatically attach Authorization Bearer header if an active admin token exists
api.interceptors.request.use((config) => {
  const token = authStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Roads ────────────────────────────────────────────
export const fetchRoads = (params = {}) => api.get('/api/roads', { params });
export const searchRoads = (q, roadType) => api.get('/api/roads/search', { params: { q, road_type: roadType } });
export const fetchRoad = (id) => api.get(`/api/roads/${id}`);
export const fetchNearbyRoads = (lat, lng, radius = 50) => api.get('/api/roads/nearby', { params: { lat, lng, radius_km: radius } });

// ─── Complaints ───────────────────────────────────────
export const fileComplaint = (data) => api.post('/api/complaints', data);
export const fetchComplaints = (roadId, sortBy = 'recent') => api.get(`/api/complaints/${roadId}`, { params: { sort_by: sortBy } });
export const voteComplaint = (complaintId, data) => api.post(`/api/complaints/${complaintId}/vote`, data);
export const verifyComplaint = (complaintId, data) => api.post(`/api/complaints/${complaintId}/verify`, data);
export const fetchTrendingComplaints = (params = {}) => api.get('/api/complaints/trending', { params });
export const fetchPriorityComplaints = (params = {}) => api.get('/api/complaints/priority', { params });

// ─── Chat ─────────────────────────────────────────────
export const sendChatMessage = (message) => api.post('/api/chat', { message });

// ─── Stats ────────────────────────────────────────────
export const fetchStats = () => api.get('/api/stats');

// ─── Authorities ──────────────────────────────────────
export const fetchAuthorities = (state) => api.get('/api/authorities', { params: { state } });

// ─── Repair Tracking ──────────────────────────────────
export const fetchRepairHistory = (roadId) => api.get(`/api/roads/${roadId}/repair/history`);
export const startRepair = (roadId, data) => api.post(`/api/roads/${roadId}/repair/start`, data);
export const updateRepair = (roadId, data) => api.post(`/api/roads/${roadId}/repair/update`, data);
export const completeRepair = (roadId, notes) => api.post(`/api/roads/${roadId}/repair/complete`, null, { params: { notes } });
export const fetchActiveRepairs = () => api.get('/api/repairs/active');
export const fetchRepair = (id) => api.get(`/api/repairs/${id}`);
export const verifyRepairQuality = (id, data) => api.post(`/api/repairs/${id}/verify`, data);
export const fetchRepairsDashboard = () => api.get('/api/repairs/dashboard');

export const uploadRepairMedia = (roadId, file, mediaType, caption = '') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('media_type', mediaType);
  if (caption) {
    formData.append('caption', caption);
  }
  return api.post(`/api/roads/${roadId}/repair/media`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// ─── Device Identity (Civic Profile) ─────────────────
export const getDeviceId = () => {
  let deviceId = localStorage.getItem('roadwatch_device_id');
  if (!deviceId) {
    deviceId = 'rw_dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('roadwatch_device_id', deviceId);
  }
  return deviceId;
};

// ─── Offline complaint queue ──────────────────────────
const QUEUE_KEY = 'roadwatch_complaint_queue';

export const queueComplaint = (data) => {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  queue.push({ ...data, queued_at: new Date().toISOString() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const syncQueuedComplaints = async () => {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  if (queue.length === 0) return;

  const remaining = [];
  for (const complaint of queue) {
    try {
      await fileComplaint(complaint);
    } catch {
      remaining.push(complaint);
    }
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return queue.length - remaining.length;
};

export default api;
