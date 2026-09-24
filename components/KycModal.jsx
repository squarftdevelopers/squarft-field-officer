import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { router, usePathname } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { kycAPI } from '../services/api';
import { setKycState } from '../store/slices/authSlice';

export default function KycModal() {
    const insets = useSafeAreaInsets();
    const dispatch = useDispatch();
    const pathname = usePathname();
    const sheetRef = useRef(null);
    const { isLoggedIn, isKycCompleted, kycStatus, branchId } = useSelector((state) => state.auth);
    const [kyc, setKyc] = useState(null);
    const [checked, setChecked] = useState(false);
    const [loading, setLoading] = useState(false);
    const status = String(kyc?.verification_status || kycStatus || 'missing').toLowerCase();
    const submitted = ['pending', 'submitted', 'under_review', 'in_review'].includes(status);
    const rejected = status === 'rejected';
    const approved = ['approved', 'verified'].includes(status) || isKycCompleted;
    const snapPoints = useMemo(() => ['92%'], []);
    const authRoute = pathname === '/' || pathname.includes('(auth)') || pathname.includes('onboarding')
        || pathname.includes('login') || pathname.includes('register') || pathname.includes('otp-verification')
        || pathname.includes('location-permission');
    const visible = isLoggedIn && Boolean(branchId) && checked && !approved && !authRoute && !pathname.includes('kyc');

    const fetchKyc = useCallback(async () => {
        if (loading) return;
        setLoading(true);
        try {
            const response = await kycAPI.getMyKyc();
            const data = response?.data || { verification_status: 'missing' };
            setKyc(data);
            dispatch(setKycState(data.verification_status || 'missing'));
        } catch (error) {
            if (error?.response?.status === 404) {
                setKyc({ verification_status: 'missing' });
                dispatch(setKycState('missing'));
            } else console.log('[KycModal] getMyKyc error:', error?.response?.data || error.message);
        } finally {
            setChecked(true);
            setLoading(false);
        }
    }, [dispatch, loading]);

    useEffect(() => {
        if (isLoggedIn && branchId && !checked && !loading) fetchKyc();
    }, [branchId, checked, fetchKyc, isLoggedIn, loading]);

    useEffect(() => {
        if (visible) {
            const timer = setTimeout(() => sheetRef.current?.present(), 250);
            return () => clearTimeout(timer);
        }
        sheetRef.current?.dismiss();
    }, [status, visible]);

    const backdrop = useCallback((props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} pressBehavior="none" />
    ), []);

    const handleAction = async () => {
        if (submitted) return fetchKyc();
        sheetRef.current?.dismiss();
        router.push('/(auth)/kyc');
    };

    return (
        <BottomSheetModal ref={sheetRef} index={0} snapPoints={snapPoints} backdropComponent={backdrop}
            enablePanDownToClose={false} enableDismissOnClose={false} handleComponent={null}
            backgroundStyle={styles.background} bottomInset={insets.bottom}>
            <BottomSheetView style={styles.container}>
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
                <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 38 : 28) }]}>
                    <Pressable style={[styles.button, rejected && styles.rejectedButton, loading && styles.disabled]}
                        onPress={handleAction} disabled={loading} android_ripple={{ color: 'rgba(255,255,255,0.3)' }}>
                        {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                            <Text style={styles.buttonText}>{submitted ? 'Refresh Status' : rejected ? 'Re-upload Documents' : 'Complete KYC'}</Text>
                        )}
                    </Pressable>
                </View>
            </BottomSheetView>
        </BottomSheetModal>
    );
}

const styles = StyleSheet.create({
    background: { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FFFFFF', overflow: 'hidden' },
    container: { flex: 1, backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
    visual: { width: '100%', height: 370, position: 'relative', alignItems: 'center', justifyContent: 'flex-start' },
    headerBackground: { position: 'absolute', inset: 0, bottom: 100, backgroundColor: '#4A43EC', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
    rejectedBackground: { backgroundColor: '#DC2626' },
    handle: { width: 48, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.75)', position: 'absolute', top: 14, zIndex: 10 },
    illustration: { width: '80%', height: 275, marginTop: 65, alignSelf: 'center' },
    copy: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 16, paddingBottom: 20, flex: 1, justifyContent: 'center' },
    title: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 12, textAlign: 'center', fontFamily: 'Lato-Bold', letterSpacing: -0.3 },
    rejectedTitle: { color: '#DC2626' },
    description: { fontSize: 14.5, color: '#9CA3AF', textAlign: 'center', lineHeight: 22, fontFamily: 'Lato-Regular', paddingHorizontal: 8 },
    bottomBar: { width: '100%', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingHorizontal: 20, paddingTop: 20, backgroundColor: '#FFFFFF' },
    button: { minHeight: 52, backgroundColor: '#4A43EC', paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: '#4A43EC', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
    rejectedButton: { backgroundColor: '#DC2626', shadowColor: '#DC2626' },
    disabled: { opacity: 0.85 },
    buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', fontFamily: 'Lato-Bold' },
});
