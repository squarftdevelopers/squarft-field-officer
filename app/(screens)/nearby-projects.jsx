import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { projectsAPI } from "../../services/api";

const INITIAL_REGION = {
    latitude: 22.7196,
    longitude: 75.8577,
    latitudeDelta: 0.12,
    longitudeDelta: 0.12,
};

function parseCoordinate(value) {
    const coordinate = Number.parseFloat(value);

    return Number.isFinite(coordinate) ? coordinate : null;
}

function getProjectName(project) {
    return project?.name || project?.project_name || project?.title || "Unnamed project";
}

function getProjectAddress(project) {
    return [
        project?.location,
        project?.area,
        project?.city,
        project?.state,
        project?.pincode,
    ]
        .filter(Boolean)
        .join(", ");
}

function getProjectCoordinate(project) {
    const latitude = parseCoordinate(project?.latitude);
    const longitude = parseCoordinate(project?.longitude);

    if (latitude === null || longitude === null) return null;

    return { latitude, longitude };
}

function formatDistance(project) {
    const distanceKm = Number.parseFloat(project?.distance_km);

    if (Number.isFinite(distanceKm)) {
        return `${distanceKm.toFixed(distanceKm < 10 ? 2 : 1)} km`;
    }

    const distanceMeters = Number.parseFloat(project?.distance_meters);

    if (Number.isFinite(distanceMeters)) {
        return `${(distanceMeters / 1000).toFixed(2)} km`;
    }

    return "Nearby";
}

function openProjectInMaps(project) {
    const coordinate = getProjectCoordinate(project);
    if (!coordinate && !getProjectAddress(project)) {
        Alert.alert("No Location", "This project does not have any location details.");
        return;
    }

    router.push({
        pathname: "/projects/navigate",
        params: {
            lat: coordinate ? coordinate.latitude : "",
            lng: coordinate ? coordinate.longitude : "",
            address: getProjectAddress(project) || "",
            label: getProjectName(project)
        }
    });
}

