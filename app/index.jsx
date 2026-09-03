import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { profileAPI, restoreAuthToken } from "../services/api";
import { useDispatch } from "react-redux";
import { setLoggedIn } from "../store/slices/authSlice";

const SPLASH_DURATION_MS = 100; // Fast-forward custom splash loop

export default function Index() {
    const router = useRouter();
    const dispatch = useDispatch();

    useEffect(() => {
        const checkAuth = async () => {
            const startTime = Date.now();
            let routeTo = "/(auth)/onboarding1";
            let routeParams = null;

            try {
                const token = await restoreAuthToken();
                if (token) {
                    const res = await profileAPI.getProfile();
                    if (res && res.success && res.data?.profile) {
                        const kycStatus = res.data.profile.kyc_status || "missing";
                        if (kycStatus === "verified") {
                            dispatch(setLoggedIn(true));
                            routeTo = "/(tabs)/home";
                        } else {
                            routeTo = "/(auth)/kyc";
                            routeParams = {
                                status: kycStatus,
                                rejectionReason: res.data.profile.rejection_reason || "",
                            };
                        }
                    }
                }
            } catch (err) {
                console.error("Auth check failed:", err);
            }

            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, SPLASH_DURATION_MS - elapsed);

            setTimeout(() => {
                if (routeParams) {
                    router.replace({
                        pathname: routeTo,
                        params: routeParams,
                    });
                } else {
                    router.replace(routeTo);
                }
            }, remaining);
        };

        checkAuth();
    }, [dispatch, router]);

    return (
        <View className="flex-1 bg-black">
            <StatusBar hidden />
            <Image
                source={require("../assets/images/splash-mobile.gif")}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
            />
        </View>
    );
}
