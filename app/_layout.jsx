import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Provider } from 'react-redux';
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

SplashScreen.preventAutoHideAsync();

export default function AuthLayout() {
        const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
    const [fontsLoaded] = useFonts({
        Lato_400Regular,
        Lato_700Bold,
        Lato_300Light,
        Lato_900Black,
    });

    useEffect(() => {
        if (fontsLoaded) SplashScreen.hideAsync();
    }, [fontsLoaded]);

    if (!fontsLoaded) return null;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Provider store={store}>
                <BottomSheetModalProvider>
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
            </Provider>
        </GestureHandlerRootView>
    );
}
