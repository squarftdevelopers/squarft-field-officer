import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
    name: 'auth',
    initialState: {
        firstName: '',
        lastName: '',
        branchId: '',
        branchName: '',
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
    },
    reducers: {
        setFirstName: (state, action) => { state.firstName = action.payload; },
        setLastName: (state, action) => { state.lastName = action.payload; },
        setBranch: (state, action) => {
            state.branchId = action.payload.id;
            state.branchName = action.payload.name;
        },
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
        setLoggedIn: (state, action) => { state.isLoggedIn = action.payload; },
        logout: (state) => {
            state.mobile = '';
            state.branchId = '';
            state.branchName = '';
            state.password = '';
            state.isLoggedIn = false;
        },
    },
});

export const { setFirstName, setLastName, setBranch, setMobile, setPassword, setNewPassword, setConfirmPassword, setOtpDigit, clearOtp, setOtpFlow, setOtpToken, setVerifiedToken, toggleRememberMe, setLoggedIn, logout } = authSlice.actions;
export default authSlice.reducer;
