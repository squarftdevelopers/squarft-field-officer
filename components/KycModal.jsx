import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { router, usePathname } from 'expo-router';
import { useSelector } from 'react-redux';

const { width } = Dimensions.get('window');

export default function KycModal() {
  const pathname = usePathname();
  const ref = useRef(null);
  const snapPoints = useMemo(() => ['65%'], []);
  const { isLoggedIn, isKycCompleted, kycStatus } = useSelector((state) => state.auth);
  const visible = isLoggedIn && !isKycCompleted && !pathname.includes('kyc');
  const rejected = String(kycStatus || '').toLowerCase() === 'rejected';

  useEffect(() => {
    if (visible) ref.current?.present();
    else ref.current?.dismiss();
  }, [visible]);

  const backdrop = useCallback((props) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="none" />
  ), []);

  return (
    <BottomSheetModal ref={ref} index={0} snapPoints={snapPoints} backdropComponent={backdrop}
      enablePanDownToClose={false} enableDismissOnClose={false} handleComponent={null}
      backgroundStyle={styles.background}>
      <BottomSheetView style={styles.container}>
        <View style={[styles.hero, rejected && { backgroundColor: '#DC2626' }]}>
          <Image source={require('../assets/images/pana.png')} style={styles.illustration} resizeMode="contain" />
        </View>
        <Text style={styles.title}>{rejected ? 'KYC Rejected' : 'Please Complete Your KYC'}</Text>
        <Text style={styles.description}>{rejected ? 'Your KYC documents were rejected.\nPlease re-upload valid documents to continue.' : 'Complete your KYC to continue using the field officer dashboard.'}</Text>
        <Pressable style={[styles.button, rejected && { backgroundColor: '#DC2626' }]} onPress={() => router.push('/(auth)/kyc')}>
          <Text style={styles.buttonText}>{rejected ? 'Re-upload Documents' : 'Complete KYC'}</Text>
        </Pressable>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: { backgroundColor: '#fff', borderTopLeftRadius: 44, borderTopRightRadius: 44 },
  container: { flex: 1, alignItems: 'center', paddingBottom: 32 },
  hero: { width: '100%', height: 250, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'flex-end', borderTopLeftRadius: 44, borderTopRightRadius: 44, overflow: 'hidden' },
  illustration: { width: width * 0.90, height: 280, marginBottom: -75 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 100, marginBottom: 10, textAlign: 'center' },
  description: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 28, paddingHorizontal: 24 },
  button: { backgroundColor: '#4338CA', paddingVertical: 14, borderRadius: 10, width: width * 0.85, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
