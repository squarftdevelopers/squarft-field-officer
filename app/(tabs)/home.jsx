import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState, useCallback } from "react";
import {
    Animated,
    Image,
    Linking,
    ScrollView,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
    Alert,
    RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import ProjectLeadFormSheet from "../../components/ProjectLeadFormSheet";
import { fetchDashboard } from "../../store/slices/dashboardSlice";
import { leadsAPI } from "../../services/api";
import {
    markProjectContacted,
    selectAllProjectFollowUps,
    selectAllProjectMeetings,
    selectProjects,
} from "../../store/slices/projectsSlice";

const POLL_INTERVAL = 30000; // 30 seconds

const followUpToneStyles = {
    danger: { accent: "#EF4444", badgeBg: "#FEE2E2", badgeText: "#B91C1C" },
    hot: { accent: "#F97316", badgeBg: "#FFEDD5", badgeText: "#C2410C" },
    warning: { accent: "#F59E0B", badgeBg: "#FEF3C7", badgeText: "#B45309" },
};

const meetingToneStyles = {
    primary: { accent: "#4A43EC", badgeBg: "#F1EFFF", badgeText: "#4A43EC" },
    success: { accent: "#16A34A", badgeBg: "#DCFCE7", badgeText: "#16A34A" },
};

function HeaderAvatar({ uri, name }) {
    const [failedUri, setFailedUri] = useState(null);

    if (uri && failedUri !== uri) {
        return (
            <Image
                source={{ uri }}
                onError={() => setFailedUri(uri)}
                className="h-12 w-12"
                resizeMode="cover"
            />
        );
    }

    const initials = (name || "Field Officer")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "FO";

    return <Text className="text-[15px] font-lato-bold text-[#4A43EC]">{initials}</Text>;
}

// Shimmer skeleton component
function Skeleton({ width, height, borderRadius = 8, style, color = "#E2E8F0" }) {
    const shimmer = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
            ])
        ).start();
    }, [shimmer]);

    const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] });

    return (
        <Animated.View
            style={[{ width, height, borderRadius, backgroundColor: color, opacity }, style]}
        />
    );
}

function HeaderSkeleton() {
    return (
        <View className="px-4 pb-[15px] pt-2 bg-white">
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                    <Skeleton width={48} height={48} borderRadius={12} />
                    <View className="ml-2.5">
                        <Skeleton width={130} height={16} style={{ marginBottom: 6 }} />
                        <Skeleton width={90} height={11} />
                    </View>
                </View>
                <Skeleton width={32} height={32} borderRadius={16} />
            </View>
            <View className="mt-5 flex-row justify-between rounded-[15px] bg-[#F8FAFC] px-5 py-3.5"
                style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.06, shadowRadius: 16.5, elevation: 4 }}
            >
                {[0, 1, 2, 3].map((i) => (
                    <View key={i} className="h-[75px] w-[75px] items-center justify-center rounded-[15px] bg-[#EBF1FF]">
                        <Skeleton width={28} height={14} color="#C4D7FF" style={{ marginBottom: 8 }} />
                        <Skeleton width={44} height={10} color="#C4D7FF" />
                    </View>
                ))}
            </View>
        </View>
    );
}

function CardSkeleton() {
    return (
        <View className="mb-3 rounded-[12px] border border-[#EEF0F4] bg-white p-3.5"
            style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
        >
            <View className="flex-row items-start justify-between">
                <View className="flex-1 mr-3">
                    <Skeleton width="65%" height={13} style={{ marginBottom: 6 }} />
                    <Skeleton width="45%" height={10} />
                </View>
                <Skeleton width={56} height={18} borderRadius={20} />
            </View>
            <Skeleton width="100%" height={38} borderRadius={9} style={{ marginTop: 10 }} />
            <View className="mt-3 flex-row">
                <Skeleton width="48%" height={32} borderRadius={9} style={{ marginRight: 8 }} />
                <Skeleton width="48%" height={32} borderRadius={9} />
            </View>
        </View>
    );
}

