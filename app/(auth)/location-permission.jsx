import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withDelay,
    Easing,
    FadeIn,
    FadeInDown,
    FadeInUp,
} from "react-native-reanimated";

import {
    detectAndAssignBranchThunk,
    assignBranchThunk,
    logout,
    setLocation,
    setKycState,
} from "../../store/slices/authSlice";
import { profileAPI, setAuthToken } from "../../services/api";
import LocationMapPicker from "../../components/LocationMapPicker";

// Animated Radar Pulse Ring Component
function RadarRing({ delay = 0, size = 160 }) {
    const scale = useSharedValue(0.3);
    const opacity = useSharedValue(0.8);

    useEffect(() => {
        scale.value = withDelay(
            delay,
            withRepeat(
                withTiming(2.4, { duration: 2400, easing: Easing.out(Easing.ease) }),
                -1,
                false
            )
        );
        opacity.value = withDelay(
            delay,
            withRepeat(
                withTiming(0, { duration: 2400, easing: Easing.out(Easing.ease) }),
                -1,
                false
            )
        );
    }, [delay, scale, opacity]);

    const ringStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return (
        <Animated.View
            style={[
                {
                    position: "absolute",
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: 2,
                    borderColor: "#4A43EC",
                    backgroundColor: "rgba(74, 67, 236, 0.08)",
                },
                ringStyle,
            ]}
        />
    );
}

