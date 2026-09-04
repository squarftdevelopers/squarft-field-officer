import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
// Decode Google encoded polyline to array of {latitude, longitude}
function decodePolyline(encoded) {
    const points = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
        let shift = 0;
        let result = 0;
        let byte;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        lat += result & 1 ? ~(result >> 1) : result >> 1;

        shift = 0;
        result = 0;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        lng += result & 1 ? ~(result >> 1) : result >> 1;

        points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
}

export default function NavigateScreen() {
    const { lat, lng, address, label, meetingId, leadId, taskId } = useLocalSearchParams();

    const [destination, setDestination] = useState(
        lat && lng ? { latitude: parseFloat(lat), longitude: parseFloat(lng) } : null,
    );

    const mapRef = useRef(null);
    const [userLocation, setUserLocation] = useState(null);
    const [routeCoords, setRouteCoords] = useState([]);
    const [routeInfo, setRouteInfo] = useState(null);
    const [steps, setSteps] = useState([]);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [completing, setCompleting] = useState(false);
    const locationWatchRef = useRef(null);

    // Geocode address string → coordinates using Google Geocoding API
    const geocodeAddress = async (addressStr) => {
        const url =
            `https://maps.googleapis.com/maps/api/geocode/json` +
            `?address=${encodeURIComponent(addressStr)}&key=${GOOGLE_MAPS_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === "OK" && data.results?.length) {
            const loc = data.results[0].geometry.location;
            return { latitude: loc.lat, longitude: loc.lng };
        }
        return null;
    };

    // Fetch directions from Google Directions API
    const fetchDirections = async (origin, dest) => {
        try {
            const url =
                `https://maps.googleapis.com/maps/api/directions/json` +
                `?origin=${origin.latitude},${origin.longitude}` +
                `&destination=${dest.latitude},${dest.longitude}` +
                `&mode=driving` +
                `&key=${GOOGLE_MAPS_API_KEY}`;

            const res = await fetch(url);
            const data = await res.json();

            if (data.status !== "OK" || !data.routes?.length) {
                Alert.alert("Route not found", "Could not get directions to this location.");
                return;
            }

            const route = data.routes[0];
            const leg = route.legs[0];

            const coords = decodePolyline(route.overview_polyline.points);
            setRouteCoords(coords);

            setRouteInfo({
                distance: leg.distance.value,
                duration: leg.duration.value,
                distanceText: leg.distance.text,
                durationText: leg.duration.text,
            });

            const parsedSteps = leg.steps.map((step) => ({
                instruction: step.html_instructions.replace(/<[^>]*>/g, ""),
                distance: step.distance.text,
                maneuver: step.maneuver || "straight",
                endLocation: step.end_location,
            }));
            setSteps(parsedSteps);

            if (coords.length > 0) {
                mapRef.current?.fitToCoordinates([origin, dest, ...coords], {
                    edgePadding: { top: 80, right: 40, bottom: 220, left: 40 },
                    animated: true,
                });
            }
        } catch {
            Alert.alert("Error", "Failed to fetch directions. Check your internet connection.");
        }
    };

    useEffect(() => {
        let mounted = true;

        (async () => {
            const { granted } = await Location.requestForegroundPermissionsAsync();
            if (!granted) {
                Alert.alert("Permission denied", "Location access is needed for navigation.");
                setLoading(false);
                return;
            }

            const loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });
            const origin = {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
            };

            if (!mounted) return;
            setUserLocation(origin);

            // Resolve destination — geocode address if no lat/lng given
            let dest = destination;
            if (!dest && address) {
                // Strip any " - Site Visit" suffix added by dashboard before geocoding
                const cleanAddress = String(address).replace(/\s*-\s*Site Visit\s*$/i, "").trim();
                dest = await geocodeAddress(cleanAddress);
                if (!dest) {
                    Alert.alert(
                        "Location not found",
                        `Could not locate "${cleanAddress}" on the map.\n\nAsk the admin to add a more specific location.`,
                    );
                    setLoading(false);
                    return;
                }
                setDestination(dest);
            }

            if (!dest) {
                Alert.alert(
                    "No location set",
                    "This item has no address or coordinates. Please add a location before navigating.",
                    [{ text: "Go Back", onPress: () => router.back() }],
                );
                setLoading(false);
                return;
            }

            await fetchDirections(origin, dest);
            setLoading(false);

            locationWatchRef.current = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.High, distanceInterval: 15 },
                (newLoc) => {
                    if (!mounted) return;
                    const updated = {
                        latitude: newLoc.coords.latitude,
                        longitude: newLoc.coords.longitude,
                    };
                    setUserLocation(updated);
                    advanceStep(updated);
                },
            );
        })();

        return () => {
            mounted = false;
            locationWatchRef.current?.remove();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Advance to next step when user is close to step end point
    const advanceStep = (userCoord) => {
        setSteps((currentSteps) => {
            setCurrentStepIndex((idx) => {
                if (idx >= currentSteps.length - 1) return idx;
                const step = currentSteps[idx];
                if (!step?.endLocation) return idx;
                const dlat = userCoord.latitude - step.endLocation.lat;
                const dlng = userCoord.longitude - step.endLocation.lng;
                const distMeters = Math.sqrt(dlat * dlat + dlng * dlng) * 111320;
                return distMeters < 30 ? idx + 1 : idx;
            });
            return currentSteps;
        });
    };

    const handleCompleteVisit = async () => {
        setCompleting(true);
        try {
            // If meetingId provided, mark meeting complete via API
            if (meetingId && leadId) {
                const { leadsAPI } = await import("../../services/api");
                await leadsAPI.updateMeetingCompletion(leadId, meetingId, true);
            } else if (taskId) {
                const { tasksAPI } = await import("../../services/api");
                await tasksAPI.markTaskComplete(taskId);
            }
        } catch (error) {
            Alert.alert(
                "Could not complete task",
                error?.response?.data?.message || error.message || "Please try again.",
            );
            setCompleting(false);
            return;
        } finally {
            setCompleting(false);
        }
        router.back();
    };

    const currentInstruction = steps[currentStepIndex]?.instruction || "Head towards destination";
    const currentStepDist = steps[currentStepIndex]?.distance || "";

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="large" color="#4A43EC" />
                <Text className="mt-3 text-[13px] text-[#64748B]">Getting your location...</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-white">
            <MapView
                ref={mapRef}
                provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
                style={{ flex: 1 }}
                showsUserLocation
                showsMyLocationButton={false}
                followsUserLocation
                initialRegion={
                    userLocation
                        ? {
                              latitude: userLocation.latitude,
                              longitude: userLocation.longitude,
                              latitudeDelta: 0.02,
                              longitudeDelta: 0.02,
                          }
                        : undefined
                }
            >
                {/* Route polyline */}
                {routeCoords.length > 0 && (
                    <Polyline
                        coordinates={routeCoords}
                        strokeColor="#4A43EC"
                        strokeWidth={5}
                        lineDashPattern={undefined}
                    />
                )}

                {/* Destination marker */}
                {destination && (
                    <Marker coordinate={destination} title={label || "Destination"} pinColor="#EF4444" />
                )}
            </MapView>

            {/* Top bar */}
            <SafeAreaView
                edges={["top"]}
                className="absolute left-0 right-0 top-0"
                style={{ backgroundColor: "transparent" }}
            >
                <View className="mx-4 mt-2 flex-row items-center">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        activeOpacity={0.8}
                        className="h-10 w-10 items-center justify-center rounded-full bg-white"
                        style={{ elevation: 4, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }}
                    >
                        <Ionicons name="arrow-back" size={20} color="#111827" />
                    </TouchableOpacity>

                    {routeInfo && (
                        <View
                            className="ml-3 flex-1 flex-row items-center justify-between rounded-xl bg-white px-4 py-2"
                            style={{ elevation: 4, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }}
                        >
                            <View className="flex-row items-center">
                                <Ionicons name="navigate" size={14} color="#4A43EC" />
                                <Text className="ml-1.5 text-[13px] font-lato-bold text-[#111827]">
                                    {routeInfo.durationText}
                                </Text>
                            </View>
                            <Text className="text-[12px] text-[#64748B]">{routeInfo.distanceText}</Text>
                        </View>
                    )}
                </View>
            </SafeAreaView>

            {/* Bottom instruction card + Complete button */}
            <SafeAreaView edges={["bottom"]} className="absolute bottom-0 left-0 right-0">
                <View className="mx-4 mb-4 overflow-hidden rounded-2xl bg-white"
                    style={{ elevation: 8, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: -2 } }}
                >
                    {/* Current step */}
                    {steps.length > 0 && (
                        <View className="flex-row items-start border-b border-[#F1F5F9] px-4 py-3">
                            <View className="mr-3 mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-[#4A43EC]">
                                <Ionicons name="arrow-forward" size={16} color="#fff" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-[13px] font-lato-bold text-[#111827]" numberOfLines={2}>
                                    {currentInstruction}
                                </Text>
                                {currentStepDist ? (
                                    <Text className="mt-0.5 text-[11px] text-[#64748B]">{currentStepDist}</Text>
                                ) : null}
                            </View>
                            <Text className="ml-2 text-[11px] text-[#94A3B8]">
                                {currentStepIndex + 1}/{steps.length}
                            </Text>
                        </View>
                    )}

                    {/* Destination label */}
                    <View className="flex-row items-center px-4 py-2.5">
                        <Ionicons name="location-sharp" size={14} color="#EF4444" />
                        <Text className="ml-2 flex-1 text-[12px] text-[#374151]" numberOfLines={1}>
                            {label ||
                                address ||
                                (destination
                                    ? `${destination.latitude.toFixed(5)}, ${destination.longitude.toFixed(5)}`
                                    : "Destination")}
                        </Text>
                    </View>

                    {/* Complete Visit button */}
                    <TouchableOpacity
                        activeOpacity={0.88}
                        onPress={handleCompleteVisit}
                        disabled={completing}
                        className="mx-4 mb-4 h-12 flex-row items-center justify-center rounded-xl bg-[#16A34A]"
                    >
                        {completing ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                                <Text className="ml-2 text-[14px] font-lato-bold text-white">
                                    {taskId ? "Complete Task" : "Complete Visit"}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}
