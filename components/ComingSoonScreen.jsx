import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StatusBar, Text, View } from "react-native";

export default function ComingSoonScreen({ title: propTitle } = {}) {
    const router = useRouter();
    const params = useLocalSearchParams();
    const title = propTitle || params?.title || "This page";

    return (
        <View className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />
            <View className="flex-row items-center border-b border-gray-100 px-5 pb-4 pt-14">
                <Pressable onPress={() => router.back()} className="mr-3 h-9 w-9 items-center justify-center" accessibilityRole="button" accessibilityLabel="Go back">
                    <Ionicons name="arrow-back" size={22} color="#111827" />
                </Pressable>
                <Text className="text-xl font-bold text-gray-900">{title}</Text>
            </View>
            <View className="flex-1 items-center justify-center px-8">
                <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF2FF]">
                    <Ionicons name="time-outline" size={30} color="#4A43EC" />
                </View>
                <Text className="mb-2 text-center text-2xl font-bold text-gray-900">Coming soon</Text>
                <Text className="text-center text-sm leading-5 text-gray-500">We are preparing this page for you.</Text>
            </View>
        </View>
    );
}