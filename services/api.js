import axios from 'axios';

let authToken = null;
export const setAuthToken = (token) => { authToken = token; };
export const getAuthToken = () => authToken;

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.0.107:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = authToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log("API request", { method: config.method, url: config.url, baseURL: config.baseURL || API_BASE_URL });
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log("API response error", {
      url: error?.config?.url,
      status: error?.response?.status,
      data: error?.response?.data,
      message: error?.message,
    });
    return Promise.reject(error);
  }
);

const normalizePhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return phone;
};

export const authAPI = {
  login: async (phone, password) => {
    const { data } = await api.post('/api/v1/field-officer/auth/login', { phone: normalizePhone(phone), password });
    if (data.token) {
      authToken = data.token;
    }
    return data;
  },

  register: async (phone, password, full_name, location) => {
    const { data } = await api.post('/api/v1/field-officer/auth/register', {
      phone: normalizePhone(phone),
      password,
      full_name,
      location: location || null,
    });
    return data;
  },

  sendOtp: async (phone, purpose) => {
    const { data } = await api.post('/auth/send-otp', { phone: normalizePhone(phone), purpose });
    return data;
  },

  verifyOtp: async (otp_token, otp) => {
    const { data } = await api.post('/auth/verify-otp', { otp_token, otp });
    return data;
  },

  resetPassword: async (verified_token, new_password) => {
    const { data } = await api.post('/auth/reset-password', { verified_token, new_password });
    return data;
  },

  logout: async () => {
    authToken = null;
  },
};

export const dashboardAPI = {
  getDashboard: async () => {
    const { data } = await api.get('/api/v1/field-officer/dashboard');
    return data;
  },
};

export const profileAPI = {
  getProfile: async () => {
    const { data } = await api.get('/api/v1/field-officer/profile');
    return data;
  },
  changePassword: async (currentPassword, newPassword) => {
    const { data } = await api.put('/api/v1/profile/change-password', {
      currentPassword,
      newPassword,
    });
    return data;
  },
};

export const projectsAPI = {
  getNearbyProjects: async ({ latitude, longitude } = {}) => {
    const { data } = await api.get('/api/v1/projects/nearby', {
      params: { latitude, longitude },
    });
    return data;
  },
};

