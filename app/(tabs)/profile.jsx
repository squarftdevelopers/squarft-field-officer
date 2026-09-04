import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { profileLinks } from "../../data/profileData";
import { authAPI, profileAPI } from "../../services/api";
import { logout } from "../../store/slices/authSlice";
import { fetchDashboard } from "../../store/slices/dashboardSlice";
import {
    clearOfficerProfile,
    fetchOfficerProfile,
    updateOfficerAvatar,
} from "../../store/slices/profileSlice";

const KYC_BADGES = {
    verified: { label: "KYC Approved", color: "#10B981", background: "#D1FAE5", icon: "shield-checkmark" },
    under_review: { label: "KYC Under Review", color: "#D97706", background: "#FEF3C7", icon: "time" },
    pending: { label: "KYC Incomplete", color: "#D97706", background: "#FEF3C7", icon: "document-text" },
    rejected: { label: "KYC Rejected", color: "#DC2626", background: "#FEE2E2", icon: "alert-circle" },
    missing: { label: "Complete KYC", color: "#4A43EC", background: "#EDE9FE", icon: "document-text" },
};

const PERFORMANCE_ITEMS = [
    { key: "total_leads", label: "New Leads", icon: "people-outline", color: "#4A43EC", background: "#EEECFF" },
    { key: "meetings_done", label: "Meetings Done", icon: "checkmark-done-outline", color: "#059669", background: "#D1FAE5" },
    { key: "onboarded", label: "Onboarded", icon: "person-add-outline", color: "#7C3AED", background: "#EDE9FE" },
    { key: "projects_live", label: "Projects Live", icon: "business-outline", color: "#0284C7", background: "#E0F2FE" },
];

