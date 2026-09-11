import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch } from "react-redux";
import { projectFilters } from "../../data/projectsData";
import { leadsAPI } from "../../services/api";
import { markProjectContacted } from "../../store/slices/projectsSlice";

// Map UI filter keys → backend stage values
const stageMap = {
    all: "all",
    newLead: "new_lead",
    contacted: "first_contact",
    followUp: "follow_up",
    meeting: "meeting_scheduled",
    interested: "interested",
    inReview: "in_review",
    live: "project_live",
    rejected: "rejected",
};

// Map backend stage → UI display label + style
const stageStyles = {
    new_lead:           { label: "New Lead",   bg: "#E0F2FE", text: "#0369A1" },
    first_contact:      { label: "Contacted",  bg: "#E0F2FE", text: "#0369A1" },
    follow_up:          { label: "Follow Up",  bg: "#FFF7ED", text: "#EA580C" },
    meeting_scheduled:  { label: "Meeting",    bg: "#F1EFFF", text: "#4A43EC" },
    interested:         { label: "Interested", bg: "#DCFCE7", text: "#16A34A" },
    in_review:          { label: "In Review",  bg: "#FEF9C3", text: "#854D0E" },
    project_live:       { label: "Live",       bg: "#DCFCE7", text: "#16A34A" },
    rejected:           { label: "Rejected",   bg: "#FEE2E2", text: "#B91C1C" },
};

const tempStyles = {
    hot:  { bg: "#FEE2E2", text: "#B91C1C" },
    warm: { bg: "#FFEDD5", text: "#C2410C" },
    cold: { bg: "#DBEAFE", text: "#2563EB" },
};

function openUrl(url) {
    Linking.openURL(url).catch(() => {});
}

function CardSkeleton() {
    return (
        <View className="mb-2.5 rounded-[12px] border border-[#E5E7EB] bg-white p-2.5">
            <View className="flex-row items-start justify-between">
                <View className="flex-1 mr-3">
                    <View className="h-4 w-[55%] rounded bg-gray-200 mb-2" />
                    <View className="h-3 w-[40%] rounded bg-gray-100" />
                </View>
                <View className="h-5 w-16 rounded-full bg-gray-100" />
            </View>
            <View className="mt-2.5 h-12 rounded-[10px] bg-gray-100" />
            <View className="mt-2.5 flex-row justify-between items-center">
                <View className="h-3 w-28 rounded bg-gray-100" />
                <View className="flex-row">
                    <View className="h-7 w-7 rounded-[8px] bg-gray-100 mr-2" />
                    <View className="h-7 w-14 rounded-[8px] bg-gray-200" />
                </View>
            </View>
        </View>
    );
}

