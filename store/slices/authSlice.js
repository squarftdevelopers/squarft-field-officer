import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { branchService } from '../../services/branchService';

export const detectAndAssignBranchThunk = createAsyncThunk(
    'auth/detectAndAssignBranch',
    async ({ latitude, longitude, clientCity, clientState, locationAddress }, { rejectWithValue }) => {
        try {
            const data = await branchService.detectAndAssignBranch({
                latitude,
                longitude,
                clientCity,
                clientState,
            });
            const effectiveLocation = locationAddress || data?.formattedAddress || data?.detectedCity || data?.branch?.city;
            return { ...data, effectiveLocation };
        } catch (error) {
            return rejectWithValue(error.message || 'Unable to detect nearest branch');
        }
    }
);

export const assignBranchThunk = createAsyncThunk(
    'auth/assignBranch',
    async ({ branchId, branchName, location }, { rejectWithValue }) => {
        try {
            const data = await branchService.assignBranch({ branchId, location });
            return { ...data, branchId, branchName: branchName || data.branch?.name, location };
        } catch (error) {
            return rejectWithValue(error.message || 'Unable to assign branch');
        }
    }
);

const authSlice = createSlice({
    name: 'auth',
    initialState: {
        firstName: '',
        lastName: '',
        branchId: '',
        branchName: '',
        location: null,
        mobile: '',
        password: '',
        newPassword: '',
        confirmPassword: '',
        otp: ['', '', '', '', '', ''],
        otpFlow: 'register', 
        otpToken: '',
        verifiedToken: '',
        rememberMe: false,
        isLoggedIn: false,
        authChecked: false,
        isKycCompleted: false,
        kycStatus: 'missing',
    },
    reducers: {
        setFirstName: (state, action) => { state.firstName = action.payload; },
        setLastName: (state, action) => { state.lastName = action.payload; },
        setBranch: (state, action) => {
            state.branchId = action.payload.id;
            state.branchName = action.payload.name;
        },
        setLocation: (state, action) => { state.location = action.payload; },
        setBranchId: (state, action) => { state.branchId = action.payload; },
        setMobile: (state, action) => { state.mobile = action.payload; },
        setPassword: (state, action) => { state.password = action.payload; },
        setNewPassword: (state, action) => { state.newPassword = action.payload; },
        setConfirmPassword: (state, action) => { state.confirmPassword = action.payload; },
        setOtpDigit: (state, action) => {
            const { index, value } = action.payload;
            state.otp[index] = value;
        },
        clearOtp: (state) => { state.otp = ['', '', '', '', '', '']; },
        setOtpFlow: (state, action) => { state.otpFlow = action.payload; },
        setOtpToken: (state, action) => { state.otpToken = action.payload; },
        setVerifiedToken: (state, action) => { state.verifiedToken = action.payload; },
        toggleRememberMe: (state) => { state.rememberMe = !state.rememberMe; },
        setLoggedIn: (state, action) => {
            state.isLoggedIn = action.payload;
            state.authChecked = true;
        },
        setAuthChecked: (state, action) => {
            state.authChecked = action.payload;
        },
        setKycState: (state, action) => {
            state.kycStatus = action.payload || 'missing';
            state.isKycCompleted = ['verified', 'approved'].includes(String(action.payload || '').toLowerCase());
        },
        logout: (state) => {
            state.mobile = '';
            state.branchId = '';
            state.branchName = '';
            state.location = null;
            state.password = '';
            state.isLoggedIn = false;
            state.authChecked = true;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(assignBranchThunk.fulfilled, (state, action) => {
                state.branchId = action.payload.branchId;
                if (action.payload.branchName) {
                    state.branchName = action.payload.branchName;
                }
                if (action.payload.location) {
                    state.location = action.payload.location;
                }
            })
            .addCase(detectAndAssignBranchThunk.fulfilled, (state, action) => {
                if (action.payload?.effectiveLocation) {
                    state.location = action.payload.effectiveLocation;
                }
            });
    },
});

export const { setFirstName, setLastName, setBranch, setLocation, setBranchId, setMobile, setPassword, setNewPassword, setConfirmPassword, setOtpDigit, clearOtp, setOtpFlow, setOtpToken, setVerifiedToken, toggleRememberMe, setLoggedIn, setAuthChecked, setKycState, logout } = authSlice.actions;
export default authSlice.reducer;