export const leadsAPI = {
  createLead: async (payload) => {
    const { data } = await api.post('/api/v1/field-officer/leads', payload);
    return data;
  },
  getLeads: async ({ search, stage } = {}) => {
    const params = {};
    if (search) params.search = search;
    if (stage && stage !== 'all') params.stage = stage;
    const { data } = await api.get('/api/v1/field-officer/leads', { params });
    return data;
  },
  getLeadDetails: async (id) => {
    const { data } = await api.get(`/api/v1/field-officer/leads/${id}`);
    return data;
  },
  getLeadById: async (id) => {
    const { data } = await api.get(`/api/v1/field-officer/leads/${id}`);
    return data;
  },
  createFollowUp: async (leadId, payload) => {
    if (payload instanceof FormData) {
      const { data } = await api.post(
        `/api/v1/field-officer/leads/${leadId}/follow-ups`,
        payload,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return data;
    }
    const { data } = await api.post(`/api/v1/field-officer/leads/${leadId}/follow-ups`, payload);
    return data;
  },
  scheduleMeeting: async (leadId, payload) => {
    const { data } = await api.post(`/api/v1/field-officer/leads/${leadId}/meetings`, payload);
    return data;
  },
  recordCall: async (leadId) => {
    const { data } = await api.post(`/api/v1/field-officer/leads/${leadId}/call`);
    return data;
  },
  updateFollowUpCompletion: async (leadId, followUpId, is_completed) => {
    const { data } = await api.patch(
      `/api/v1/field-officer/leads/${leadId}/follow-ups/${followUpId}/completion`,
      { is_completed }
    );
    return data;
  },
  updateMeetingCompletion: async (leadId, meetingId, is_completed) => {
    const { data } = await api.patch(
      `/api/v1/field-officer/leads/${leadId}/meetings/${meetingId}/completion`,
      { is_completed }
    );
    return data;
  },
  updateLeadJourney: async (leadId, payload) => {
    const { data } = await api.patch(`/api/v1/field-officer/leads/${leadId}/journey`, payload);
    return data;
  },
  rejectLead: async (leadId) => {
    const { data } = await api.patch(`/api/v1/field-officer/leads/${leadId}/reject`);
    return data;
  },
  getFollowUpOptions: async () => {
    const { data } = await api.get('/api/v1/field-officer/leads/follow-up/options');
    return data;
  },
  getMeetingOptions: async () => {
    const { data } = await api.get('/api/v1/field-officer/leads/meeting/options');
    return data;
  },
};

export const projectFormApi = {
  // Step 1 — create draft project
  createDraft: (payload) => api.post('/api/v1/project-panel/form/draft', payload),

  // Step 2 — configure property types
  configurePropertyTypes: (projectId, payload) =>
    api.put(`/api/v1/project-panel/form/${projectId}/property-types`, payload),

  // Step 3 — create variant blueprint
  createVariant: (projectId, payload) =>
    api.post(`/api/v1/project-panel/form/${projectId}/variants`, payload),

  // Step 3 — sync grid units
  syncGridUnits: (projectId, payload) =>
    api.post(`/api/v1/project-panel/form/${projectId}/units/sync`, payload),

  // Step 3 — bulk CSV upload
  uploadCsvUnits: (projectId, formData) =>
    api.post(`/api/v1/project-panel/form/${projectId}/units/upload-csv`, formData, {
      timeout: 30000,
      transformRequest: (data) => data,
    }),

  // Step 4 — approvals & possession
  finalizeStep4: (projectId, payload) =>
    api.put(`/api/v1/project-panel/form/${projectId}/step4-finalize`, payload),

  // Step 5 — commercial & legal
  finalizeStep5: (projectId, payload) =>
    api.put(`/api/v1/project-panel/form/${projectId}/step5-finalize`, payload),

  // Step 6 — media upload (single file multipart)
  // Using XMLHttpRequest directly — axios has known issues with binary FormData in React Native
  uploadMedia: async (projectId, formData) => {
    const token = authToken;
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/api/v1/project-panel/form/${projectId}/media`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.timeout = 60000;
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({ data });
        } catch {
          resolve({ data: xhr.responseText });
        }
      };
      xhr.onerror = () => reject(new Error('Network Error'));
      xhr.ontimeout = () => reject(new Error('Upload timed out'));
      xhr.send(formData);
    });
  },

  // Step 6 — finalize & publish
  finalizeStep6: (projectId, payload) =>
    api.put(`/api/v1/project-panel/form/${projectId}/step6-finalize`, payload),

  // Restore draft step data (variants + units)
  getStepData: (projectId) =>
    api.get(`/api/v1/project-panel/form/${projectId}/step-data`),

  // Full resume — restores all steps for a draft
  getProjectFormResume: (projectId) =>
    api.get(`/api/v1/project-panel/form/${projectId}/resume`),

  // List all draft projects for current user
  getDraftProjects: () =>
    api.get('/api/v1/project-panel/form/drafts'),
};

export const projectMembersAPI = {
  getAssignableUsers: (role, q) =>
    api.get('/api/v1/project-panel/projects/assignable-users', { params: { role, q } }),
  getMembers: (projectId) =>
    api.get(`/api/v1/project-panel/projects/${projectId}/members`),
  addMember: (projectId, userId) =>
    api.post(`/api/v1/project-panel/projects/${projectId}/members`, { user_id: userId }),
  removeMember: (projectId, userId) =>
    api.delete(`/api/v1/project-panel/projects/${projectId}/members/${userId}`),
};

export const kycAPI = {
  uploadKyc: async (formData) => {
    const { data } = await api.post('/api/v1/field-officer/kyc', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  getMyKyc: async () => {
    const { data } = await api.get('/api/v1/field-officer/kyc');
    return data;
  },
  updateKyc: async (formData) => {
    const { data } = await api.put('/api/v1/field-officer/kyc', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};

export const tasksAPI = {
  getMyTasks: async (filters = {}) => {
    const params = {};
    if (filters.status && filters.status !== 'all') {
      params.status = filters.status.toUpperCase();
    }
    if (filters.priority) {
      params.priority = filters.priority.toUpperCase();
    }
    const { data } = await api.get('/api/v1/field-officer/tasks', { params });
    return data;
  },
  getTaskById: async (taskId) => {
    const { data } = await api.get(`/api/v1/field-officer/tasks/${taskId}`);
    return data;
  },
  updateTaskStatus: async (taskId, status, remarks) => {
    const { data } = await api.patch(`/api/v1/field-officer/tasks/${taskId}/status`, { status, remarks });
    return data;
  },
  markTaskComplete: async (taskId) => {
    const { data } = await api.patch(`/api/v1/field-officer/tasks/${taskId}/complete`);
    return data;
  },
  addTaskRemark: async (taskId, remark) => {
    const { data } = await api.post(`/api/v1/field-officer/tasks/${taskId}/remarks`, { remark });
    return data;
  },
  getTaskSummary: async () => {
    const { data } = await api.get('/api/v1/field-officer/tasks/summary');
    return data;
  },
};

export default api;
