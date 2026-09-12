import { View, Text, Pressable, StatusBar, Platform, ScrollView, RefreshControl } from "react-native";
import { useEffect, useState, useCallback } from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { notificationApi } from "../../services/notificationApi";

const getIconConfig = (type) => {
    switch (type) {
        case "customer":
            return { lib: "mci", name: "account-search", color: "#F59E0B", bg: "#FFF7E6" };
        case "success":
            return { lib: "ion", name: "checkmark-circle", color: "#4A43EC", bg: "#E8EAFD" };
        case "error":
            return { lib: "ion", name: "close-circle", color: "#EF4444", bg: "#FEEBF0" };
        case "love":
            return { lib: "ion", name: "heart", color: "#EF4444", bg: "#FFEBEE" };
        case "inventory":
            return { lib: "mci", name: "home-city-outline", color: "#10B981", bg: "#E8F8F0" };
        case "deal":
            return { lib: "mci", name: "cash-check", color: "#4A43EC", bg: "#EBEAFF" };
        case "visit":
            return { lib: "mci", name: "calendar-clock", color: "#F97316", bg: "#FFF1E6" };
        default:
            return { lib: "ion", name: "notifications", color: "#4A43EC", bg: "#EBF1FF" };
    }
};

function NotificationIcon({ type }) {
    const config = getIconConfig(type);
    return (
        <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: config.bg }}>
            {config.lib === "mci" ? (
                <MaterialCommunityIcons name={config.name} size={24} color={config.color} />
            ) : (
                <Ionicons name={config.name} size={24} color={config.color} />
            )}
        </View>
    );
}

export default function Notifications() {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    const loadNotifications = useCallback(async () => {
        try {
            const res = await notificationApi.list();
            const list = res.data || [];
            const mapped = list.map((n) => ({
                id: n.id,
                title: n.title,
                description: n.body,
                watched: Boolean(n.is_read),
                target: n.metadata?.route || null,
                type: n.type || "default",
                time: n.sent_at ? new Date(n.sent_at).toLocaleDateString() : "Recently",
            }));
            setNotifications(mapped);
            setUnreadCount(Number(res.unread_count || 0));
        } catch (err) {
            console.warn("Failed to load notifications:", err.message);
        }
    }, []);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadNotifications();
        setRefreshing(false);
    };

    const handleMarkAllRead = async () => {
        try {
            await notificationApi.markAllRead();
            setNotifications((prev) => prev.map((item) => ({ ...item, watched: true })));
            setUnreadCount(0);
        } catch (err) {
            console.warn("Failed to mark all as read:", err.message);
        }
    };

    const openNotification = async (item) => {
        if (!item.watched) {
            try {
                await notificationApi.markRead(null, item.id);
                setNotifications((prev) =>
                    prev.map((n) => (n.id === item.id ? { ...n, watched: true } : n))
                );
                setUnreadCount((prev) => Math.max(0, prev - 1));
            } catch (err) {
                console.warn("Failed to mark read:", err.message);
            }
        }
        if (item.target && item.target !== "/(tabs)/home") {
            router.push(item.target);
        }
    };

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="dark-content" />

            <View
                className="flex-row items-center justify-between px-5 pb-3 mt-2"
                style={{ paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 24 : 62 }}
            >
                <Pressable onPress={() => router.back()} className="p-1">
                    <Ionicons name="arrow-back" size={22} color="black" />
                </Pressable>
                <View className="items-center">
                    <Text className="text-[17px] text-[#1F2937] font-lato-bold">Notifications</Text>
                    <Text className="text-[10px] text-gray-400 font-lato mt-0.5">
                        {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
                    </Text>
                </View>
                <Pressable
                    onPress={handleMarkAllRead}
                    className="bg-[#4A43EC]/10 px-3 py-1.5 rounded-lg"
                >
                    <Text className="text-[#4A43EC] text-[11px] font-lato-bold">Mark all read</Text>
                </Pressable>
            </View>

            {notifications.length === 0 ? (
                <View className="flex-1 items-center justify-center px-10 -mt-20">
                    <View className="w-28 h-28 rounded-full bg-[#F4F7FF] items-center justify-center">
                        <Ionicons name="mail-open-outline" size={42} color="#4A43EC" />
                    </View>
                    <Text className="text-[16px] font-lato-bold text-[#1F2937] mt-5 text-center">
                        No notifications yet
                    </Text>
                    <Text className="text-[12px] font-lato text-[#9CA3AF] mt-2.5 text-center leading-5">
                        Project, inventory, visit, and deal alerts will appear here when available.
                    </Text>
                </View>
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    alwaysBounceVertical={true}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={["#4A43EC"]}
                            tintColor="#4A43EC"
                        />
                    }
                    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 100 }}
                >
                    {notifications.map((item) => (
                        <Pressable
                            key={item.id}
                            style={({ pressed }) => ({
                                opacity: pressed ? 0.72 : 1,
                                transform: [{ scale: pressed ? 0.98 : 1 }],
                            })}
                            className="flex-row mb-6 relative"
                            onPress={() => openNotification(item)}
                        >
                            <NotificationIcon type={item.type} />
                            <View className="ml-4 flex-1">
                                <Text className={`text-[15px] ${item.watched ? "text-[#6B7280]" : "text-[#1F2937]"} font-lato-bold mb-0.5`}>
                                    {item.title}
                                </Text>
                                <Text className="text-[13px] text-[#9CA3AF] font-lato leading-5">
                                    {item.description}
                                </Text>
                                <Text className="text-[10px] text-[#9CA3AF] font-lato italic self-end mt-1">
                                    {item.time}
                                </Text>
                            </View>
                            {!item.watched && (
                                <View className="absolute top-1 right-0 w-2 h-2 bg-[#4A43EC] rounded-full" />
                            )}
                        </Pressable>
                    ))}
                </ScrollView>
            )}
        </View>
    );
}
