import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { taskStatusFilters } from "../../data/tasksData";
import { tasksAPI } from "../../services/api";

const PURPLE = "#4A43EC";

const priorityColors = {
    HIGH: "#B91C1C",
    URGENT: "#B91C1C",
    NORMAL: "#B45309",
    LOW: "#2563EB",
};

const priorityLabels = {
    HIGH: "High",
    URGENT: "Urgent",
    NORMAL: "Medium",
    LOW: "Low",
};

const statusLabels = {
    ASSIGNED: "Scheduled",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    OVERDUE: "Overdue",
};

function openMapLocation(latitude, longitude) {
    if (!latitude || !longitude) return;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`).catch(() => {});
}

const handleNavigate = (task) => {
    if (!task.latitude && !task.longitude && !task.location) {
        Alert.alert("No Location", "This task does not have any location details.");
        return;
    }
    router.push({
        pathname: "/projects/navigate",
        params: {
            lat: task.latitude || "",
            lng: task.longitude || "",
            address: task.location || "",
            label: task.projectName || task.title || "Task Location"
        }
    });
};

const isToday = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
};

export default function Tasks() {
    const [activeFilter, setActiveFilter] = useState("all");
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchTasks = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);
        try {
            const res = await tasksAPI.getMyTasks();
            const list = res.data?.tasks || res.tasks || res.data || [];
            setTasks(list);
        } catch (err) {
            console.log("Error fetching tasks:", err?.response?.data || err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    const filteredTasks = useMemo(() => {
        if (activeFilter === "all") return tasks;
        if (activeFilter === "today") return tasks.filter((task) => task.due?.toLowerCase() === "today" || isToday(task.timeline));
        if (activeFilter === "open") return tasks.filter((task) => task.status !== "COMPLETED");
        return tasks.filter((task) => task.status === "COMPLETED");
    }, [activeFilter, tasks]);

    const openTasks = tasks.filter((task) => task.status !== "COMPLETED").length;

    const markComplete = async (taskId) => {
        try {
            await tasksAPI.markTaskComplete(taskId);
            setTasks((currentTasks) =>
                currentTasks.map((task) =>
                    task.id === taskId
                        ? { ...task, status: "COMPLETED", managerValidation: "Ready for final closure" }
                        : task
                )
            );
        } catch (err) {
            console.log("Error completing task:", err?.response?.data || err.message);
        }
    };

    return (
        <View className="flex-1 bg-white">
            <StatusBar style="light" backgroundColor={PURPLE} />
            <SafeAreaView className="flex-1 bg-[#4A43EC]" edges={["top"]}>
                <View className="bg-[#4A43EC] px-4 pb-5 pt-3">
                    <View className="flex-row items-center justify-between">
                        <View>
                            <Text className="text-[20px] font-lato-bold text-white">Tasks</Text>
                            <Text className="mt-1 text-[12px] text-white/75">{openTasks} open tasks</Text>
                        </View>
                    </View>
                </View>

                <View className="-mt-3 flex-1 rounded-t-[18px] bg-white">
                    <View className="px-4 pt-4">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
                            {taskStatusFilters.map((filter) => {
                                const isActive = activeFilter === filter.key;

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
                                            {filter.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    <ScrollView
                        className="flex-1"
                        contentContainerStyle={{ paddingBottom: 108, paddingHorizontal: 16, paddingTop: 12 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => fetchTasks(true)}
                                colors={[PURPLE]}
                                tintColor={PURPLE}
                            />
                        }
                    >
                        {loading ? (
                            <View className="mt-20 items-center justify-center">
                                <ActivityIndicator size="large" color={PURPLE} />
                            </View>
                        ) : filteredTasks.map((task) => {
                            const isCompleted = task.status === "COMPLETED";

                            return (
                                <View
                                    key={task.id}
                                    className="mb-2.5 rounded-[12px] border border-[#E5E7EB] bg-white p-3"
                                >
                                    <View className="flex-row items-start justify-between">
                                        <View className="mr-3 flex-1">
                                            <Text className="text-[14px] font-lato-bold text-[#111827]" numberOfLines={2}>
                                                {task.title}
                                            </Text>
                                            <Text className="mt-1 text-[11px] text-[#64748B]" numberOfLines={1}>
                                                {task.projectName || "No Project"} - {task.location || "No Location"}
                                            </Text>
                                        </View>
                                        <Text className="text-[10px] font-lato-bold text-[#4A43EC]">
                                            {statusLabels[task.status] || task.status}
                                        </Text>
                                    </View>

                                    <View className="mt-3 flex-row items-center justify-between">
                                        <View className="flex-row items-center">
                                            <Ionicons name="time-outline" size={13} color="#64748B" />
                                            <Text className="ml-1.5 text-[11px] font-semibold text-[#475569]">
                                                {task.due || "No Due Date"}{task.time ? `, ${task.time}` : ""}
                                            </Text>
                                            <View className="mx-2 h-1 w-1 rounded-full bg-[#CBD5E1]" />
                                            <Text className="text-[11px] font-lato-bold" style={{ color: priorityColors[task.priority] ?? "#475569" }}>
                                                {priorityLabels[task.priority] || task.priority}
                                            </Text>
                                        </View>
                                        <View className="flex-row items-center">
                                            <TouchableOpacity
                                                activeOpacity={0.8}
                                                onPress={() => handleNavigate(task)}
                                                className="mr-2 h-8 w-8 items-center justify-center rounded-[8px] bg-[#EBF1FF]"
                                            >
                                                <Ionicons name="location-outline" size={14} color={PURPLE} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                activeOpacity={0.85}
                                                onPress={() => markComplete(task.id)}
                                                disabled={isCompleted}
                                                className={`h-8 items-center justify-center rounded-[8px] px-3 ${
                                                    isCompleted ? "bg-[#DCFCE7]" : "bg-[#4A43EC]"
                                                }`}
                                            >
                                                <Text className={`text-[11px] font-lato-bold ${isCompleted ? "text-[#16A34A]" : "text-white"}`}>
                                                    Done
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}

                        {!loading && !filteredTasks.length && (
                            <View className="mt-16 items-center">
                                <Ionicons name="checkmark-done-outline" size={28} color="#CBD5E1" />
                                <Text className="mt-3 text-[14px] font-lato-bold text-[#64748B]">No tasks here</Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </SafeAreaView>
        </View>
    );
}
