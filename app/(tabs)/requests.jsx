import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { projectRequestsAPI } from "../../services/api";

const PURPLE = "#4A43EC";
const FILTERS = [
    { key: "pending", label: "Pending" },
    { key: "accepted", label: "Accepted" },
    { key: "rejected", label: "Rejected" },
    { key: "all", label: "All" },
];

const statusStyle = {
    pending: { label: "Awaiting response", background: "#FFF7ED", color: "#C2410C" },
    accepted: { label: "Accepted", background: "#DCFCE7", color: "#15803D" },
    rejected: { label: "Rejected", background: "#FEE2E2", color: "#B91C1C" },
    cancelled: { label: "Cancelled", background: "#F1F5F9", color: "#64748B" },
};

const formatDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const titleCase = (value) => String(value || "").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

export default function ProjectRequests() {
    const [activeFilter, setActiveFilter] = useState("pending");
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [respondingId, setRespondingId] = useState(null);

    const fetchRequests = useCallback(async (silent = false) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        try {
            const response = await projectRequestsAPI.getRequests("all");
            setRequests(response.data?.requests || []);
        } catch (error) {
            if (!silent) {
                Alert.alert("Could not load requests", error.response?.data?.message || error.message);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => {
        fetchRequests();
    }, [fetchRequests]));

    const filteredRequests = useMemo(() => (
        activeFilter === "all" ? requests : requests.filter((item) => item.status === activeFilter)
    ), [activeFilter, requests]);

    const pendingCount = requests.filter((item) => item.status === "pending").length;

    const applyResponse = async (request, action) => {
        setRespondingId(request.id);
        try {
            const response = await projectRequestsAPI.respond(request.id, action);
            const updatedRequest = response.data?.request;
            setRequests((items) => items.map((item) => (
                item.id === request.id
                    ? { ...item, ...updatedRequest, lead_id: response.data?.lead_id || item.lead_id }
                    : item
            )));
            Alert.alert(
                action === "accept" ? "Project accepted" : "Request rejected",
                action === "accept"
                    ? "The connection is active and this project is now in your lead pipeline."
                    : "No project connection was created.",
            );
        } catch (error) {
            Alert.alert("Could not update request", error.response?.data?.message || error.message);
        } finally {
            setRespondingId(null);
        }
    };

    const rejectRequest = (request) => {
        Alert.alert(
            "Reject project request?",
            `You will not be connected to ${request.project_name}.`,
            [
                { text: "Keep Request", style: "cancel" },
                { text: "Reject", style: "destructive", onPress: () => applyResponse(request, "reject") },
            ],
        );
    };

    return (
        <View className="flex-1 bg-white">
            <StatusBar style="light" backgroundColor={PURPLE} />
            <SafeAreaView className="flex-1 bg-[#4A43EC]" edges={["top"]}>
                <View className="bg-[#4A43EC] px-4 pb-6 pt-3">
                    <Text className="text-[20px] font-lato-bold text-white">Project Requests</Text>
                    <Text className="mt-1 text-[12px] text-white/75">
                        {pendingCount ? `${pendingCount} request${pendingCount === 1 ? "" : "s"} waiting` : "No pending requests"}
                    </Text>
                </View>

                <View className="-mt-3 flex-1 rounded-t-[18px] bg-white pt-4">
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="max-h-10 px-4"
                        contentContainerStyle={{ paddingRight: 28 }}
                    >
                        {FILTERS.map((filter) => {
                            const selected = activeFilter === filter.key;
                            return (
                                <TouchableOpacity
                                    key={filter.key}
                                    onPress={() => setActiveFilter(filter.key)}
                                    className={`mr-2 h-8 items-center justify-center rounded-full border px-4 ${selected ? "border-[#4A43EC] bg-[#4A43EC]" : "border-[#E2E8F0] bg-white"}`}
                                >
                                    <Text className={`text-[11px] font-lato-bold ${selected ? "text-white" : "text-[#475569]"}`}>
                                        {filter.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <ScrollView
                        className="flex-1"
                        showsVerticalScrollIndicator={false}
                        alwaysBounceVertical={true}
                        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={() => fetchRequests(true)} colors={[PURPLE]} tintColor={PURPLE} />
                        }
                    >
                        {loading ? (
                            <View className="items-center py-24">
                                <ActivityIndicator size="large" color={PURPLE} />
                            </View>
                        ) : filteredRequests.length === 0 ? (
                            <View className="items-center px-8 py-24">
                                <View className="h-16 w-16 items-center justify-center rounded-full bg-[#F1EFFF]">
                                    <Ionicons name="mail-open-outline" size={28} color={PURPLE} />
                                </View>
                                <Text className="mt-4 text-base font-lato-bold text-[#1E293B]">No {activeFilter === "all" ? "project" : activeFilter} requests</Text>
                                <Text className="mt-2 text-center text-[12px] leading-5 text-[#64748B]">
                                    New requests from project developers will appear here.
                                </Text>
                            </View>
                        ) : filteredRequests.map((request) => {
                            const tone = statusStyle[request.status] || statusStyle.cancelled;
                            const responding = respondingId === request.id;
                            return (
                                <View key={request.id} className="mb-3 overflow-hidden rounded-[16px] border border-[#E5E7EB] bg-white">
                                    {request.cover_image_url ? (
                                        <Image source={{ uri: request.cover_image_url }} className="h-32 w-full bg-[#F1F5F9]" resizeMode="cover" />
                                    ) : (
                                        <View className="h-24 w-full items-center justify-center bg-[#F1EFFF]">
                                            <Ionicons name="business-outline" size={30} color={PURPLE} />
                                        </View>
                                    )}
                                    <View className="p-4">
                                        <View className="flex-row items-start justify-between">
                                            <View className="mr-3 flex-1">
                                                <Text className="text-[15px] font-lato-bold text-[#0F172A]">{request.project_name}</Text>
                                                <Text className="mt-1 text-[11px] text-[#64748B]">From {request.developer_name}</Text>
                                            </View>
                                            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: tone.background }}>
                                                <Text className="text-[9px] font-lato-bold" style={{ color: tone.color }}>{tone.label}</Text>
                                            </View>
                                        </View>

                                        <View className="mt-3 flex-row items-start">
                                            <Ionicons name="location-outline" size={14} color="#64748B" />
                                            <Text className="ml-1.5 flex-1 text-[11px] leading-4 text-[#475569]">
                                                {[request.location, request.city, request.state, request.pincode].filter(Boolean).join(", ") || "Location unavailable"}
                                            </Text>
                                        </View>
                                        {request.property_types?.length ? (
                                            <View className="mt-2 flex-row items-center">
                                                <Ionicons name="grid-outline" size={13} color="#64748B" />
                                                <Text className="ml-1.5 text-[10px] text-[#64748B]">
                                                    {request.property_types.map(titleCase).join(" · ")}
                                                </Text>
                                            </View>
                                        ) : null}
                                        <Text className="mt-3 text-[9px] text-[#94A3B8]">Requested {formatDate(request.requested_at)}</Text>

                                        {request.status === "pending" ? (
                                            <View className="mt-4 flex-row">
                                                <TouchableOpacity
                                                    disabled={responding}
                                                    onPress={() => rejectRequest(request)}
                                                    className="mr-2 h-10 flex-1 items-center justify-center rounded-xl border border-[#FCA5A5] bg-white"
                                                >
                                                    <Text className="text-[12px] font-lato-bold text-[#DC2626]">Reject</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    disabled={responding}
                                                    onPress={() => applyResponse(request, "accept")}
                                                    className="h-10 flex-1 flex-row items-center justify-center rounded-xl bg-[#4A43EC]"
                                                >
                                                    {responding ? <ActivityIndicator size="small" color="#fff" /> : (
                                                        <>
                                                            <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                                                            <Text className="ml-1.5 text-[12px] font-lato-bold text-white">Accept</Text>
                                                        </>
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        ) : request.status === "accepted" && request.lead_id ? (
                                            <TouchableOpacity
                                                onPress={() => router.push(`/projects/${request.lead_id}`)}
                                                className="mt-4 h-10 flex-row items-center justify-center rounded-xl bg-[#F1EFFF]"
                                            >
                                                <Text className="text-[12px] font-lato-bold text-[#4A43EC]">Open Lead</Text>
                                                <Ionicons name="arrow-forward" size={14} color={PURPLE} style={{ marginLeft: 6 }} />
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>
            </SafeAreaView>
        </View>
    );
}
