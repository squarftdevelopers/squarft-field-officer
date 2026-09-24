import { Stack } from "expo-router";

export default function AuthLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: "none" }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
            <Stack.Screen name="otp-verification" />
            <Stack.Screen name="location-permission" />
            <Stack.Screen name="kyc" />
        </Stack>
    );
}