export default function Projects() {
    const router = useRouter();
    const dispatch = useDispatch();
    const [activeFilter, setActiveFilter] = useState("all");
    const [query, setQuery] = useState("");
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const debounceRef = useRef(null);

    const fetchLeads = useCallback(async (search, filter, silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const stage = stageMap[filter] || "all";
            const res = await leadsAPI.getLeads({ search: search.trim() || undefined, stage });
            setLeads(res.data || []);
        } catch (err) {
            console.log("Fetch leads error", err?.response?.data || err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchLeads(query, activeFilter);
    }, []);

    // Re-fetch on filter change immediately
    useEffect(() => {
        fetchLeads(query, activeFilter);
    }, [activeFilter]);

    // Debounce search input by 400ms
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchLeads(query, activeFilter);
        }, 400);
        return () => clearTimeout(debounceRef.current);
    }, [query]);

    return (
        <View className="flex-1 bg-white">
            <StatusBar style="dark" />
            <SafeAreaView className="flex-1" edges={["top"]}>
                <View className="px-4 pb-2 pt-1">
                    <View className="flex-row items-center justify-between">
                        <Text className="text-[20px] font-lato-bold text-[#0F172A]">Projects</Text>
                        {refreshing && <ActivityIndicator size="small" color="#4A43EC" />}
                    </View>

                    <View className="mt-3 h-11 flex-row items-center rounded-[12px] border border-[#E5E7EB] bg-white px-3">
                        <Ionicons name="search-outline" size={17} color="#8A94A6" />
                        <TextInput
                            value={query}
                            onChangeText={setQuery}
                            placeholder="Search project name"
                            placeholderTextColor="#9CA3AF"
                            className="ml-2 flex-1 text-[12px] text-[#111827]"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        {query ? (
                            <TouchableOpacity activeOpacity={0.75} onPress={() => setQuery("")}>
                                <Ionicons name="close-circle" size={17} color="#9CA3AF" />
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    <ScrollView
                        horizontal
                        className="mt-2.5"
                        contentContainerStyle={{ paddingRight: 16 }}
                        showsHorizontalScrollIndicator={false}
                    >
                        {projectFilters.map((filter) => {
                            const isActive = activeFilter === filter.key;
                            const label = filter.key === "all"
                                ? `${filter.label} (${leads.length})`
                                : filter.label;

                            return (
                                <TouchableOpacity
                                    key={filter.key}
                                    activeOpacity={0.8}
                                    onPress={() => setActiveFilter(filter.key)}
                                    className={`mr-2 h-8 items-center justify-center rounded-full border px-3.5 ${
                                        isActive ? "border-[#4A43EC] bg-[#4A43EC]" : "border-[#E2E8F0] bg-white"
                                    }`}
                                >
                                    <Text className={`text-[11px] font-lato-bold ${isActive ? "text-white" : "text-[#475569]"}`}>
                                        {label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 106, paddingTop: 2 }}
                    showsVerticalScrollIndicator={false}
                    alwaysBounceVertical={true}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => fetchLeads(query, activeFilter, true)}
                            colors={["#4A43EC"]}
                            tintColor="#4A43EC"
                        />
                    }
                >
                    {loading ? (
                        <>
                            <CardSkeleton />
                            <CardSkeleton />
                            <CardSkeleton />
                            <CardSkeleton />
                        </>
                    ) : leads.length === 0 ? (
                        <View className="mt-16 items-center">
                            <Ionicons name="search-outline" size={32} color="#CBD5E1" />
                            <Text className="mt-3 text-[14px] font-lato-bold text-[#64748B]">No projects found</Text>
                        </View>
                    ) : (
                        leads.map((lead) => {
                            const stageStyle = stageStyles[lead.stage] ?? stageStyles.new_lead;
                            const tempStyle = tempStyles[lead.lead_temperature] ?? tempStyles.warm;

                            return (
                                <View
                                    key={lead.id}
                                    className="mb-2.5 rounded-[12px] border border-[#E5E7EB] bg-white p-2.5"
                                >
                                    <View className="flex-row items-start justify-between">
                                        <View className="mr-3 flex-1">
                                            <View className="flex-row items-center">
                                                <Text
                                                    className="mr-2 flex-shrink text-[14px] font-lato-bold text-[#0F172A]"
                                                    numberOfLines={1}
                                                >
                                                    {lead.project_name}
                                                </Text>
                                                <View className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: tempStyle.bg }}>
                                                    <Text className="text-[9px] font-semibold" style={{ color: tempStyle.text }}>
                                                        {lead.lead_temperature
                                                            ? lead.lead_temperature.charAt(0).toUpperCase() + lead.lead_temperature.slice(1)
                                                            : "Warm"}
                                                    </Text>
                                                </View>
                                            </View>
                                            {[lead.builder_name, lead.location].filter(Boolean).length ? (
                                                <Text className="mt-0.5 text-[11px] text-[#64748B]" numberOfLines={1}>
                                                    {[lead.builder_name, lead.location].filter(Boolean).join(" . ")}
                                                </Text>
                                            ) : null}
                                        </View>
                                        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: stageStyle.bg }}>
                                            <Text className="text-[9px] font-lato-bold" style={{ color: stageStyle.text }}>
                                                {stageStyle.label}
                                            </Text>
                                        </View>
                                    </View>

                                    <View className="mt-2.5 rounded-[10px] bg-[#F8F9FF] px-2.5 py-2">
                                        <Text className="text-[9px] text-[#64748B]">Next action</Text>
                                        <Text className="mt-0.5 text-[12px] font-semibold text-[#111827]">
                                            {lead.next_action || "No next action"}
                                        </Text>
                                    </View>

                                    <View className="mt-2.5 flex-row items-center justify-between">
                                        <Text className="text-[10px] text-[#94A3B8]">
                                            Updated: {new Date(lead.updated_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                        </Text>
                                        <View className="flex-row items-center">
                                            <TouchableOpacity
                                                activeOpacity={0.8}
                                                onPress={() => {
                                                    dispatch(markProjectContacted(lead.id));
                                                    openUrl(`tel:${lead.contact_number}`);
                                                    leadsAPI.recordCall(lead.id)
                                                        .then((res) => {
                                                            if (res?.data?.lead) {
                                                                setLeads((prev) => prev.map((l) =>
                                                                    l.id === lead.id
                                                                        ? { ...l, stage: res.data.lead.stage }
                                                                        : l
                                                                ));
                                                            }
                                                        })
                                                        .catch(() => {});
                                                }}
                                                className="mr-2 h-7 w-7 items-center justify-center rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC]"
                                            >
                                                <Ionicons name="call-outline" size={13} color="#475569" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                activeOpacity={0.85}
                                                onPress={() => router.push({
                                                    pathname: `/projects/${lead.id}`,
                                                    params: { leadData: JSON.stringify(lead) }
                                                })}
                                                className="h-7 items-center justify-center rounded-[8px] bg-[#4A43EC] px-3.5"
                                            >
                                                <Text className="text-[11px] font-lato-bold text-white">View</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
