import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, Platform, Modal, ActivityIndicator, Alert, Keyboard, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";

const hasValidGoogleMapsKey = () => {
    const key = Constants.expoConfig?.extra?.googleMapsApiKey || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    return Boolean(key && !/your_google_maps_api_key_here|placeholder|changeme/i.test(key));
};

const isPlusCode = (value = "") => /\b[A-Z0-9]{4,8}\+[A-Z0-9]{2,3}\b/i.test(String(value));

const parseReverseGeocode = (place = {}) => {
    const safeName = !isPlusCode(place.name) ? place.name : "";
    const streetLine = [place.streetNumber, place.street].filter(Boolean).join(" ").trim();
    const locationStr = [streetLine || safeName, place.district, place.subregion, place.city, place.region, place.postalCode]
        .filter((part, index, parts) => part && !isPlusCode(part) && parts.indexOf(part) === index)
        .join(", ");

    return {
        location: locationStr,
        city: place.city || place.district || place.subregion || "",
        state: place.region || "",
        pincode: place.postalCode || "",
    };
};

const parseAddressComponents = (components = [], fallbackFormattedAddress = "") => {
    const get = (type) => components.find((c) => c.types.includes(type))?.long_name || "";
    const sublocality = get("sublocality_level_1") || get("sublocality") || get("neighborhood");
    const streetLine = [get("street_number"), get("route")].filter(Boolean).join(" ");
    const city = get("locality") || get("administrative_area_level_2");
    const state = get("administrative_area_level_1");
    const pincode = get("postal_code");
    const standardAddress = [
        get("premise") || get("establishment"),
        streetLine,
        sublocality,
        city,
        state,
        pincode,
    ].filter((part, index, parts) => part && !isPlusCode(part) && parts.indexOf(part) === index).join(", ");

    return {
        location: standardAddress || fallbackFormattedAddress,
        city,
        state,
        pincode,
    };
};

const fetchAddressFromGoogle = async (latitude, longitude) => {
    if (!hasValidGoogleMapsKey()) return null;

    const apiKey = Constants.expoConfig?.extra?.googleMapsApiKey || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
    );
    const data = await res.json();

    if (data.status !== "OK" || !data.results?.length) return null;

    const preferredResult = data.results.find((result) =>
        result.types?.some((type) => ["street_address", "premise", "subpremise", "establishment", "route"].includes(type))
        && !result.types?.includes("plus_code")
        && !isPlusCode(result.formatted_address)
    ) || data.results.find((result) => !result.types?.includes("plus_code") && !isPlusCode(result.formatted_address));

    if (!preferredResult) return null;

    return parseAddressComponents(preferredResult.address_components, preferredResult.formatted_address);
};

// Places Autocomplete + Details, billed together as one "session" via sessiontoken
// (Google's recommended pattern — bundles the keystroke-by-keystroke predictions and
// the final details lookup into a single session instead of billing each call
// separately). Restricted to India since RERA registration is India-only.
const fetchPlacePredictions = async (query, sessionToken) => {
    if (!hasValidGoogleMapsKey() || !query.trim()) return [];

    const apiKey = Constants.expoConfig?.extra?.googleMapsApiKey || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:in&sessiontoken=${sessionToken}&key=${apiKey}`
    );
    const data = await res.json();
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        console.log('[MAP PICKER] Place search failed:', data.status);
    }
    return data.predictions || [];
};

const fetchPlaceDetails = async (placeId, sessionToken) => {
    if (!hasValidGoogleMapsKey()) return null;

    const apiKey = Constants.expoConfig?.extra?.googleMapsApiKey || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,address_component,formatted_address&sessiontoken=${sessionToken}&key=${apiKey}`
    );
    const data = await res.json();
    if (data.status !== "OK" || !data.result?.geometry?.location) return null;

    const { geometry, address_components, formatted_address } = data.result;
    return {
        ...parseAddressComponents(address_components, formatted_address),
        latitude: geometry.location.lat,
        longitude: geometry.location.lng,
    };
};

