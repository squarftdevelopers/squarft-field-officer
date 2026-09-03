import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { profileAPI } from '../../services/api';

const getApiErrorMessage = (err) => {
    if (err.response?.status === 401) return 'Your session has expired. Please log in again.';
    if (err.response?.status === 403) return err.response?.data?.message || 'You do not have access to this profile.';
    return err.response?.data?.message || err.message || 'Failed to load profile';
};

export const fetchOfficerProfile = createAsyncThunk(
    'profile/fetchOfficerProfile',
    async (_, { rejectWithValue }) => {
        try {
            return await profileAPI.getProfile();
        } catch (err) {
            return rejectWithValue(getApiErrorMessage(err));
        }
    }
);

const profileSlice = createSlice({
    name: 'profile',
    initialState: {
        profile: null,
        performanceThisMonth: null,
        reportingManager: null,
        loading: false,
        error: null,
    },
    reducers: {
        clearProfileError: (state) => {
            state.error = null;
        },
        clearOfficerProfile: (state) => {
            state.profile = null;
            state.performanceThisMonth = null;
            state.reportingManager = null;
            state.loading = false;
            state.error = null;
        },
        updateOfficerAvatar: (state, action) => {
            if (state.profile) state.profile.avatar_url = action.payload || null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchOfficerProfile.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchOfficerProfile.fulfilled, (state, action) => {
                const data = action.payload?.data || {};
                state.loading = false;
                state.profile = data.profile || null;
                state.performanceThisMonth = data.performance_this_month || null;
                state.reportingManager = data.reporting_manager || null;
            })
            .addCase(fetchOfficerProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to load profile';
            });
    },
});

export const { clearOfficerProfile, clearProfileError, updateOfficerAvatar } = profileSlice.actions;
export default profileSlice.reducer;
