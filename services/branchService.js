import api from './api';

export const branchService = {
  // Public, unauthenticated list of active branches
  getBranches: async () => {
    try {
      const response = await api.get('/api/v1/branches');
      return response.data?.data || [];
    } catch (error) {
      throw {
        message: error.response?.data?.message || error.message || 'Unable to fetch branches',
        status: error.response?.status,
      };
    }
  },

  // Detect nearest branch using coordinates and assign it to the user profile
  detectAndAssignBranch: async ({ latitude, longitude, clientCity, clientState }) => {
    try {
      const response = await api.post('/api/v1/branches/detect-and-assign', {
        latitude,
        longitude,
        clientCity,
        clientState,
      });
      return response.data;
    } catch (error) {
      throw {
        message: error.response?.data?.message || error.message || 'Unable to detect nearest branch',
        status: error.response?.status,
      };
    }
  },

  // Explicitly assign a user-selected branch
  assignBranch: async ({ branchId, location }) => {
    try {
      const response = await api.post('/api/v1/branches/assign', {
        branchId,
        location,
      });
      return response.data;
    } catch (error) {
      throw {
        message: error.response?.data?.message || error.message || 'Unable to assign branch',
        status: error.response?.status,
      };
    }
  },
};