const newSessionToken = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const fetchAddressFromCoordinates = async (latitude, longitude) => {
    try {
        const googleAddress = await fetchAddressFromGoogle(latitude, longitude);
        if (googleAddress?.location && !isPlusCode(googleAddress.location)) return googleAddress;
    } catch (error) {
        console.log("Google reverse geocode failed:", error);
    }

    try {
        const places = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (places?.length) {
            const parsed = parseReverseGeocode(places[0]);
            if ((parsed.location || parsed.city) && !isPlusCode(parsed.location)) return parsed;
        }
    } catch (error) {
        console.log("Native reverse geocode failed:", error);
    }
    return null;
};

const getDeviceCoordinates = async () => {
    try {
        return await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });
    } catch (error) {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown) return lastKnown;
        throw error;
    }
};

const DEFAULT_MAP_REGION = {
    latitude: 12.9716,
    longitude: 77.5946,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
};

/**
 * Full-screen Google Maps picker.
 * Opens centered on the device's current location with a "Continue" action to accept it,
 * plus a "Select custom location" action that switches into drag-the-map pin-drop mode
 * (a fixed center pin + panning map, rather than a draggable marker) since that gesture is
 * reliable at any zoom level and pairs naturally with reverse geocoding on region change.
 */
export default function LocationMapPicker({ visible, initialAddress, onClose, onConfirm, confirmLabel = "Continue" }) {
    const mapRef = useRef(null);
    const mountedRef = useRef(true);
    const geocodeRequestRef = useRef(0);
    const searchRequestRef = useRef(0);
    const searchDebounceRef = useRef(null);
    const searchSessionTokenRef = useRef(null);
    const [region, setRegion] = useState(DEFAULT_MAP_REGION);
    const [address, setAddress] = useState(null);
    const [loading, setLoading] = useState(false);
    const [locating, setLocating] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [mode, setMode] = useState("current"); // "current" | "custom"
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const resolveAddress = useCallback(async (nextRegion) => {
        const requestId = ++geocodeRequestRef.current;
        setLoading(true);
        try {
            const result = await fetchAddressFromCoordinates(nextRegion.latitude, nextRegion.longitude);
            if (mountedRef.current && requestId === geocodeRequestRef.current) setAddress(result);
        } catch (error) {
            console.log('[MAP PICKER] Reverse geocoding failed:', error);
            if (mountedRef.current && requestId === geocodeRequestRef.current) setAddress(null);
        } finally {
            if (mountedRef.current && requestId === geocodeRequestRef.current) setLoading(false);
        }
    }, []);

    const locateDevice = useCallback(async () => {
        try {
            const permission = await Location.requestForegroundPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert('Location permission', 'You can still choose a location by moving the map.');
                return null;
            }
            const current = await getDeviceCoordinates();
            return { ...DEFAULT_MAP_REGION, latitude: current.coords.latitude, longitude: current.coords.longitude };
        } catch (error) {
            console.log('[MAP PICKER] Current location unavailable:', error);
            return null;
        }
    }, []);

    useEffect(() => () => {
        mountedRef.current = false;
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    }, []);

    useEffect(() => {
        if (!visible) return;
        mountedRef.current = true;
        setMapReady(false);
        setMode("current");
        setAddress(initialAddress?.location ? initialAddress : null);
        setSearchQuery("");
        setSearchResults([]);
        setShowResults(false);
        searchSessionTokenRef.current = null;
        setLocating(true);

        (async () => {
            const nextRegion = await locateDevice();
            if (!mountedRef.current) return;
            setLocating(false);
            const regionToUse = nextRegion || DEFAULT_MAP_REGION;
            setRegion(regionToUse);
            if (nextRegion) mapRef.current?.animateToRegion(regionToUse, 350);
            resolveAddress(regionToUse);
        })();
    }, [visible, resolveAddress, initialAddress, locateDevice]);

    const handleRegionComplete = useCallback((nextRegion) => {
        setRegion(nextRegion);
        resolveAddress(nextRegion);
    }, [resolveAddress]);

    const handleUseCurrentLocation = useCallback(async () => {
        setLocating(true);
        const nextRegion = await locateDevice();
        setLocating(false);
        if (!nextRegion) return;
        setMode("current");
        setSearchQuery("");
        setSearchResults([]);
        setShowResults(false);
        setRegion(nextRegion);
        mapRef.current?.animateToRegion(nextRegion, 350);
        resolveAddress(nextRegion);
    }, [locateDevice, resolveAddress]);

    const handleSearchChange = useCallback((text) => {
        setSearchQuery(text);
        setShowResults(true);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

        if (!text.trim()) {
            setSearchResults([]);
            setSearching(false);
            return;
        }
        if (!searchSessionTokenRef.current) searchSessionTokenRef.current = newSessionToken();

        searchDebounceRef.current = setTimeout(async () => {
            const requestId = ++searchRequestRef.current;
            setSearching(true);
            try {
                const predictions = await fetchPlacePredictions(text, searchSessionTokenRef.current);
                if (mountedRef.current && requestId === searchRequestRef.current) setSearchResults(predictions);
            } catch (error) {
                console.log('[MAP PICKER] Place search failed:', error);
                if (mountedRef.current && requestId === searchRequestRef.current) setSearchResults([]);
            } finally {
                if (mountedRef.current && requestId === searchRequestRef.current) setSearching(false);
            }
        }, 350);
    }, []);

    const handleClearSearch = useCallback(() => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        setSearchQuery("");
        setSearchResults([]);
        setShowResults(false);
    }, []);

    const handleSelectPrediction = useCallback(async (prediction) => {
        Keyboard.dismiss();
        setShowResults(false);
        setSearchQuery(prediction.description);
        setMode("custom");
        setLoading(true);
        try {
            const details = await fetchPlaceDetails(prediction.place_id, searchSessionTokenRef.current);
            searchSessionTokenRef.current = null;
            if (!mountedRef.current || !details) return;
            const nextRegion = { ...DEFAULT_MAP_REGION, latitude: details.latitude, longitude: details.longitude };
            setRegion(nextRegion);
            mapRef.current?.animateToRegion(nextRegion, 350);
            setAddress(details);
        } catch (error) {
            console.log('[MAP PICKER] Place details failed:', error);
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, []);

    const confirmSelection = () => {
        onConfirm({ ...address, latitude: region.latitude, longitude: region.longitude });
    };

    const confirmDisabled = !mapReady || loading || !address?.location;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
            {/* A fullScreen Modal presents into its own native surface, so the
                app-root SafeAreaProvider's measured insets don't reliably reach
                it — nest a provider here so the SafeAreaViews below get real
                insets instead of falling back to 0 and sitting under the notch. */}
            <SafeAreaProvider>
            <View className="flex-1 bg-white">
                <MapView
                    ref={mapRef}
                    provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                    style={{ flex: 1 }}
                    initialRegion={DEFAULT_MAP_REGION}
                    onMapReady={() => setMapReady(true)}
                    onRegionChangeComplete={handleRegionComplete}
                    onPanDrag={() => setMode("custom")}
                    showsUserLocation
                    toolbarEnabled={false}
                    moveOnMarkerPress={false}
                />
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: '50%', alignItems: 'center', transform: [{ translateY: -38 }] }}>
                    <Ionicons name="location" size={44} color="#4A43EC" />
                    <View style={{ width: 8, height: 4, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.2)', marginTop: -4 }} />
                </View>

                <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="box-none">
                    <View className="flex-row items-center justify-between px-4 mt-2">
                        <TouchableOpacity onPress={onClose} className="w-11 h-11 rounded-full bg-white items-center justify-center shadow-lg">
                            <Ionicons name="close" size={24} color="#111827" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleUseCurrentLocation}
                            disabled={locating}
                            className="flex-row items-center bg-white rounded-full pl-3 pr-4 h-11 shadow-lg"
                        >
                            {locating ? (
                                <ActivityIndicator size="small" color="#4A43EC" />
                            ) : (
                                <Ionicons name="locate" size={18} color="#4A43EC" />
                            )}
                            <Text className="ml-2 text-[13px] font-lato-bold text-[#4A43EC]">Use current location</Text>
                        </TouchableOpacity>
                    </View>

                    {mode === "custom" && (
                        <View className="px-4 mt-3">
                            <View className="flex-row items-center bg-white rounded-2xl px-4 h-12 shadow-lg">
                                <Ionicons name="search" size={18} color="#9CA3AF" />
                                <TextInput
                                    value={searchQuery}
                                    onChangeText={handleSearchChange}
                                    onFocus={() => setShowResults(true)}
                                    placeholder="Search for area, street, landmark..."
                                    placeholderTextColor="#9CA3AF"
                                    className="flex-1 ml-2 text-[14px] text-black font-lato"
                                />
                                {searching ? (
                                    <ActivityIndicator size="small" color="#4A43EC" />
                                ) : searchQuery.length > 0 ? (
                                    <TouchableOpacity onPress={handleClearSearch}>
                                        <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            {showResults && searchQuery.length > 0 && (
                                <View className="bg-white rounded-2xl mt-2 shadow-lg overflow-hidden" style={{ maxHeight: 280 }}>
                                    {searchResults.length > 0 ? (
                                        <>
                                            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                                                {searchResults.map((item) => (
                                                    <TouchableOpacity
                                                        key={item.place_id}
                                                        onPress={() => handleSelectPrediction(item)}
                                                        className="flex-row items-start px-4 py-3 border-b border-gray-50"
                                                    >
                                                        <Ionicons name="location-outline" size={18} color="#9CA3AF" style={{ marginTop: 2 }} />
                                                        <View className="flex-1 ml-3">
                                                            <Text className="text-[14px] text-gray-900 font-lato-bold" numberOfLines={1}>
                                                                {item.structured_formatting?.main_text || item.description}
                                                            </Text>
                                                            {item.structured_formatting?.secondary_text ? (
                                                                <Text className="text-[12px] text-gray-500 font-lato" numberOfLines={1}>
                                                                    {item.structured_formatting.secondary_text}
                                                                </Text>
                                                            ) : null}
                                                        </View>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                            <View className="px-4 py-2 items-end bg-gray-50">
                                                <Text className="text-[10px] text-gray-400 font-lato">Powered by Google</Text>
                                            </View>
                                        </>
                                    ) : !searching ? (
                                        <Text className="px-4 py-3 text-[13px] text-gray-400 font-lato">No matching places found</Text>
                                    ) : null}
                                </View>
                            )}
                        </View>
                    )}
                </SafeAreaView>

                <SafeAreaView edges={['bottom']} className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl px-5 pt-5 pb-3 shadow-2xl">
                    <Text className="text-base font-lato-bold text-gray-900">
                        {mode === "custom" ? "Custom location" : "Your current location"}
                    </Text>
                    <View className="min-h-14 mt-2 flex-row items-center">
                        {loading ? <ActivityIndicator color="#4A43EC" /> : <Ionicons name="location-outline" size={21} color="#4A43EC" />}
                        <Text className="flex-1 ml-3 text-[13px] leading-5 text-gray-700 font-lato-medium">
                            {loading ? 'Finding address…' : address?.location || 'Move the map to pinpoint an address'}
                        </Text>
                    </View>

                    <TouchableOpacity
                        disabled={confirmDisabled}
                        onPress={confirmSelection}
                        className={`mt-3 rounded-2xl py-4 items-center ${confirmDisabled ? 'bg-indigo-300' : 'bg-[#4A43EC]'}`}
                    >
                        <Text className="text-white text-[15px] font-lato-bold">{confirmLabel}</Text>
                    </TouchableOpacity>

                    {mode === "custom" ? (
                        <Text className="mt-2.5 text-center text-[11px] text-gray-400 font-lato">
                            Drag the map to move the pin to your exact location
                        </Text>
                    ) : (
                        <TouchableOpacity
                            onPress={() => setMode("custom")}
                            className="mt-2.5 rounded-2xl py-3 items-center border border-gray-200"
                        >
                            <Text className="text-[#4A43EC] text-[14px] font-lato-bold">Select custom location</Text>
                        </TouchableOpacity>
                    )}
                </SafeAreaView>
            </View>
            </SafeAreaProvider>
        </Modal>
    );
}