async function openUrl(url) {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
}

function callPhoneNumber(phone) { openUrl(`tel:${phone}`); }
function navigateToLocation({ lat, lng, address, label, meetingId, projectId }) {
    router.push({
        pathname: "/projects/navigate",
        params: {
            lat: lat || "",
            lng: lng || "",
            address: address || "",
            label: label || address || "",
            meetingId: meetingId || "",
            leadId: projectId || "",
        },
    });
}

export default function Home() {
    const dispatch = useDispatch();
    const [activeTab, setActiveTab] = useState("meeting");
    const [leadFormOpen, setLeadFormOpen] = useState(false);
    const projects = useSelector(selectProjects);
    const followUpItems = useSelector(selectAllProjectFollowUps);
    const meetingItems = useSelector(selectAllProjectMeetings);
    const notifications = useSelector((state) => state.notifications?.list || []);
    const { profile, metrics, loading } = useSelector((state) => state.dashboard);
    const apiMeetings = useSelector((state) => state.dashboard.tasks?.meetings ?? null);
    const apiFollowUps = useSelector((state) => state.dashboard.tasks?.follow_ups ?? null);
    const { height, width } = useWindowDimensions();
    const leadFormTranslateY = useRef(new Animated.Value(height)).current;
    const notchWidth = Math.min(width * 0.25, 102);
    const notchHeight = 16;

    const isFollowUp = activeTab === "followUp";
    const unreadNotifications = notifications.filter((n) => !n.watched).length;

    const visibleMeetings = apiMeetings
        ? apiMeetings.map((m) => ({
              id: m.id,
              projectId: m.leadId || m.projectId,
              projectName: m.title,
              location: m.location || m.subtitle, // clean address for geocoding
              subtitle: m.subtitle,               // display string
              time: m.time,
              note: m.note,
              status: m.tag,
              tone: "primary",
          }))
        : meetingItems.filter((i) => !i.isDone);

    const visibleFollowUps = apiFollowUps
        ? apiFollowUps.map((f) => ({
              id: f.id, // Follow-up ID
              projectId: f.leadId || f.projectId, // Lead ID for API calls
              projectName: f.title, 
              builderName: f.subtitle,
              time: f.time, 
              note: f.note, 
              status: f.tag,
              tone: f.tag === "Overdue" ? "danger" : f.tag === "Hot" ? "hot" : "warning",
          }))
        : followUpItems.filter((i) => !i.isDone);

    const stats = metrics
        ? [
              { value: metrics.total_leads, label: "Total Leads" },
              { value: metrics.meeting, label: "Meeting" },
              { value: metrics.onboarding, label: "Onboarding" },
              { value: metrics.live, label: "Live" },
          ]
        : [
              { value: projects.length, label: "Total Leads" },
              { value: projects.filter((p) => p.statusType === "meeting").length, label: "Meeting" },
              { value: projects.filter((p) => p.statusType === "interested").length, label: "Onboarding" },
              { value: projects.filter((p) => p.statusType === "live").length, label: "Live" },
          ];

    const controlsTranslateY = leadFormTranslateY.interpolate({
        inputRange: [0, Math.min(height, 260)],
        outputRange: [-118, 0],
        extrapolate: "clamp",
    });

    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await dispatch(fetchDashboard());
        } catch (err) {
            console.error("Refresh dashboard error:", err);
        } finally {
            setRefreshing(false);
        }
    }, [dispatch]);

    // Re-fetch dashboard when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            dispatch(fetchDashboard());
        }, [dispatch])
    );

    // Polling every 30s for real-time updates when screen is active
    useEffect(() => {
        const interval = setInterval(() => dispatch(fetchDashboard()), POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [dispatch]);

    useEffect(() => {
        if (!leadFormOpen) leadFormTranslateY.setValue(height);
    }, [height, leadFormOpen, leadFormTranslateY]);

    const openLeadForm = () => {
        setLeadFormOpen(true);
        leadFormTranslateY.setValue(height);
        requestAnimationFrame(() => {
            Animated.spring(leadFormTranslateY, {
                toValue: 0, useNativeDriver: true, damping: 25, stiffness: 185,
            }).start();
        });
    };

    const closeLeadForm = () => {
        Animated.timing(leadFormTranslateY, {
            toValue: height, duration: 230, useNativeDriver: true,
        }).start(() => setLeadFormOpen(false));
    };

    const markFollowUpDone = async (item) => {
        if (!item || !item.id || !item.projectId) {
            Alert.alert("Error", "Invalid follow-up data");
            return;
        }
        
        try {
            await leadsAPI.updateFollowUpCompletion(item.projectId, item.id, true);
            Alert.alert("Success", "Follow-up marked as done");
            // Refresh dashboard to update the UI
            dispatch(fetchDashboard());
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message || "Failed to mark follow-up as done";
            Alert.alert("Error", errorMessage);
            console.error("Mark follow-up done error:", error);
        }
    };

    const markMeetingDone = async (item) => {
        if (!item || !item.id || !item.projectId) {
            Alert.alert("Error", "Invalid meeting data");
            return;
        }
        
        try {
            await leadsAPI.updateMeetingCompletion(item.projectId, item.id, true);
            Alert.alert("Success", "Meeting marked as done");
            // Refresh dashboard to update the UI
            dispatch(fetchDashboard());
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message || "Failed to mark meeting as done";
            Alert.alert("Error", errorMessage);
            console.error("Mark meeting done error:", error);
        }
    };

    const callProject = (projectId, phoneNumber) => {
        dispatch(markProjectContacted(projectId));
        callPhoneNumber(phoneNumber);
    };

    return (
        <View className="flex-1 bg-[#4A43EC]">
            <StatusBar style="dark" />
            <SafeAreaView className="rounded-b-[20px] bg-white" edges={["top"]}>
                {loading && !profile ? (
                    <HeaderSkeleton />
                ) : (
                    <View className="px-4 pb-[15px] pt-2">
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white">
                                    <HeaderAvatar uri={profile?.avatar_url} name={profile?.name} />
                                </View>
                                <View className="ml-2.5">
                                    <View className="flex-row items-center">
                                        <Text className="text-[18px] font-lato-bold text-black">
                                            {profile?.name || "Field Officer"}
                                        </Text>
                                        <Ionicons name="checkmark-circle" size={14} color="#10F528" style={{ marginLeft: 5 }} />
                                    </View>
                                    <Text className="mt-0.5 text-[12px] text-black/60">
                                        {profile?.role_display || "Field Officer"}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                activeOpacity={0.75}
                                onPress={() => router.push("/(screens)/notifications")}
                                className="relative h-8 w-8 items-center justify-center rounded-full"
                            >
                                <Ionicons name="notifications" size={22} color="#4A43EC" />
                                {unreadNotifications > 0 && (
                                    <View className="absolute -right-0.5 -top-0.5 min-w-[16px] h-4 items-center justify-center rounded-full bg-red-500 px-1">
                                        <Text className="text-[8px] font-lato-bold text-white">
                                            {unreadNotifications > 9 ? "9+" : unreadNotifications}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>

                        <View
                            className="mt-5 flex-row justify-between rounded-[15px] bg-white px-5 py-3.5"
                            style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.06, shadowRadius: 16.5, elevation: 4 }}
                        >
                            {stats.map((item) => (
                                <View key={item.label} className="h-[75px] w-[75px] items-center justify-center rounded-[15px] bg-[#EBF1FF]">
                                    <Text className="text-[13px] font-semibold text-[#333333]">{item.value}</Text>
                                    <Text className="mt-2 text-center text-[10px] font-semibold text-black" numberOfLines={1} adjustsFontSizeToFit>
                                        {item.label}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </SafeAreaView>

            <Animated.View
                className="relative h-[82px] overflow-visible bg-[#4A43EC] px-7 pt-[27px]"
                style={{ transform: [{ translateY: controlsTranslateY }] }}
            >
                <View className="z-10 flex-row items-center justify-between">
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setActiveTab("meeting")}
                        className={`h-9 w-[107px] items-center justify-center rounded-[10px] border border-white ${isFollowUp ? "bg-white" : "bg-[#4A43EC]"}`}
                    >
                        <Text className={`text-[14px] font-semibold ${isFollowUp ? "text-[#4A43EC]" : "text-white"}`}>
                            Meeting
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={openLeadForm}
                        className="h-[44px] w-[44px] items-center justify-center rounded-[8px] bg-white"
                    >
                        <Ionicons name="add" size={27} color="#4A43EC" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setActiveTab("followUp")}
                        className={`h-9 w-[107px] items-center justify-center rounded-[10px] ${isFollowUp ? "border border-white bg-[#4A43EC]" : "bg-white"}`}
                    >
                        <Text className={`text-[14px] font-semibold ${isFollowUp ? "text-white" : "text-[#4A43EC]"}`}>
                            Follow Up
                        </Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>

            <View className="relative flex-1 overflow-visible rounded-t-[20px] bg-white">
                <View
                    className="absolute top-0 z-10 bg-[#4A43EC]"
                    style={{
                        left: (width - notchWidth) / 2,
                        width: notchWidth,
                        height: notchHeight,
                        borderBottomLeftRadius: 18,
                        borderBottomRightRadius: 18,
                    }}
                >
                    <View className="mx-auto mt-0 h-[4px] w-[54px] rounded-full bg-[#D9D9D9]" />
                </View>

                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ minHeight: 570, paddingBottom: 120, paddingTop: notchHeight + 18 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={["#4A43EC"]}
                            tintColor="#4A43EC"
                        />
                    }
                >
                    {/* Skeleton cards while loading for the first time */}
                    {loading && !apiMeetings && !apiFollowUps ? (
                        <View className="px-4">
                            <CardSkeleton />
                            <CardSkeleton />
                            <CardSkeleton />
                        </View>
                    ) : isFollowUp ? (
                        <View className="px-4">
                            {visibleFollowUps.map((item) => {
                                const tone = followUpToneStyles[item.tone] ?? followUpToneStyles.warning;
                                return (
                                    <View
                                        key={item.id}
                                        className="mb-2 rounded-[12px] border border-[#EEF0F4] bg-white px-3 py-2.5"
                                        style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
                                    >
                                        <View className="flex-row items-start justify-between">
                                            <View className="mr-2 flex-1">
                                                <Text className="text-[12px] font-lato-bold text-[#111827]" numberOfLines={1}>
                                                    {item.projectName}
                                                </Text>
                                                <View className="mt-0.5 flex-row items-center">
                                                    <Text className="text-[10px] text-[#6B7280]" numberOfLines={1}>{item.builderName}</Text>
                                                    <View className="mx-1.5 h-0.5 w-0.5 rounded-full bg-[#C8CDD8]" />
                                                    <Text className="text-[10px] text-[#6B7280]">{item.time}</Text>
                                                </View>
                                            </View>
                                            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: tone.badgeBg }}>
                                                <Text className="text-[9px] font-semibold" style={{ color: tone.badgeText }}>{item.status}</Text>
                                            </View>
                                        </View>
                                        <View className="mt-2 rounded-[9px] bg-[#F8F9FF] px-2.5 py-2">
                                            <Text className="text-[10px] leading-4 text-[#4B5563]">{item.note}</Text>
                                        </View>
                                        <View className="mt-2 flex-row items-center">
                                            <TouchableOpacity
                                                activeOpacity={0.85}
                                                onPress={() => callProject(item.projectId, item.phoneNumber)}
                                                className="mr-2 h-8 flex-1 flex-row items-center justify-center rounded-[9px] bg-[#4A43EC]"
                                            >
                                                <Ionicons name="call" size={12} color="#fff" />
                                                <Text className="ml-1.5 text-[11px] font-lato-bold text-white">Call</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                activeOpacity={0.85}
                                                onPress={() => markFollowUpDone(item)}
                                                className="h-8 flex-1 items-center justify-center rounded-[9px] bg-[#EBF1FF]"
                                            >
                                                <Text className="text-[11px] font-lato-bold text-[#4A43EC]">Done</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                            {!visibleFollowUps.length && (
                                <View className="mt-16 items-center">
                                    <Ionicons name="calendar-outline" size={32} color="#CBD5E1" />
                                    <Text className="mt-3 text-[14px] font-lato-bold text-[#64748B]">No follow-ups available</Text>
                                </View>
                            )}
                        </View>
                    ) : (
                        <View className="px-4">
                            {visibleMeetings.map((item) => {
                                const tone = meetingToneStyles[item.tone] ?? meetingToneStyles.primary;
                                return (
                                    <View
                                        key={item.id}
                                        className="mb-2 rounded-[12px] border border-[#EEF0F4] bg-white px-3 py-2.5"
                                        style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
                                    >
                                        <View className="flex-row items-start justify-between">
                                            <View className="mr-2 flex-1">
                                                <Text className="text-[12px] font-lato-bold text-[#111827]" numberOfLines={1}>
                                                    {item.projectName}
                                                </Text>
                                                <View className="mt-0.5 flex-row items-center">
                                                    <Text className="text-[10px] text-[#6B7280]" numberOfLines={1}>{item.location}</Text>
                                                    <View className="mx-1.5 h-0.5 w-0.5 rounded-full bg-[#C8CDD8]" />
                                                    <Text className="text-[10px] text-[#6B7280]">{item.time}</Text>
                                                </View>
                                            </View>
                                            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: tone.badgeBg }}>
                                                <Text className="text-[9px] font-semibold" style={{ color: tone.badgeText }}>{item.status}</Text>
                                            </View>
                                        </View>
                                        <View className="mt-2 rounded-[9px] bg-[#F8F9FF] px-2.5 py-2">
                                            <Text className="text-[10px] leading-4 text-[#4B5563]">
                                                {item.note || `Meet at ${item.location}.`}
                                            </Text>
                                        </View>
                                        <View className="mt-2 flex-row items-center">
                                            <TouchableOpacity
                                                activeOpacity={0.85}
                                                onPress={() => markMeetingDone(item)}
                                                className="mr-2 h-8 flex-1 flex-row items-center justify-center rounded-[9px] bg-[#4A43EC]"
                                            >
                                                <Ionicons name="checkmark" size={12} color="#fff" />
                                                <Text className="ml-1.5 text-[11px] font-lato-bold text-white">Done</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                activeOpacity={0.85}
                                                onPress={() => navigateToLocation({
                                                    lat: item.latitude,
                                                    lng: item.longitude,
                                                    address: item.location,
                                                    label: item.location || item.projectName,
                                                    meetingId: item.id,
                                                    projectId: item.projectId,
                                                })}
                                                className="h-8 flex-1 flex-row items-center justify-center rounded-[9px] bg-[#EBF1FF]"
                                            >
                                                <Ionicons name="location-outline" size={12} color="#4A43EC" />
                                                <Text className="ml-1.5 text-[11px] font-lato-bold text-[#4A43EC]">Navigate</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                            {!visibleMeetings.length && (
                                <View className="mt-16 items-center">
                                    <Ionicons name="calendar-outline" size={32} color="#CBD5E1" />
                                    <Text className="mt-3 text-[14px] font-lato-bold text-[#64748B]">No meetings available</Text>
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>
            </View>

            <ProjectLeadFormSheet
                visible={leadFormOpen}
                translateY={leadFormTranslateY}
                screenHeight={height}
                onClose={closeLeadForm}
            />
        </View>
    );
}