function ProjectCard({ project }) {
    const address = getProjectAddress(project);
    const meta = [project?.property_type, project?.property_subtype, project?.category].filter(Boolean).join(" . ");

    return (
        <View className="mb-2.5 rounded-[12px] border border-[#E5E7EB] bg-white p-3">
            <View className="flex-row items-start justify-between">
                <View className="mr-3 flex-1">
                    <Text className="text-[14px] font-lato-bold text-[#0F172A]" numberOfLines={1}>
                        {getProjectName(project)}
                    </Text>
                    {address ? (
                        <Text className="mt-1 text-[11px] leading-4 text-[#64748B]" numberOfLines={2}>
                            {address}
                        </Text>
                    ) : null}
                </View>
                <View className="rounded-full bg-[#F1EFFF] px-2 py-1">
                    <Text className="text-[10px] font-lato-bold text-[#4A43EC]">{formatDistance(project)}</Text>
                </View>
            </View>

            {meta ? (
                <View className="mt-2 rounded-[10px] bg-[#F8F9FF] px-2.5 py-2">
                    <Text className="text-[11px] font-semibold text-[#334155]" numberOfLines={1}>
                        {meta}
                    </Text>
                </View>
            ) : null}

            <View className="mt-2.5 flex-row justify-end">
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => openProjectInMaps(project)}
                    className="h-8 flex-row items-center justify-center rounded-[8px] border border-[#DDE2FF] bg-white px-3"
                >
                    <Ionicons name="navigate-outline" size={13} color="#4A43EC" />
                    <Text className="ml-1.5 text-[11px] font-lato-bold text-[#4A43EC]">Open map</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function NearbyProjects() {
    const mapRef = useRef(null);
    const [location, setLocation] = useState(null);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [mapReady, setMapReady] = useState(false);

    const projectCoordinates = useMemo(
        () =>
            projects
                .map((project) => ({ project, coordinate: getProjectCoordinate(project) }))
                .filter((item) => item.coordinate),
        [projects],
    );

    const mapRegion = location
        ? {
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.12,
              longitudeDelta: 0.12,
          }
        : INITIAL_REGION;

    const fitMapToProjects = useCallback(() => {
        if (Platform.OS === "web" || !mapReady || !mapRef.current || !location) return;

        const coordinates = [
            { latitude: location.latitude, longitude: location.longitude },
            ...projectCoordinates.map((item) => item.coordinate),
        ];

        if (coordinates.length === 1) {
            mapRef.current.animateToRegion({
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
            });
            return;
        }

        mapRef.current.fitToCoordinates(coordinates, {
            edgePadding: { top: 70, right: 55, bottom: 70, left: 55 },
            animated: true,
        });
    }, [location, mapReady, projectCoordinates]);

    const loadNearbyProjects = useCallback(async (silent = false) => {
        if (silent) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError("");

        try {
            const permission = await Location.requestForegroundPermissionsAsync();

            if (!permission.granted) {
                setProjects([]);
                setError("Location permission is required to find nearby projects.");
                return;
            }

            const currentLocation = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const coordinate = {
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
            };

            setLocation(coordinate);

            const response = await projectsAPI.getNearbyProjects(coordinate);
            setProjects(response?.data?.projects || []);
        } catch (err) {
            setProjects([]);
            setError(err?.response?.data?.message || "Could not fetch nearby projects. Please try again.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadNearbyProjects();
    }, [loadNearbyProjects]);

    useEffect(() => {
        fitMapToProjects();
    }, [fitMapToProjects]);

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="dark" />
            <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
                <View className="border-b border-[#EEF2F7] px-4 pb-3 pt-2">
                    <View className="flex-row items-center">
                        <TouchableOpacity
                            activeOpacity={0.78}
                            onPress={() => router.back()}
                            className="h-9 w-9 items-center justify-center rounded-[10px] bg-[#F8F9FF]"
                        >
                            <Ionicons name="arrow-back" size={18} color="#111827" />
                        </TouchableOpacity>
                        <View className="ml-3 flex-1">
                            <Text className="text-[18px] font-lato-bold text-[#0F172A]">Nearby Projects</Text>
                            <Text className="mt-0.5 text-[11px] text-[#64748B]">
                                Sorted by distance from your current location
                            </Text>
                        </View>
                        {refreshing ? <ActivityIndicator size="small" color="#4A43EC" /> : null}
                    </View>
                </View>

                {loading ? (
                    <View className="flex-1 items-center justify-center px-8">
                        <ActivityIndicator size="large" color="#4A43EC" />
                        <Text className="mt-3 text-center text-[13px] font-lato-bold text-[#4A43EC]">
                            Fetching your location and nearby projects
                        </Text>
                    </View>
                ) : (
                    <ScrollView
                        className="flex-1"
                        contentContainerStyle={{ paddingBottom: 28 }}
                        alwaysBounceVertical={true}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => loadNearbyProjects(true)}
                                tintColor="#4A43EC"
                                colors={["#4A43EC"]}
                            />
                        }
                        showsVerticalScrollIndicator={false}
                    >
                        <View className="px-4 pt-3">
                            {error ? (
                                <View className="mb-3 rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] p-3">
                                    <View className="flex-row items-start">
                                        <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
                                        <View className="ml-2 flex-1">
                                            <Text className="text-[12px] font-lato-bold text-[#991B1B]">
                                                Nearby projects unavailable
                                            </Text>
                                            <Text className="mt-1 text-[11px] leading-4 text-[#B91C1C]">{error}</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        onPress={() => loadNearbyProjects()}
                                        className="mt-2 h-8 flex-row items-center justify-center rounded-[8px] bg-[#DC2626]"
                                    >
                                        <Ionicons name="refresh" size={13} color="#fff" />
                                        <Text className="ml-1.5 text-[11px] font-lato-bold text-white">Retry</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : null}

                            <View className="mb-3 overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-[#F8F9FF]">
                                {Platform.OS === "web" ? (
                                    <View className="h-[220px] items-center justify-center px-6">
                                        <Ionicons name="map-outline" size={42} color="#CBD5E1" />
                                        <Text className="mt-2 text-center text-[12px] text-[#64748B]">
                                            Map view is available in the mobile app.
                                        </Text>
                                    </View>
                                ) : (
                                    <MapView
                                        ref={mapRef}
                                        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
                                        initialRegion={mapRegion}
                                        onMapReady={() => setMapReady(true)}
                                        loadingEnabled
                                        style={{ height: 260, width: "100%" }}
                                        showsUserLocation
                                        showsMyLocationButton
                                    >
                                        {location ? (
                                            <Marker
                                                coordinate={location}
                                                title="Your location"
                                                pinColor="#4A43EC"
                                            />
                                        ) : null}

                                        {projectCoordinates.map(({ project, coordinate }, index) => (
                                            <Marker
                                                key={project.id || `${coordinate.latitude}-${coordinate.longitude}-${index}`}
                                                coordinate={coordinate}
                                                title={getProjectName(project)}
                                                description={formatDistance(project)}
                                            />
                                        ))}
                                    </MapView>
                                )}
                            </View>

                            <View className="mb-3 flex-row items-center justify-between">
                                <View>
                                    <Text className="text-[13px] font-lato-bold text-[#111827]">
                                        {projects.length} project{projects.length === 1 ? "" : "s"} found
                                    </Text>
                                    <Text className="mt-0.5 text-[10px] text-[#64748B]">
                                        Returned by the nearby projects API range
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={() => loadNearbyProjects(true)}
                                    disabled={refreshing}
                                    className="h-8 flex-row items-center justify-center rounded-[8px] bg-[#F1EFFF] px-3"
                                >
                                    <Ionicons name="locate-outline" size={13} color="#4A43EC" />
                                    <Text className="ml-1.5 text-[11px] font-lato-bold text-[#4A43EC]">Refresh</Text>
                                </TouchableOpacity>
                            </View>

                            {!error && projects.length === 0 ? (
                                <View className="mt-8 items-center px-8">
                                    <Ionicons name="map-outline" size={34} color="#CBD5E1" />
                                    <Text className="mt-3 text-center text-[14px] font-lato-bold text-[#64748B]">
                                        No nearby projects found
                                    </Text>
                                    <Text className="mt-1 text-center text-[11px] leading-4 text-[#94A3B8]">
                                        Try again from a different location or after project coordinates are updated.
                                    </Text>
                                </View>
                            ) : (
                                projects.map((project) => (
                                    <ProjectCard key={project.id || getProjectName(project)} project={project} />
                                ))
                            )}
                        </View>
                    </ScrollView>
                )}
            </SafeAreaView>
        </View>
    );
}
