import api from './api';

export const branchService = {
  getBranches: async () => {
    try {
      const response = await api.get('/api/v1/branches');
      return response.data?.data || [];
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message || 'Unable to fetch branches');
    }
  },
};