export default function LocationPermissionScreen() {
    const router = useRouter();
    const dispatch = useDispatch();

    // States: 'prompt' | 'detecting' | 'select_branch' | 'coming_soon' | 'gps_unavailable'
    const [viewState, setViewState] = useState("prompt");
    const [detectingStatus, setDetectingStatus] = useState("Acquiring GPS coordinates...");
    const [nearbyBranches, setNearbyBranches] = useState([]);
    const [selectedBranchId, setSelectedBranchId] = useState(null);
    const [detectedCity, setDetectedCity] = useState(null);
    const [detectedAddress, setDetectedAddress] = useState(null);
    const [isAssigning, setIsAssigning] = useState(false);
    const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);

    /**
     * Sends coordinates to backend to detect matching branches.
     */
    const processCoordinates = useCallback(async (
        latitude,
        longitude,
        clientCityHint = null,
        clientStateHint = null,
        clientAddressHint = null
    ) => {
        setViewState("detecting");
        setDetectingStatus("Checking city boundaries...");

        let clientCity = clientCityHint;
        let clientState = clientStateHint;
        let resolvedAddress = clientAddressHint || null;

        if (!clientCity || !resolvedAddress) {
            try {
                const [reverse] = await Location.reverseGeocodeAsync({ latitude, longitude });
                if (reverse) {
                    clientCity = clientCity || reverse.city || reverse.subregion || reverse.district || null;
                    clientState = clientState || reverse.region || null;
                    if (!resolvedAddress) {
                        const parts = [
                            reverse.name,
                            reverse.street,
                            reverse.subregion || reverse.district,
                            reverse.city,
                            reverse.region,
                            reverse.postalCode,
                        ].filter(Boolean);
                        if (parts.length > 0) {
                            resolvedAddress = parts.join(", ");
                        }
                    }
                }
            } catch {
                // Client reverse geocode is an optional hint
            }
        }

        if (resolvedAddress) {
            setDetectedAddress(resolvedAddress);
        }

        setDetectingStatus("Finding nearest SquarFT branches...");
        try {
            const result = await dispatch(
                detectAndAssignBranchThunk({
                    latitude,
                    longitude,
                    clientCity,
                    clientState,
                    locationAddress: resolvedAddress,
                })
            ).unwrap();

            const finalAddress = resolvedAddress || result.formattedAddress || result.detectedCity || clientCity;
            if (finalAddress) {
                setDetectedAddress(finalAddress);
            }

            const branchList = result.branches && result.branches.length
                ? result.branches
                : (result.branch ? [result.branch] : []);

            if (result.available && branchList.length > 0) {
                setNearbyBranches(branchList);
                setSelectedBranchId(branchList[0].id);
                setDetectedCity(result.detectedCity || branchList[0].city);
                setViewState("select_branch");
            } else {
                setDetectedCity(result.detectedCity || clientCity || "your city");
                setViewState("coming_soon");
            }
        } catch (backendError) {
            console.error("[LOCATION PERMISSION] Backend assignment error:", backendError);
            setDetectedCity(clientCity || "your city");
            setViewState("coming_soon");
        }
    }, [dispatch]);

    /**
     * Requests location permissions and acquires GPS coordinates with fallback.
     */
    const handleStartDetection = useCallback(async () => {
        setViewState("detecting");
        setDetectingStatus("Checking location services...");

        try {
            // 1. Check if device-level location services (GPS toggle) is enabled
            const servicesEnabled = await Location.hasServicesEnabledAsync();
            if (!servicesEnabled) {
                if (Platform.OS === "android") {
                    try {
                        await Location.enableNetworkProviderAsync();
                    } catch {
                        // User declined enabling GPS
                    }
                }
            }

            // 2. Check & request foreground permission
            setDetectingStatus("Requesting permission...");
            const perm = await Location.getForegroundPermissionsAsync();
            let finalStatus = perm.status;

            if (finalStatus !== "granted") {
                const requested = await Location.requestForegroundPermissionsAsync();
                finalStatus = requested.status;
            }

            if (finalStatus !== "granted") {
                setViewState("prompt");
                Alert.alert(
                    "Location Access Needed",
                    "Location permission is required to detect your operational branch and connect you to local inventory. You can also pinpoint your location manually on the map.",
                    [
                        { text: "Pick on Map", onPress: () => setIsMapPickerOpen(true) },
                        { text: "Open Settings", onPress: () => Linking.openSettings() },
                        { text: "Cancel", style: "cancel" },
                    ]
                );
                return;
            }

            // 3. Acquire live GPS coordinates with fallback to last known
            setDetectingStatus("Acquiring GPS coordinates...");
            let locationResult = null;

            try {
                locationResult = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: 5000,
                });
            } catch {
                try {
                    locationResult = await Location.getLastKnownPositionAsync();
                } catch {
                    locationResult = null;
                }
            }

            if (!locationResult?.coords) {
                setViewState("gps_unavailable");
                return;
            }

            const { latitude, longitude } = locationResult.coords;
            await processCoordinates(latitude, longitude);
        } catch (err) {
            console.error("[LOCATION PERMISSION] Detection error:", err);
            setViewState("gps_unavailable");
        }
    }, [processCoordinates]);

    // Check if permission already granted on mount
    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const { status } = await Location.getForegroundPermissionsAsync();
                const servicesEnabled = await Location.hasServicesEnabledAsync();
                if (status === "granted" && servicesEnabled && isMounted) {
                    handleStartDetection();
                }
            } catch (err) {
                console.warn("[LOCATION PERMISSION] Mount check error:", err.message);
            }
        })();
        return () => {
            isMounted = false;
        };
    }, [handleStartDetection]);

    // Handle selection from custom Map Picker
    const handleMapLocationConfirm = async (selected) => {
        setIsMapPickerOpen(false);
        if (selected?.location) {
            setDetectedAddress(selected.location);
        }
        if (selected?.latitude && selected?.longitude) {
            await processCoordinates(
                selected.latitude,
                selected.longitude,
                selected.city,
                selected.state,
                selected.location
            );
        }
    };

    // Confirm the user-selected branch and continue to the dashboard
    const handleConfirmBranch = async () => {
        const chosen = nearbyBranches.find((b) => b.id === selectedBranchId) || nearbyBranches[0];
        if (!chosen) return;

        const effectiveLocation = detectedAddress || detectedCity || chosen.city;

        setIsAssigning(true);
        try {
            await dispatch(
                assignBranchThunk({
                    branchId: chosen.id,
                    branchName: chosen.name,
                    location: effectiveLocation,
                })
            ).unwrap();

            dispatch(setLocation(effectiveLocation));
            try {
                const res = await profileAPI.getProfile();
                if (res?.success && res.data?.profile?.kyc_status) {
                    dispatch(setKycState(res.data.profile.kyc_status));
                }
            } catch {
                // ignore
            }
            router.replace("/(tabs)/home");
        } catch (assignError) {
            console.error("[LOCATION PERMISSION] Assign branch error:", assignError);
            Alert.alert("Unable to assign branch", assignError?.message || "Please try again.");
        } finally {
            setIsAssigning(false);
        }
    };

    const handleSignOut = async () => {
        setAuthToken(null);
        dispatch(logout());
        router.replace("/(auth)/login");
    };

    const selectedBranch = nearbyBranches.find((b) => b.id === selectedBranchId) || nearbyBranches[0];

    return (
        <SafeAreaView className="flex-1 bg-[#F8F9FE]" edges={["top", "bottom"]}>
            <StatusBar style="dark" />

            {/* Top Bar */}
            <View className="px-6 py-4 flex-row justify-between items-center">
                <View className="flex-row items-center">
                    <View className="w-8 h-8 rounded-lg bg-[#4A43EC]/10 items-center justify-center mr-2.5">
                        <Ionicons name="location" size={18} color="#4A43EC" />
                    </View>
                    <Text className="text-base font-lato-bold text-gray-900">SquarFT Network</Text>
                </View>
                {viewState !== "detecting" && (
                    <TouchableOpacity onPress={handleSignOut} className="py-1 px-2.5 rounded-lg">
                        <Text className="text-xs font-lato text-gray-500">Sign Out</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* State 1: Permission Prompt */}
            {viewState === "prompt" && (
                <Animated.View
                    entering={FadeInDown.duration(400)}
                    className="flex-1 px-6 justify-between py-6"
                >
                    <View className="items-center mt-4">
                        {/* Location Beacon Graphic */}
                        <View className="w-28 h-28 rounded-full bg-[#4A43EC]/10 items-center justify-center mb-6">
                            <View className="w-20 h-20 rounded-full bg-[#4A43EC]/20 items-center justify-center">
                                <View className="w-12 h-12 rounded-full bg-[#4A43EC] items-center justify-center shadow-lg shadow-[#4A43EC]/40">
                                    <Ionicons name="navigate" size={24} color="white" />
                                </View>
                            </View>
                        </View>

                        <Text className="text-2xl font-lato-black text-gray-900 text-center mb-2">
                            Find Your Nearest Branch
                        </Text>
                        <Text className="text-sm font-lato text-gray-500 text-center leading-5 px-4 mb-8">
                            We automatically connect your broker account to your local SquarFT branch based on your operating city.
                        </Text>

                        {/* Value Props */}
                        <View className="w-full bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3.5">
                            <View className="flex-row items-center py-1">
                                <View className="w-9 h-9 rounded-xl bg-blue-50 items-center justify-center mr-3">
                                    <Ionicons name="business" size={18} color="#3B82F6" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-sm font-lato-bold text-gray-900">Automatic Branch Link</Text>
                                    <Text className="text-xs font-lato text-gray-500">No manual branch codes or selection needed</Text>
                                </View>
                            </View>

                            <View className="flex-row items-center py-1">
                                <View className="w-9 h-9 rounded-xl bg-emerald-50 items-center justify-center mr-3">
                                    <Ionicons name="people" size={18} color="#10B981" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-sm font-lato-bold text-gray-900">Dedicated Field Officers</Text>
                                    <Text className="text-xs font-lato text-gray-500">Instant site visit coordination & customer walkthroughs</Text>
                                </View>
                            </View>

                            <View className="flex-row items-center py-1">
                                <View className="w-9 h-9 rounded-xl bg-purple-50 items-center justify-center mr-3">
                                    <Ionicons name="shield-checkmark" size={18} color="#8B5CF6" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-sm font-lato-bold text-gray-900">Local Verified Inventory</Text>
                                    <Text className="text-xs font-lato text-gray-500">Direct access to verified projects and payout terms in your city</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    <View className="w-full space-y-3">
                        <TouchableOpacity
                            onPress={handleStartDetection}
                            activeOpacity={0.85}
                            className="w-full bg-[#4A43EC] py-4 rounded-xl flex-row items-center justify-center shadow-md shadow-[#4A43EC]/30"
                        >
                            <Ionicons name="locate" size={20} color="white" style={{ marginRight: 8 }} />
                            <Text className="text-white font-lato-bold text-base">Enable Location Access</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            )}

            {/* State 2: Radar Scanning Animation */}
            {viewState === "detecting" && (
                <Animated.View
                    entering={FadeIn.duration(400)}
                    className="flex-1 px-6 items-center justify-center"
                >
                    {/* Pulsating Radar Visualizer */}
                    <View className="w-64 h-64 items-center justify-center mb-10">
                        <RadarRing delay={0} size={150} />
                        <RadarRing delay={800} size={150} />
                        <RadarRing delay={1600} size={150} />

                        {/* Center Pin */}
                        <View className="w-16 h-16 rounded-full bg-[#4A43EC] items-center justify-center shadow-xl shadow-[#4A43EC]/50 z-10">
                            <Ionicons name="location" size={28} color="white" />
                        </View>
                    </View>

                    <Text className="text-xl font-lato-black text-gray-900 text-center mb-2">
                        Detecting Nearest Branches
                    </Text>
                    <Text className="text-sm font-lato text-[#4A43EC] font-semibold text-center mb-8">
                        {detectingStatus}
                    </Text>

                    <View className="flex-row items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-100 shadow-sm">
                        <ActivityIndicator size="small" color="#4A43EC" />
                        <Text className="text-xs font-lato text-gray-500">Querying Google Maps & Branch Network...</Text>
                    </View>
                </Animated.View>
            )}

            {/* State 3: GPS / Location Services Unavailable */}
            {viewState === "gps_unavailable" && (
                <Animated.View
                    entering={FadeInDown.duration(400)}
                    className="flex-1 px-6 justify-between py-6"
                >
                    <View className="items-center mt-6">
                        <View className="w-24 h-24 rounded-full bg-amber-50 items-center justify-center mb-6">
                            <View className="w-16 h-16 rounded-full bg-amber-500 items-center justify-center shadow-lg shadow-amber-500/30">
                                <Ionicons name="location-outline" size={32} color="white" />
                            </View>
                        </View>

                        <Text className="text-2xl font-lato-black text-gray-900 text-center mb-2">
                            Location Services Off
                        </Text>

                        <Text className="text-sm font-lato text-gray-500 text-center leading-5 px-4 mb-6">
                            Your device location (GPS) is turned off or not available. Please turn on Location in your device quick settings, or pick your location manually on the map.
                        </Text>

                        <View className="w-full bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-2">
                            <View className="flex-row items-start py-1">
                                <Ionicons name="information-circle-outline" size={20} color="#F59E0B" style={{ marginRight: 8, marginTop: 2 }} />
                                <Text className="text-xs font-lato text-gray-600 flex-1 leading-5">
                                    Turn on GPS in your quick settings, or use the map below to pinpoint your operational city.
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View className="w-full space-y-3">
                        <TouchableOpacity
                            onPress={handleStartDetection}
                            activeOpacity={0.85}
                            className="w-full bg-[#4A43EC] py-4 rounded-xl flex-row items-center justify-center shadow-md shadow-[#4A43EC]/30"
                        >
                            <Ionicons name="refresh" size={18} color="white" style={{ marginRight: 8 }} />
                            <Text className="text-white font-lato-bold text-base">Turn On GPS & Retry</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            )}

            {/* State 4: Select Branch State (Supports single or multiple branches) */}
            {viewState === "select_branch" && nearbyBranches.length > 0 && (
                <Animated.View
                    entering={FadeInUp.duration(400)}
                    className="flex-1 px-6 justify-between py-4"
                >
                    <View className="flex-1">
                        {/* Header info */}
                        <View className="items-center mt-2 mb-4">
                            <View className="w-14 h-14 rounded-full bg-emerald-50 items-center justify-center mb-3">
                                <View className="w-10 h-10 rounded-full bg-emerald-500 items-center justify-center shadow-md shadow-emerald-500/30">
                                    <Ionicons name="business" size={20} color="white" />
                                </View>
                            </View>
                            <Text className="text-2xl font-lato-black text-gray-900 text-center mb-1">
                                {nearbyBranches.length > 1 ? "Select Your Branch" : "Branch Available!"}
                            </Text>
                            <Text className="text-xs font-lato text-gray-500 text-center px-2">
                                {nearbyBranches.length > 1
                                    ? `Found ${nearbyBranches.length} branches serving ${detectedCity}. Choose the branch to manage your deals.`
                                    : `Found a SquarFT branch serving ${detectedCity}.`}
                            </Text>
                            {(detectedAddress || detectedCity) && (
                                <View className="flex-row items-center justify-center mt-2.5 px-3 py-1 bg-white border border-gray-200 rounded-full max-w-[90%]">
                                    <Ionicons name="location-sharp" size={12} color="#4A43EC" style={{ marginRight: 4 }} />
                                    <Text numberOfLines={1} className="text-[11px] font-lato text-gray-700">
                                        {detectedAddress || detectedCity}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Scrollable list of branch cards */}
                        <ScrollView
                            className="flex-1 -mx-1 px-1"
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 16 }}
                        >
                            {nearbyBranches.map((branch) => {
                                const isSelected = selectedBranchId === branch.id;
                                return (
                                    <TouchableOpacity
                                        key={branch.id}
                                        onPress={() => setSelectedBranchId(branch.id)}
                                        activeOpacity={0.85}
                                        className={`p-4 rounded-2xl mb-3 border ${
                                            isSelected
                                                ? "border-[#4A43EC] bg-indigo-50/40 shadow-sm"
                                                : "border-gray-200 bg-white"
                                        }`}
                                    >
                                        <View className="flex-row items-start justify-between">
                                            {/* Radio button + branch info */}
                                            <View className="flex-row items-start flex-1 mr-2">
                                                <View
                                                    className={`w-5 h-5 rounded-full mt-0.5 mr-3 items-center justify-center ${
                                                        isSelected
                                                            ? "bg-[#4A43EC]"
                                                            : "border-2 border-gray-300 bg-white"
                                                    }`}
                                                >
                                                    {isSelected && (
                                                        <Ionicons name="checkmark" size={12} color="white" />
                                                    )}
                                                </View>

                                                <View className="flex-1">
                                                    <View className="flex-row items-center flex-wrap gap-1.5 mb-1">
                                                        <Text className="text-base font-lato-bold text-gray-900">
                                                            {branch.name}
                                                        </Text>
                                                        {branch.isNearest && (
                                                            <View className="bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                                                <Text className="text-[10px] font-lato-bold text-emerald-700">
                                                                    NEAREST
                                                                </Text>
                                                            </View>
                                                        )}
                                                    </View>

                                                    <Text className="text-xs font-lato text-gray-500 mb-1">
                                                        {branch.city}, {branch.state || "India"}
                                                    </Text>

                                                    {branch.address && (
                                                        <Text
                                                            numberOfLines={2}
                                                            className="text-[11px] font-lato text-gray-500 leading-4"
                                                        >
                                                            {branch.address}
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>

                                            {/* Distance pill */}
                                            {branch.distanceKm !== null && branch.distanceKm !== undefined && (
                                                <View className="bg-white border border-gray-100 px-2.5 py-1 rounded-full items-center shrink-0">
                                                    <Text className="text-[11px] font-lato-bold text-[#4A43EC]">
                                                        {branch.distanceKm} km
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Action Bar */}
                    <View className="pt-3 border-t border-gray-100 space-y-2.5">
                        <TouchableOpacity
                            disabled={!selectedBranch || isAssigning}
                            onPress={handleConfirmBranch}
                            activeOpacity={0.85}
                            className={`w-full py-4 rounded-xl items-center justify-center shadow-md shadow-[#4A43EC]/30 ${
                                isAssigning ? "bg-[#4A43EC]/70" : "bg-[#4A43EC]"
                            }`}
                        >
                            {isAssigning ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <Text className="text-white font-lato-bold text-base">
                                    {selectedBranch ? `Confirm & Continue with ${selectedBranch.name}` : "Confirm & Continue"}
                                </Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setIsMapPickerOpen(true)}
                            activeOpacity={0.7}
                            className="w-full py-2 items-center"
                        >
                            <Text className="text-xs font-lato text-gray-500">
                                Not your location? <Text className="text-[#4A43EC] font-lato-bold">Pick on Map</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            )}

            {/* State 5: Coming Soon UI (Zepto / Cars24 Style) */}
            {viewState === "coming_soon" && (
                <Animated.View
                    entering={FadeInUp.duration(400)}
                    className="flex-1 px-6 justify-between py-6"
                >
                    <View className="items-center mt-8">
                        {/* Rocket / City graphic */}
                        <View className="w-24 h-24 rounded-full bg-amber-50 items-center justify-center mb-6">
                            <View className="w-16 h-16 rounded-full bg-amber-500 items-center justify-center shadow-lg shadow-amber-500/30">
                                <Ionicons name="rocket" size={32} color="white" />
                            </View>
                        </View>

                        {/* Coming Soon Pill */}
                        <View className="bg-amber-100 border border-amber-300 px-3 py-1 rounded-full mb-3">
                            <Text className="text-xs font-lato-bold text-amber-800 uppercase tracking-wider">
                                Coming Soon
                            </Text>
                        </View>

                        <Text className="text-2xl font-lato-black text-gray-900 text-center mb-2">
                            We&apos;re not in {detectedCity} yet!
                        </Text>

                        <Text className="text-sm font-lato text-gray-500 text-center leading-5 px-4 mb-6">
                            SquarFT is rapidly expanding across major cities. We haven&apos;t launched our partner branch network in {detectedCity} just yet.
                        </Text>

                        {/* Info Callout Card */}
                        <View className="w-full bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-3">
                            <View className="flex-row items-center">
                                <View className="w-8 h-8 rounded-lg bg-indigo-50 items-center justify-center mr-3">
                                    <Ionicons name="notifications-outline" size={18} color="#4A43EC" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-sm font-lato-bold text-gray-900">We&apos;ll Notify You</Text>
                                    <Text className="text-xs font-lato text-gray-500">
                                        Your registration is saved. We will alert you the moment we launch in {detectedCity}.
                                    </Text>
                                </View>
                            </View>

                            <View className="h-[1px] bg-gray-100" />

                            <View className="flex-row items-center">
                                <View className="w-8 h-8 rounded-lg bg-emerald-50 items-center justify-center mr-3">
                                    <Ionicons name="map-outline" size={18} color="#10B981" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-sm font-lato-bold text-gray-900">Operating Elsewhere?</Text>
                                    <Text className="text-xs font-lato text-gray-500">
                                        You can manually pick another operating city where SquarFT has an active branch.
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Footer Actions */}
                    <View className="w-full space-y-3">

                        <TouchableOpacity
                            onPress={handleStartDetection}
                            activeOpacity={0.7}
                            className="w-full bg-white border border-gray-200 py-3.5 rounded-xl flex-row items-center justify-center"
                        >
                            <Ionicons name="refresh" size={18} color="#4A43EC" style={{ marginRight: 8 }} />
                            <Text className="text-[#4A43EC] font-lato-bold text-sm">Retry Current Location</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            )}

            {/* Custom Interactive Google Map Picker Modal */}
            <LocationMapPicker
                visible={isMapPickerOpen}
                onClose={() => setIsMapPickerOpen(false)}
                onConfirm={handleMapLocationConfirm}
            />
        </SafeAreaView>
    );
}
