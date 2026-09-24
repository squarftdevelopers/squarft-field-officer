import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { profileAPI, restoreAuthToken } from "../services/api";
import { useDispatch } from "react-redux";
import { setLoggedIn, setKycState, setBranch, setAuthChecked } from "../store/slices/authSlice";

const SPLASH_DURATION_MS = 650;

export default function Index() {
    const router = useRouter();
    const dispatch = useDispatch();

    useEffect(() => {
        const checkAuth = async () => {
            const startTime = Date.now();
            let routeTo = "/(auth)/onboarding1";

            try {
                const token = await restoreAuthToken();
                if (token) {
                    const res = await profileAPI.getProfile();
                    if (res && res.success && res.data?.profile) {
                        const profile = res.data.profile;
                        const existingBranchId = profile.branch_id || profile.branch?.id || null;
                        const kycStatus = profile.kyc_status || "missing";
                        dispatch(setKycState(kycStatus));
                        dispatch(setLoggedIn(true));

                        if (existingBranchId) {
                            dispatch(setBranch({ id: existingBranchId, name: profile.branch?.name || '' }));
                        }

                        if (!existingBranchId) {
                            routeTo = "/(auth)/location-permission";
                        } else {
                            routeTo = "/(tabs)/home";
                        }
                    } else {
                        dispatch(setAuthChecked(true));
                    }
                } else {
                    dispatch(setAuthChecked(true));
                }
            } catch (err) {
                console.error("Auth check failed:", err);
                dispatch(setAuthChecked(true));
            }

            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, SPLASH_DURATION_MS - elapsed);

            setTimeout(() => {
                router.replace(routeTo);
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
