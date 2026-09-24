import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { kycAPI } from '../../services/api';

const statusMeta = {
    verified: { icon: 'check-decagram-outline', color: '#16A34A', bg: '#DCFCE7', title: 'KYC Approved' },
    approved: { icon: 'check-decagram-outline', color: '#16A34A', bg: '#DCFCE7', title: 'KYC Approved' },
    under_review: { icon: 'clock-outline', color: '#CA8A04', bg: '#FEF9C3', title: 'KYC Under Review' },
    pending: { icon: 'clock-outline', color: '#CA8A04', bg: '#FEF9C3', title: 'KYC Pending' },
    rejected: { icon: 'alert-circle-outline', color: '#DC2626', bg: '#FEE2E2', title: 'KYC Rejected' },
};

const DocumentCard = ({ label, uri }) => (
    <View style={styles.docCard}>
        <Text style={styles.docLabel}>{label}</Text>
        {uri ? (
            <Image source={{ uri }} style={styles.docImage} resizeMode="cover" />
        ) : (
            <View style={[styles.docImage, styles.docImagePlaceholder]}>
                <MaterialCommunityIcons name="image-off-outline" size={22} color="#9CA3AF" />
                <Text style={styles.docPlaceholderText}>Not uploaded</Text>
            </View>
        )}
    </View>
);

const InfoRow = ({ label, value }) => (
    <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '-'}</Text>
    </View>
);

export default function KycDetailsScreen() {
    const [kyc, setKyc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadKyc = useCallback(async (showLoader = true) => {
        if (showLoader) setLoading(true);
        try {
            const response = await kycAPI.getMyKyc();
            setKyc(response?.data || null);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadKyc();
    }, [loadKyc]);

    const onRefresh = () => {
        setRefreshing(true);
        loadKyc(false);
    };

    const status = String(kyc?.verification_status || 'pending').toLowerCase();
    const meta = statusMeta[status] || statusMeta.pending;
    const isRejected = status === 'rejected';

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.headerButton}>
                    <Ionicons name="arrow-back" size={22} color="#111827" />
                </Pressable>
                <Text style={styles.headerTitle}>My KYC Details</Text>
                <View style={styles.headerButton} />
            </View>

            {loading && !kyc ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4A43EC" />
                </View>
            ) : !kyc ? (
                <ScrollView contentContainerStyle={styles.emptyContainer} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                    <MaterialCommunityIcons name="file-document-outline" size={40} color="#9CA3AF" />
                    <Text style={styles.emptyText}>No KYC submission found yet.</Text>
                    <Pressable style={styles.primaryButton} onPress={() => router.push('/(auth)/kyc')}>
                        <Text style={styles.primaryButtonText}>Complete KYC</Text>
                    </Pressable>
                </ScrollView>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4A43EC']} tintColor="#4A43EC" />}
                >
                    <View style={[styles.statusBanner, { backgroundColor: meta.bg }]}>
                        <MaterialCommunityIcons name={meta.icon} size={22} color={meta.color} />
                        <Text style={[styles.statusTitle, { color: meta.color }]}>{meta.title}</Text>
                    </View>

                    {isRejected && kyc.rejection_reason ? (
                        <View style={styles.rejectedBanner}>
                            <Text style={styles.rejectedLabel}>Rejection Reason</Text>
                            <Text style={styles.rejectedText}>{kyc.rejection_reason}</Text>
                        </View>
                    ) : null}

                    <Text style={styles.sectionTitle}>Uploaded Documents</Text>
                    <View style={styles.docGrid}>
                        <DocumentCard label="Profile Photo / Selfie" uri={kyc.profile_photo_url} />
                        <DocumentCard label="Aadhaar Front" uri={kyc.aadhar_front_url} />
                        <DocumentCard label="Aadhaar Back" uri={kyc.aadhar_back_url} />
                        <DocumentCard label="PAN Card" uri={kyc.pan_card_url} />
                    </View>

                    <Text style={styles.sectionTitle}>Identity Details</Text>
                    <View style={styles.infoCard}>
                        <InfoRow label="Aadhaar Number" value={kyc.aadhar_number} />
                        <InfoRow label="PAN Number" value={kyc.pan_number} />
                    </View>

                    {isRejected ? (
                        <Pressable style={styles.primaryButton} onPress={() => router.push('/(auth)/kyc')}>
                            <Text style={styles.primaryButtonText}>Update and Re-submit KYC</Text>
                        </Pressable>
                    ) : null}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#FFFFFF' },
    header: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    headerButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: '#111827', fontSize: 17, fontWeight: '700' },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyContainer: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
    emptyText: { color: '#6B7280', fontSize: 14, marginTop: 10, marginBottom: 20, textAlign: 'center' },
    content: { padding: 20, paddingBottom: 40 },
    statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 18 },
    statusTitle: { fontSize: 15, fontWeight: '700' },
    rejectedBanner: { backgroundColor: '#FEE2E2', borderRadius: 14, padding: 14, marginBottom: 18 },
    rejectedLabel: { color: '#B91C1C', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
    rejectedText: { color: '#B91C1C', fontSize: 13, lineHeight: 19 },
    sectionTitle: { color: '#374151', fontSize: 14, fontWeight: '700', marginBottom: 12, marginTop: 4 },
    docGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 8 },
    docCard: { width: '48%', marginBottom: 16 },
    docLabel: { color: '#6B7280', fontSize: 11, fontWeight: '700', marginBottom: 6 },
    docImage: { width: '100%', height: 110, borderRadius: 12, backgroundColor: '#F3F4F6' },
    docImagePlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed' },
    docPlaceholderText: { color: '#9CA3AF', fontSize: 10, marginTop: 4 },
    infoCard: { backgroundColor: '#F9FAFB', borderRadius: 14, borderWidth: 1, borderColor: '#F1F5F9', padding: 14, marginBottom: 24 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    infoLabel: { color: '#6B7280', fontSize: 13, fontWeight: '600' },
    infoValue: { color: '#111827', fontSize: 13, fontWeight: '700' },
    primaryButton: { backgroundColor: '#4A43EC', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
    primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