const formatDate = (value) => {
    if (!value) return "Unavailable";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unavailable";
    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

const getInitials = (name) => (name || "Field Officer")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "FO";

function ProfileAvatar({ uri, name, size = 76 }) {
    const [failedUri, setFailedUri] = useState(null);
    const canShowImage = Boolean(uri) && failedUri !== uri;

    if (canShowImage) {
        return (
            <Image
                source={{ uri }}
                onError={() => setFailedUri(uri)}
                style={{ width: size, height: size, borderRadius: 22 }}
                resizeMode="cover"
            />
        );
    }

    return (
        <View
            className="items-center justify-center bg-white/20"
            style={{ width: size, height: size, borderRadius: 22 }}
        >
            <Text className="text-[24px] font-lato-bold text-white">{getInitials(name)}</Text>
        </View>
    );
}

function AccountRow({ icon, label, value, last = false }) {
    return (
        <View className={`flex-row items-center py-3.5 ${last ? "" : "border-b border-[#F1F5F9]"}`}>
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#F3F1FF]">
                <Ionicons name={icon} size={17} color="#4A43EC" />
            </View>
            <View className="ml-3 flex-1">
                <Text className="text-[10px] font-lato-bold uppercase tracking-[1px] text-[#94A3B8]">{label}</Text>
                <Text className="mt-1 text-[14px] font-lato-bold text-[#1E293B]">{value}</Text>
            </View>
        </View>
    );
}

function SectionCard({ title, children }) {
    return (
        <View className="mb-4 rounded-[22px] border border-[#E8EAF1] bg-white p-4">
            <Text className="mb-2 text-[15px] font-lato-bold text-[#111827]">{title}</Text>
            {children}
        </View>
    );
}

async function callPhone(phone) {
    if (!phone) {
        Alert.alert("Phone unavailable", "No reporting manager phone number is available.");
        return;
    }

    try {
        const url = `tel:${phone}`;
        const supported = await Linking.canOpenURL(url);
        if (!supported) throw new Error("Phone calls are unavailable");
        await Linking.openURL(url);
    } catch {
        Alert.alert("Unable to call", "Calling is not available on this device.");
    }
}

export default function Profile() {
    const dispatch = useDispatch();
    const { profile, performanceThisMonth, reportingManager, loading, error } = useSelector((state) => state.profile);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    useFocusEffect(
        useCallback(() => {
            dispatch(fetchOfficerProfile());
        }, [dispatch]),
    );

    const refreshProfile = useCallback(async () => {
        setRefreshing(true);
        try {
            await dispatch(fetchOfficerProfile());
        } finally {
            setRefreshing(false);
        }
    }, [dispatch]);

    const pickAndUploadPhoto = async (useCamera) => {
        try {
            const permission = useCamera
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (permission.status !== "granted") {
                Alert.alert(
                    "Permission Needed",
                    useCamera ? "Camera permission is required." : "Photo library permission is required.",
                );
                return;
            }

            const result = useCamera
                ? await ImagePicker.launchCameraAsync({
                    cameraType: ImagePicker.CameraType.front,
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.8,
                })
                : await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ["images"],
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.8,
                });

            if (result.canceled) return;

            setUploadingPhoto(true);
            const updated = await profileAPI.updateProfilePicture(result.assets[0]);
            const signedAvatarUrl = updated?.profilePictureUrl || null;
            dispatch(updateOfficerAvatar(signedAvatarUrl));
            await Promise.all([
                dispatch(fetchOfficerProfile()),
                dispatch(fetchDashboard()),
            ]);
        } catch (uploadError) {
            Alert.alert(
                "Upload Failed",
                uploadError.response?.data?.message || uploadError.message || "Unable to update your profile photo.",
            );
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleChangePhoto = () => {
        Alert.alert(
            "Profile Photo",
            "Take a new photo or choose one from your gallery.",
            [
                { text: "Take Photo", onPress: () => pickAndUploadPhoto(true) },
                { text: "Choose from Gallery", onPress: () => pickAndUploadPhoto(false) },
                { text: "Cancel", style: "cancel" },
            ],
        );
    };

    const handleKycPress = () => {
        router.push({
            pathname: "/(auth)/kyc",
            params: {
                status: profile?.kyc_status || "missing",
                rejectionReason: profile?.rejection_reason || "",
            },
        });
    };

    const handleQuickLinkPress = (link) => {
        if (link.route) router.push(link.route);
    };

    const handleLogout = () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to log out of the SquarFT Field Officer app?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        await authAPI.logout();
                        dispatch(clearOfficerProfile());
                        dispatch(logout());
                        router.replace("/(auth)/login");
                    },
                },
            ],
        );
    };

    const displayName = profile?.name?.trim() || "Field Officer";
    const kycStatus = String(profile?.kyc_status || "missing").toLowerCase();
    const kycBadge = KYC_BADGES[kycStatus] || KYC_BADGES.missing;

    return (
        <View className="flex-1 bg-[#F7F8FC]">
            <StatusBar style="light" />
            <SafeAreaView className="bg-[#4A43EC]" edges={["top"]}>
                <View className="px-5 pb-7 pt-3">
                    <Text className="mb-5 text-[20px] font-lato-bold text-white">My Profile</Text>

                    <View className="flex-row items-center">
                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={handleChangePhoto}
                            disabled={uploadingPhoto || !profile}
                            className="relative rounded-[22px] border border-white/30"
                        >
                            <ProfileAvatar uri={profile?.avatar_url} name={displayName} />
                            <View className="absolute -bottom-2 -right-2 h-7 w-7 items-center justify-center rounded-full border-2 border-[#4A43EC] bg-white">
                                {uploadingPhoto ? (
                                    <ActivityIndicator size="small" color="#4A43EC" />
                                ) : (
                                    <Ionicons name="camera" size={13} color="#4A43EC" />
                                )}
                            </View>
                        </TouchableOpacity>

                        <View className="ml-4 flex-1">
                            <Text className="text-[20px] font-lato-bold text-white" numberOfLines={1}>
                                {displayName}
                            </Text>
                            <Text className="mt-1 text-[12px] text-white/75">{profile?.role_display || "Field Officer"}</Text>
                            <View
                                className="mt-2 self-start rounded-full px-2.5 py-1"
                                style={{ backgroundColor: kycBadge.background }}
                            >
                                <Text className="text-[10px] font-lato-bold" style={{ color: kycBadge.color }}>
                                    {kycBadge.label}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            </SafeAreaView>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 110 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refreshProfile}
                        tintColor="#4A43EC"
                        colors={["#4A43EC"]}
                    />
                }
            >
                {loading && !profile ? (
                    <View className="mb-4 h-14 flex-row items-center justify-center rounded-2xl bg-white">
                        <ActivityIndicator color="#4A43EC" />
                        <Text className="ml-2 text-[13px] font-lato-bold text-[#4A43EC]">Loading your profile</Text>
                    </View>
                ) : null}

                {error ? (
                    <View className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                        <Text className="text-[13px] font-lato-bold text-red-700">Profile could not be loaded</Text>
                        <Text className="mt-1 text-[12px] leading-5 text-red-600">{error}</Text>
                        <TouchableOpacity
                            onPress={refreshProfile}
                            disabled={loading}
                            className="mt-3 h-9 items-center justify-center rounded-xl bg-red-600"
                        >
                            <Text className="text-[12px] font-lato-bold text-white">Try Again</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                {profile ? (
                    <>
                        <SectionCard title="Account Details">
                            <AccountRow icon="call-outline" label="Phone Number" value={profile.phone || "Unavailable"} />
                            {profile.email ? (
                                <AccountRow icon="mail-outline" label="Email Address" value={profile.email} />
                            ) : null}
                            <AccountRow
                                icon="business-outline"
                                label="Branch"
                                value={profile.branch?.name || "Not assigned"}
                            />
                            <AccountRow icon="location-outline" label="Assigned Location" value={profile.location || "Not assigned"} />
                            <AccountRow
                                icon="shield-checkmark-outline"
                                label="Phone Verification"
                                value={profile.phone_verified ? "OTP verified" : "Not verified"}
                            />
                            <AccountRow icon="calendar-outline" label="Member Since" value={formatDate(profile.created_at)} last />
                        </SectionCard>

                        <SectionCard title="Performance This Month">
                            <View className="flex-row flex-wrap justify-between">
                                {PERFORMANCE_ITEMS.map((item) => (
                                    <View
                                        key={item.key}
                                        className="mb-2 w-[48.5%] rounded-2xl p-3"
                                        style={{ backgroundColor: item.background }}
                                    >
                                        <Ionicons name={item.icon} size={18} color={item.color} />
                                        <Text className="mt-2 text-[22px] font-lato-bold" style={{ color: item.color }}>
                                            {performanceThisMonth?.[item.key] ?? 0}
                                        </Text>
                                        <Text className="mt-0.5 text-[11px] font-lato-bold text-[#475569]">{item.label}</Text>
                                    </View>
                                ))}
                            </View>
                        </SectionCard>

                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={handleKycPress}
                            className="mb-4 flex-row items-center rounded-[22px] border border-[#E8EAF1] bg-white p-4"
                        >
                            <View
                                className="h-11 w-11 items-center justify-center rounded-2xl"
                                style={{ backgroundColor: kycBadge.background }}
                            >
                                <Ionicons name={kycBadge.icon} size={21} color={kycBadge.color} />
                            </View>
                            <View className="ml-3 flex-1">
                                <Text className="text-[14px] font-lato-bold text-[#111827]">{kycBadge.label}</Text>
                                <Text className="mt-1 text-[11px] leading-4 text-[#64748B]" numberOfLines={2}>
                                    {kycStatus === "rejected" && profile.rejection_reason
                                        ? profile.rejection_reason
                                        : kycStatus === "verified"
                                            ? "Your identity documents have been approved."
                                            : "Tap to view or complete your verification."}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                        </TouchableOpacity>

                        <SectionCard title="Reporting Manager">
                            {reportingManager ? (
                                <View className="flex-row items-center py-1">
                                    <View className="h-11 w-11 items-center justify-center rounded-full bg-[#EEECFF]">
                                        <Text className="text-[12px] font-lato-bold text-[#4A43EC]">
                                            {getInitials(reportingManager.name)}
                                        </Text>
                                    </View>
                                    <View className="ml-3 flex-1">
                                        <Text className="text-[14px] font-lato-bold text-[#111827]">{reportingManager.name}</Text>
                                        <Text className="mt-0.5 text-[11px] text-[#64748B]">
                                            {[reportingManager.role_display, reportingManager.location].filter(Boolean).join(" · ")}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => callPhone(reportingManager.phone)}
                                        disabled={!reportingManager.phone}
                                        className="h-10 w-10 items-center justify-center rounded-xl border border-[#DCD8FF]"
                                        style={{ opacity: reportingManager.phone ? 1 : 0.4 }}
                                    >
                                        <Ionicons name="call-outline" size={17} color="#4A43EC" />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View className="flex-row items-center py-2">
                                    <Ionicons name="information-circle-outline" size={19} color="#64748B" />
                                    <Text className="ml-2 text-[12px] text-[#64748B]">No reporting manager is assigned yet.</Text>
                                </View>
                            )}
                        </SectionCard>

                        <SectionCard title="Quick Links">
                            {profileLinks.map((link, index) => (
                                <TouchableOpacity
                                    key={link.label}
                                    activeOpacity={0.75}
                                    onPress={() => handleQuickLinkPress(link)}
                                    className={`h-12 flex-row items-center ${index < profileLinks.length - 1 ? "border-b border-[#F1F5F9]" : ""}`}
                                >
                                    <Ionicons name={link.icon} size={18} color="#4A43EC" />
                                    <Text className="ml-3 flex-1 text-[13px] font-lato-bold text-[#334155]">{link.label}</Text>
                                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                                </TouchableOpacity>
                            ))}
                        </SectionCard>
                    </>
                ) : null}

                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleLogout}
                    className="h-12 flex-row items-center justify-center rounded-2xl border border-red-200 bg-white"
                >
                    <Ionicons name="log-out-outline" size={18} color="#EF4444" />
                    <Text className="ml-2 text-[13px] font-lato-bold text-red-500">Log Out</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
