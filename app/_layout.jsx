import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Provider } from 'react-redux';
import { Alert, AppState, BackHandler, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";
import { store } from '../store/store';
import AnimatedSplashScreen from '../components/AnimatedSplashScreen';
import {
    useFonts,
    Lato_400Regular,
    Lato_700Bold,
    Lato_300Light,
    Lato_900Black,
} from "@expo-google-fonts/lato";

import { appActivityAPI, restoreAuthToken } from "../services/api";
import { registerForPushNotificationsAsync } from "../services/pushNotifications";

SplashScreen.preventAutoHideAsync();

function AndroidExitGuard() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (Platform.OS !== "android") return undefined;

        const onBackPress = () => {
            if (router.canGoBack()) {
                return false;
            }

            Alert.alert("Exit app", "Are you sure you want to exit the app?", [
                { text: "Cancel", style: "cancel" },
                { text: "Exit", style: "destructive", onPress: () => BackHandler.exitApp() },
            ]);
            return true;
        };

        const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
        return () => subscription.remove();
    }, [pathname, router]);

    return null;
}

function FieldOfficerLocationReporter() {
    useEffect(() => {
        let timer = null;
        let mounted = true;

        const reportLocation = async () => {
            try {
                const permission = await Location.requestForegroundPermissionsAsync();
                if (!mounted || permission.status !== 'granted') return;
                const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                if (!mounted) return;
                await appActivityAPI.heartbeat({
                    latitude: current.coords.latitude,
                    longitude: current.coords.longitude,
                });
            } catch (error) {
                // Location is optional: do not interrupt the Field Officer app
                // if GPS is disabled, permission is denied, or the network is unavailable.
                console.warn('Unable to report foreground location:', error?.message || error);
            }
        };

        const start = () => {
            reportLocation();
            timer = setInterval(reportLocation, 60_000);
        };
        const stop = () => {
            if (timer) clearInterval(timer);
            timer = null;
        };

        start();
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') start();
            else stop();
        });
        return () => {
            mounted = false;
            stop();
            subscription.remove();
        };
    }, []);
    return null;
}

export default function AuthLayout() {
    const router = useRouter();
    const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
    const [fontsLoaded] = useFonts({
        Lato_400Regular,
        Lato_700Bold,
        Lato_300Light,
        Lato_900Black,
    });

    useEffect(() => {
        if (!fontsLoaded) return undefined;
        const timer = setTimeout(() => SplashScreen.hideAsync(), 180);
        return () => clearTimeout(timer);
    }, [fontsLoaded]);

    useEffect(() => {
        restoreAuthToken().then((token) => {
            if (token) {
                registerForPushNotificationsAsync(token);
            }
        });
    }, []);

    useEffect(() => {
        const openNotificationRoute = (response) => {
            const route = response?.notification?.request?.content?.data?.route;
            if (typeof route === "string" && route.startsWith("/")) {
                router.push(route);
            }
        };

        const subscription = Notifications.addNotificationResponseReceivedListener(openNotificationRoute);
        Notifications.getLastNotificationResponseAsync()
            .then((response) => {
                if (response) openNotificationRoute(response);
            })
            .catch((error) => console.warn("Unable to open notification route:", error.message));

        return () => subscription.remove();
    }, [router]);

    if (!fontsLoaded) return null;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Provider store={store}>
                <SafeAreaProvider>
                    <StatusBar style="dark" backgroundColor="transparent" translucent={true} />
                    <BottomSheetModalProvider>
                        <AndroidExitGuard />
                        <FieldOfficerLocationReporter />
                        <Stack>
                            <Stack.Screen name="index" options={{ headerShown: false }} />
                            {/* Onboarding */}
                            <Stack.Screen name="(auth)" options={{ headerShown: false, animation: "none" }} />
                            {/* Main */}
                            <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "none" }} />
                            <Stack.Screen name="(screens)" options={{ headerShown: false, animation: "none" }} />
                            <Stack.Screen name="projects/[id]" options={{ headerShown: false }} />
                            <Stack.Screen name="projects/navigate" options={{ headerShown: false }} />
                        </Stack>
                        {showAnimatedSplash && (
                            <AnimatedSplashScreen onFinish={() => setShowAnimatedSplash(false)} />
                        )}
                    </BottomSheetModalProvider>
                </SafeAreaProvider>
            </Provider>
        </GestureHandlerRootView>
    );
}
