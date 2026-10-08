import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authAPI, kycAPI } from '../services/api';
import { logout, setKycState } from '../store/slices/authSlice';
import { clearOfficerProfile } from '../store/slices/profileSlice';

export default function KycModal() {
    const insets = useSafeAreaInsets();
    const dispatch = useDispatch();
    const pathname = usePathname();
    const { authChecked, isLoggedIn, mobile, kycStatus } = useSelector((state) => state.auth);
    const [kyc, setKyc] = useState(null);
    const [checked, setChecked] = useState(false);
    const [loading, setLoading] = useState(false);
    // Prefer the freshly fetched record once available. Redux starts as
    // "missing", so reading it first can flash the completion sheet for one
    // render before the server result is dispatched.
    const status = String(kyc?.verification_status || kycStatus || 'missing').toLowerCase();
    const submitted = ['pending', 'submitted', 'under_review', 'in_review'].includes(status);
    const rejected = status === 'rejected';
    const approved = checked && ['approved', 'verified'].includes(status);
    const authRoute = pathname === '/' || pathname.includes('(auth)') || pathname.includes('onboarding')
        || pathname.includes('login') || pathname.includes('register') || pathname.includes('otp-verification')
        || pathname.includes('location-permission');
    const isKycRoute = pathname.includes('kyc');
    const visible = authChecked && isLoggedIn && checked && !approved && !authRoute && !isKycRoute;

    const fetchKyc = useCallback(async () => {
        if (loading) return;
        setLoading(true);
        try {
            const response = await kycAPI.getMyKyc();
            const data = response?.data || { verification_status: 'missing' };
            setKyc(data);
            dispatch(setKycState(data.verification_status || 'missing'));
        } catch (error) {
            // Fail closed: an unavailable KYC service must never unlock the app.
            setKyc({ verification_status: 'missing' });
            dispatch(setKycState('missing'));
            if (error?.response?.status !== 404) {
                console.log('[KycModal] getMyKyc error:', error?.response?.data || error.message);
            }
        } finally {
            setChecked(true);
            setLoading(false);
        }
    }, [dispatch, loading]);

    useEffect(() => {
        setKyc(null);
        setChecked(false);
    }, [mobile]);

    useEffect(() => {
        // The tabs can remain mounted behind the KYC screen. Invalidate the
        // cached result there so returning home always performs a fresh check
        // before the sheet is allowed to appear.
        if (authRoute || isKycRoute) {
            setKyc(null);
            setChecked(false);
        }
    }, [authRoute, isKycRoute]);

    useEffect(() => {
        if (authChecked && isLoggedIn && !authRoute && !isKycRoute && !checked && !loading) fetchKyc();
    }, [authChecked, authRoute, checked, fetchKyc, isKycRoute, isLoggedIn, loading]);

    const handleAction = async () => {
        if (submitted) return fetchKyc();
        router.push('/(auth)/kyc');
    };

    const handleLogout = async () => {
        await authAPI.logout();
        dispatch(clearOfficerProfile());
        dispatch(logout());
        router.replace('/(auth)/login');
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            hardwareAccelerated
            onRequestClose={() => {}}
        >
            <View
                style={{
                    flex: 1,
                    justifyContent: 'flex-end',
                    backgroundColor: 'rgba(15,23,42,0.58)',
                }}
            >
            <View
                style={[
                    styles.container,
                    {
                        flex: 0,
                        width: '100%',
                        height: '74%',
                        maxHeight: '74%',
                        borderTopLeftRadius: 28,
                        borderTopRightRadius: 28,
                        overflow: 'hidden',
                    },
                ]}
            >
                <View style={styles.visual}>
                    <View style={[styles.headerBackground, rejected && styles.rejectedBackground]} />
                    <View style={styles.handle} />
                    <Image source={require('../assets/images/pana.png')} style={styles.illustration} resizeMode="contain" />
                </View>
                <View style={styles.copy}>
                    <Text style={[styles.title, rejected && styles.rejectedTitle]}>
                        {rejected ? 'KYC Rejected' : submitted ? 'KYC Submitted' : 'Please Complete Your KYC'}
                    </Text>
                    <Text style={styles.description}>
                        {rejected
                            ? (kyc?.rejection_reason ? `Reason: ${kyc.rejection_reason}` : 'Your documents did not meet the requirements. Please re-upload valid documents.')
                            : submitted
                                ? 'Your KYC is submitted for admin review. Access will unlock after approval.'
                                : 'Complete your KYC to continue using the field officer dashboard.'}
                    </Text>
                </View>
                <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 4) }]}>
                    <Pressable style={[styles.button, rejected && styles.rejectedButton, loading && styles.disabled]}
                        onPress={handleAction} disabled={loading} android_ripple={{ color: 'rgba(255,255,255,0.3)' }}>
                        {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                            <Text style={styles.buttonText}>{submitted ? 'Refresh Status' : rejected ? 'Re-upload Documents' : 'Complete KYC'}</Text>
                        )}
                    </Pressable>
                    <Pressable style={styles.logoutButton} onPress={handleLogout} hitSlop={8}>
                        <Text style={styles.logoutText}>Log out</Text>
                    </Pressable>
                </View>
            </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    background: { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FFFFFF', overflow: 'hidden' },
    container: { flex: 1, backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
    visual: { width: '100%', height: 322, position: 'relative', alignItems: 'center', justifyContent: 'flex-start' },
    headerBackground: { position: 'absolute', inset: 0, bottom: 72, backgroundColor: '#4A43EC', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
    rejectedBackground: { backgroundColor: '#DC2626' },
    handle: { width: 48, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.75)', position: 'absolute', top: 14, zIndex: 10 },
    illustration: { width: '76%', height: 246, marginTop: 48, alignSelf: 'center' },
    copy: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 16, paddingBottom: 18, justifyContent: 'center' },
    title: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center', fontFamily: 'Lato-Bold', letterSpacing: -0.3 },
    rejectedTitle: { color: '#DC2626' },
    description: { fontSize: 14.5, color: '#9CA3AF', textAlign: 'center', lineHeight: 22, fontFamily: 'Lato-Regular', paddingHorizontal: 8 },
    bottomBar: { width: '100%', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingHorizontal: 20, paddingTop: 14, backgroundColor: '#FFFFFF' },
    button: { minHeight: 52, backgroundColor: '#4A43EC', paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: '#4A43EC', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
    rejectedButton: { backgroundColor: '#DC2626', shadowColor: '#DC2626' },
    disabled: { opacity: 0.85 },
    buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', fontFamily: 'Lato-Bold' },
    logoutButton: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 3 },
    logoutText: { color: '#DC2626', fontSize: 12, fontWeight: '600', fontFamily: 'Lato-Bold' },
});
