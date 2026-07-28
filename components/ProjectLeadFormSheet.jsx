import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    useAudioPlayer,
    useAudioPlayerStatus,
    useAudioRecorder,
    useAudioRecorderState,
} from "expo-audio";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Image,
    Modal,
    PanResponder,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch } from "react-redux";
import { addProject } from "../store/slices/projectsSlice";
import { fetchDashboard } from "../store/slices/dashboardSlice";
import { leadsAPI, projectMembersAPI } from "../services/api";

const { width } = Dimensions.get("window");

const steps = ["1 Info", "2 Location", "3 Stage", "4 Notes"];
const ANDROID_KEYBOARD_EXTRA_SCROLL = 72;
const ANDROID_KEYBOARD_EXTRA_HEIGHT = 240;
const IOS_KEYBOARD_EXTRA_SCROLL = 40;
const IOS_KEYBOARD_EXTRA_HEIGHT = 66;
const ANDROID_CONTENT_BOTTOM_PADDING = 180;
const IOS_CONTENT_BOTTOM_PADDING = 140;
const MAP_DELTA = 0.01;
const DEFAULT_MAP_REGION = {
    latitude: 22.7196,
    longitude: 75.8577,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
};
const mainTypes = [
    {
        id: "Residential",
        label: "Residential",
        image: require("../assets/icons/property-types/House2.png"),
        cloudImage: require("../assets/icons/property-types/Clouds.png"),
    },
    {
        id: "Commercial",
        label: "Commercial",
        image: require("../assets/icons/property-types/commercial.png"),
    },
];

const subTypesData = {
    Residential: [
        { id: "Plot", label: "Plot", image: require("../assets/icons/property-types/plot.png") },
        { id: "Villa", label: "Villa", image: require("../assets/icons/property-types/villa.png") },
        { id: "Apartment", label: "Apartment", image: require("../assets/icons/property-types/apartment.png") },
        { id: "Rowhouse", label: "Rowhouse", image: require("../assets/icons/property-types/rowhouse.png") },
    ],
    Commercial: [
        { id: "Shop", label: "Shop", image: require("../assets/icons/property-types/Shop.png") },
        { id: "Showroom", label: "Showroom", image: require("../assets/icons/property-types/showroom.png") },
        { id: "Office", label: "Office", image: require("../assets/icons/property-types/office.png") },
    ],
};

const subTypeOptions = {
    Rowhouse: ["1bhk", "2bhk", "3bhk", "4bhk", "5+bhk"],
    Apartment: ["1bhk", "2bhk", "3bhk", "4bhk", "5+bhk"],
    Office: ["Ready to move", "Co-working", "Bare shell"],
};
const leadStages = ["New Lead"];
const interactionTypes = ["Call", "Site Visit", "Office Visit", "Reference"];
const priorities = ["Hot", "Warm", "Cold"];
const followUpTimeOptions = [
    "09:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "02:00 PM",
    "03:00 PM",
    "04:00 PM",
    "05:00 PM",
    "06:00 PM",
];

function formatDuration(durationMillis = 0) {
    const totalSeconds = Math.max(0, Math.floor(durationMillis / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, "0");

    return `${minutes}:${seconds}`;
}

function formatFollowUpDate(date) {
    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function getFollowUpDateLabel(date, index) {
    if (index === 0) return "Today";
    if (index === 1) return "Tomorrow";

    return date.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
    });
}

function createProjectId(projectName) {
    const slug = projectName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    return `${slug || "project"}-${Date.now()}`;
}

function formatAddedDate(date) {
    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function resetLeadForm() {
    return {
        projectName: "",
        builderName: "",
        contactPerson: "",
        mobile: "",
        city: "",
        area: "",
        colony: "",
        fullAddress: "",
        state: "",
        pincode: "",
        builderNotes: "",
        followUpDate: "",
        followUpISO: null,
    };
}

function getRegionFromCoordinate(coordinate, delta = MAP_DELTA) {
    return {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        latitudeDelta: delta,
        longitudeDelta: delta,
    };
}

function compactAddressParts(parts) {
    const normalized = [];

    parts.forEach((part) => {
        const value = typeof part === "string" ? part.trim() : "";

        if (value && !normalized.some((item) => item.toLowerCase() === value.toLowerCase())) {
            normalized.push(value);
        }
    });

    return normalized.join(", ");
}

function firstDifferentAddressPart(parts, usedParts = []) {
    const used = usedParts
        .filter(Boolean)
        .map((part) => part.trim().toLowerCase());

    return (
        parts.find((part) => {
            const value = typeof part === "string" ? part.trim() : "";

            return value && !used.includes(value.toLowerCase());
        }) || ""
    );
}

function formatReverseGeocodedAddress(address) {
    if (!address) return "";

    return compactAddressParts([
        address.name,
        address.streetNumber && address.street
            ? `${address.streetNumber} ${address.street}`
            : address.street,
        address.district,
        address.city,
        address.subregion,
        address.region,
        address.postalCode,
        address.country,
    ]);
}

function formatCoordinateAddress(coordinate) {
    return `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`;
}

function getStreetAddress(address) {
    if (!address) return "";

    return address.streetNumber && address.street
        ? `${address.streetNumber} ${address.street}`
        : address.street || "";
}

function getLocationFieldsFromAddress(address, coordinate) {
    const city = firstDifferentAddressPart([
        address?.city,
        address?.subregion,
        address?.district,
        address?.region,
    ]);
    const area = firstDifferentAddressPart([
        address?.district,
        address?.street,
        address?.subregion,
        address?.city,
    ], [city]);
    const colony = compactAddressParts([
        firstDifferentAddressPart([
            address?.name,
            getStreetAddress(address),
            address?.district,
            address?.subregion,
        ], [city, area]),
        area,
    ]);
    const fullAddress = formatReverseGeocodedAddress(address) || formatCoordinateAddress(coordinate);
    const state = address?.region || "";
    const pincode = address?.postalCode || "";

    return {
        city,
        area,
        colony,
        fullAddress,
        state,
        pincode,
    };
}

function Field({ label, placeholder, value, onChangeText, keyboardType, containerClassName = "" }) {
    return (
        <View className={containerClassName}>
            <Text className="mb-1.5 text-xs font-lato-bold text-black">{label}</Text>
            <View className="h-12 justify-center rounded-xl border border-gray-200 bg-white px-4">
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                    keyboardType={keyboardType}
                    className="text-[13px] font-lato text-gray-800"
                    style={{ paddingVertical: 0, textAlignVertical: "center", includeFontPadding: false }}
                />
            </View>
        </View>
    );
}

function Chip({ label, active, onPress }) {
    return (
        <TouchableOpacity
            activeOpacity={0.82}
            onPress={onPress}
            className={`mb-2 mr-2 h-9 items-center justify-center rounded-full px-4 ${
                active ? "bg-[#4A43EC]" : "border border-gray-200 bg-white"
            }`}
            style={{
                borderRadius: 9999,
                outlineWidth: 0,
                ...(active ? {
                    shadowColor: "#4A43EC",
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.14,
                    shadowRadius: 6,
                    elevation: 2,
                } : {})
            }}
        >
            <Text className={`text-xs font-lato-bold ${active ? "text-white" : "text-gray-600"}`}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

function CategoryImageCard({ item, active, onPress }) {
    return (
        <TouchableOpacity
            activeOpacity={0.82}
            onPress={onPress}
            className="relative mb-3 overflow-hidden rounded-xl border bg-white"
            style={{
                borderColor: active ? "#4A43EC" : "#F3F4F6",
                backgroundColor: active ? "#F4F7FF" : "#FFFFFF",
                width: (width - 50) / 2,
                height: 96,
                shadowColor: "#111827",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 1,
            }}
        >
            <Text className="absolute left-2.5 top-2 z-10 text-[10px] font-lato-bold text-black" numberOfLines={1}>
                {item.label}
            </Text>
            <View className="flex-1 items-end justify-end">
                <Image
                    source={item.image}
                    className="h-[70%] w-[80%]"
                    resizeMode="contain"
                />
            </View>
        </TouchableOpacity>
    );
}

function TypeImageCard({ item, active, onPress }) {
    return (
        <TouchableOpacity
            activeOpacity={0.82}
            onPress={onPress}
            className="mb-3 mr-3 items-center overflow-hidden rounded-lg border bg-white"
            style={{
                borderColor: active ? "#4A43EC" : "#F3F4F6",
                backgroundColor: active ? "#F4F7FF" : "#FFFFFF",
                width: width * 0.22,
                height: 80,
                shadowColor: "#111827",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 1,
            }}
        >
            <Text
                className={`mb-0.5 mt-1.5 text-[9px] font-lato-bold ${
                    active ? "text-[#4A43EC]" : "text-black"
                }`}
                numberOfLines={1}
            >
                {item.label}
            </Text>
            <View className="w-full flex-1 justify-end">
                <Image source={item.image} className="h-[60%] w-full" resizeMode="contain" />
            </View>
        </TouchableOpacity>
    );
}

function SubTypeDropdown({ propertyType, subType, open, onToggle, onSelect }) {
    if (!propertyType || !subTypeOptions[propertyType]) return null;

    return (
        <View>
            <Text className="mb-1.5 text-xs font-lato-bold text-black">Configuration / Status</Text>
            <Pressable
                onPress={onToggle}
                className="h-12 flex-row items-center rounded-xl border border-gray-200 px-4"
            >
                <Text className={`flex-1 text-[13px] ${subType ? "text-gray-900" : "text-gray-400"}`}>
                    {subType || "Select option"}
                </Text>
                <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color="#6B7280" />
            </Pressable>
            {open && (
                <View
                    className="mb-1 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white"
                    style={{
                        elevation: 3,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                    }}
                >
                    {subTypeOptions[propertyType].map((option, index) => (
                        <Pressable
                            key={option}
                            onPress={() => onSelect(option)}
                            className={`px-4 py-3 ${
                                index < subTypeOptions[propertyType].length - 1 ? "border-b border-gray-100" : ""
                            }`}
                        >
                            <Text className="text-[13px] text-gray-800">{option}</Text>
                        </Pressable>
                    ))}
                </View>
            )}
        </View>
    );
}

function RadioOption({ label, selected, onPress }) {
    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            className={`mb-3 h-12 flex-row items-center rounded-xl border px-4 ${
                selected ? "border-[#4A43EC] bg-[#F4F7FF]" : "border-gray-200 bg-white"
            }`}
        >
            <View
                className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
                    selected ? "border-[#4A43EC]" : "border-[#D1D5DB]"
                }`}
            >
                {selected && <View className="h-2.5 w-2.5 rounded-full bg-[#4A43EC]" />}
            </View>
            <Text className={`ml-3 text-[13px] font-lato-bold ${selected ? "text-[#4A43EC]" : "text-gray-800"}`}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

function PriorityChip({ label, active, onPress }) {
    const colors = {
        Hot: { border: "#EF4444", text: "#EF4444", bg: "#FEE2E2" },
        Warm: { border: "#F97316", text: "#F97316", bg: "#FFEDD5" },
        Cold: { border: "#6B7280", text: "#6B7280", bg: "#F3F4F6" },
    };
    const style = colors[label] || colors.Cold;

    return (
        <TouchableOpacity
            activeOpacity={0.82}
            onPress={onPress}
            className="h-10 flex-1 items-center justify-center rounded-xl border"
            style={{
                borderColor: active ? style.border : "#E5E7EB",
                backgroundColor: active ? style.bg : "#FFFFFF",
            }}
        >
            <Text
                className="text-[13px] font-lato-bold"
                style={{ color: active ? style.text : "#9CA3AF" }}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}

export default function ProjectLeadFormSheet({ visible, translateY, screenHeight, onClose }) {
    const dispatch = useDispatch();
    const [currentStep, setCurrentStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [searchModalVisible, setSearchModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    const handleSearchDeveloper = async (text) => {
        setSearchQuery(text);
        if (!text.trim()) {
            setSearchResults([]);
            return;
        }
        try {
            setSearching(true);
            const res = await projectMembersAPI.getAssignableUsers("project_developer", text);
            setSearchResults(res.data?.data || []);
        } catch (err) {
            console.log("Error searching users:", err?.response?.data || err.message);
        } finally {
            setSearching(false);
        }
    };

    const handleSelectDeveloper = (user) => {
        setForm((prev) => ({
            ...prev,
            contactPerson: `${user.first_name} ${user.last_name || ""}`.trim(),
            mobile: (user.phone || "").replace(/^\+91/, ""),
        }));
        setSearchModalVisible(false);
        setSearchQuery("");
        setSearchResults([]);
    };
    const scrollRef = useRef(null);
    const [form, setForm] = useState(resetLeadForm);
    const [category, setCategory] = useState("Residential");
    const [projectType, setProjectType] = useState("");
    const [subType, setSubType] = useState("");
    const [selectedTypes, setSelectedTypes] = useState([]);
    const [showSubTypeDropdown, setShowSubTypeDropdown] = useState(false);
    const [leadStage, setLeadStage] = useState("New Lead");
    const [interactionType, setInteractionType] = useState("Call");
    const [priority, setPriority] = useState("Hot");
    const [voiceNoteUri, setVoiceNoteUri] = useState(null);
    const [voiceNoteDuration, setVoiceNoteDuration] = useState(0);
    const [followUpPickerOpen, setFollowUpPickerOpen] = useState(false);
    const [followUpPickerStep, setFollowUpPickerStep] = useState("date");
    const [selectedFollowUpDate, setSelectedFollowUpDate] = useState(null);
    const [mapPickerVisible, setMapPickerVisible] = useState(false);
    const [mapRegion, setMapRegion] = useState(DEFAULT_MAP_REGION);
    const [pickedCoordinate, setPickedCoordinate] = useState(null);
    const [locatingMap, setLocatingMap] = useState(false);
    const [resolvingAddress, setResolvingAddress] = useState(false);
    const [mapInteracting, setMapInteracting] = useState(false);
    const [mapMessage, setMapMessage] = useState("");
    const mapRef = useRef(null);
    const mapResolveRequestRef = useRef(0);
    const visibleProjectTypes = subTypesData[category] ?? [];
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recorderState = useAudioRecorderState(audioRecorder, 250);
    const voicePlayer = useAudioPlayer(voiceNoteUri ? { uri: voiceNoteUri } : null, {
        updateInterval: 250,
    });
    const voicePlayerStatus = useAudioPlayerStatus(voicePlayer);
    const isRecordingVoiceNote = recorderState.isRecording;
    const isPlayingVoiceNote = voicePlayerStatus.playing;
    const followUpDateOptions = useMemo(
        () =>
            Array.from({ length: 10 }, (_, index) => {
                const date = new Date();
                date.setDate(date.getDate() + index);

                return {
                    id: date.toISOString(),
                    label: getFollowUpDateLabel(date, index),
                    value: formatFollowUpDate(date),
                };
            }),
        []
    );

    const [inlineSuggestions, setInlineSuggestions] = useState([]);

    const handlePhoneChange = async (val) => {
        setField("mobile")(val);
        const digits = val.replace(/\D/g, "");
        if (digits.length < 3) {
            setInlineSuggestions([]);
            return;
        }
        try {
            const res = await projectMembersAPI.getAssignableUsers("project_developer", digits);
            setInlineSuggestions(res.data?.data || []);
        } catch (err) {
            console.log("Error querying inline suggestions:", err.message);
        }
    };

    const setField = (field) => (value) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const centerMapOnCoordinate = (coordinate) => {
        const nextRegion = getRegionFromCoordinate(coordinate);

        setMapRegion(nextRegion);
        mapRef.current?.animateToRegion?.(nextRegion, 300);
    };

    const updateAddressFromCoordinate = async (coordinate) => {
        const requestId = mapResolveRequestRef.current + 1;

        mapResolveRequestRef.current = requestId;
        setResolvingAddress(true);
        setMapMessage("Fetching accurate address for selected location...");

        try {
            const [address] = await Location.reverseGeocodeAsync(coordinate);
            const locationFields = getLocationFieldsFromAddress(address, coordinate);

            if (requestId !== mapResolveRequestRef.current) return;

            setForm((current) => ({
                ...current,
                city: locationFields.city || current.city,
                area: locationFields.area || current.area,
                colony: locationFields.colony || current.colony,
                fullAddress: locationFields.fullAddress,
                state: locationFields.state || current.state,
                pincode: locationFields.pincode || current.pincode,
            }));
            setMapMessage("Location fields updated from the selected map point.");
        } catch {
            if (requestId !== mapResolveRequestRef.current) return;

            const coordinateAddress = formatCoordinateAddress(coordinate);

            setForm((current) => ({ ...current, fullAddress: coordinateAddress }));
            setMapMessage("Could not fetch address, so coordinates were added.");
        } finally {
            if (requestId === mapResolveRequestRef.current) {
                setResolvingAddress(false);
            }
        }
    };

    const selectMapCoordinate = (coordinate, shouldAnimate = true) => {
        setPickedCoordinate(coordinate);

        if (shouldAnimate) {
            centerMapOnCoordinate(coordinate);
        }

        updateAddressFromCoordinate(coordinate);
    };

    const getCurrentCoordinate = async () => {
        setLocatingMap(true);

        try {
            const permission = await Location.requestForegroundPermissionsAsync();

            if (!permission.granted) {
                setMapMessage("Location permission denied. Tap the map to choose manually.");
                return null;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            return {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };
        } catch {
            setMapMessage("Could not detect current location. Tap the map to choose manually.");
            return null;
        } finally {
            setLocatingMap(false);
        }
    };

    const openLocationPicker = async () => {
        const shouldUseCurrentLocation = mapPickerVisible;

        setMapPickerVisible(true);
        setMapMessage("");

        if (Platform.OS === "web") {
            setMapMessage("Map picking is available on Android or iOS.");
            return;
        }

        if (shouldUseCurrentLocation) {
            const coordinate = await getCurrentCoordinate();

            if (coordinate) {
                selectMapCoordinate(coordinate);
            }

            return;
        }

        if (pickedCoordinate) {
            centerMapOnCoordinate(pickedCoordinate);
            return;
        }

        const coordinate = await getCurrentCoordinate();

        if (coordinate) {
            selectMapCoordinate(coordinate);
        }
    };

    const handleMapRegionChange = () => {
        if (resolvingAddress) return;

        setMapMessage("Release the map to pick the location under the pin.");
    };

    const handleMapRegionChangeComplete = (region) => {
        const coordinate = {
            latitude: region.latitude,
            longitude: region.longitude,
        };

        setMapRegion(region);
        selectMapCoordinate(coordinate, false);
        setMapInteracting(false);
    };

    const selectCategory = (nextCategory) => {
        setCategory(nextCategory);
        setProjectType("");
        setSubType("");
        setShowSubTypeDropdown(false);
    };

    const selectProjectType = (nextProjectType) => {
        setProjectType(nextProjectType);
        setSubType("");
        setShowSubTypeDropdown(false);
    };

    const selectSubType = (nextSubType) => {
        setSubType(nextSubType);
        setShowSubTypeDropdown(false);
    };

    const selectFollowUpDate = (dateOption) => {
        setSelectedFollowUpDate(dateOption);
        setFollowUpPickerStep("time");
    };

    const selectFollowUpTime = (timeOption) => {
        if (!selectedFollowUpDate) return;

        // Parse the ISO date from selectedFollowUpDate.id and apply the selected time
        const base = new Date(selectedFollowUpDate.id);
        const [time, meridiem] = timeOption.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (meridiem === 'PM' && hours !== 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;
        base.setHours(hours, minutes, 0, 0);

        setForm((current) => ({
            ...current,
            followUpDate: `${selectedFollowUpDate.value}, ${timeOption}`,
            followUpISO: base.toISOString(),
        }));
        setFollowUpPickerOpen(false);
        setFollowUpPickerStep("date");
    };

    const toggleFollowUpPicker = () => {
        setFollowUpPickerOpen((open) => {
            if (!open) {
                setFollowUpPickerStep("date");
            }

            return !open;
        });
    };

    const handleAddPropertyType = () => {
        if (!category || !projectType) return;

        const exists = selectedTypes.find(
            (t) => t.category === category && t.projectType === projectType && t.subType === subType
        );
        if (exists) {
            Alert.alert("Already added", "This property type combination is already added.");
            return;
        }

        setSelectedTypes((prev) => [
            ...prev,
            {
                id: Date.now().toString(),
                category,
                projectType,
                subType,
            },
        ]);
        setProjectType("");
        setSubType("");
    };

    const nextStep = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleClose = () => {
        setCurrentStep(0);
        onClose();
    };

    const handleSave = async () => {
        const now = new Date();
        const projectName = form.projectName.trim();
        const developerName = form.builderName.trim();
        const phoneNumber = form.mobile.trim();

        if (!projectName || !developerName || !phoneNumber) {
            Alert.alert("Missing details", "Project name, builder name, and mobile number are required.");
            return;
        }

        if (selectedTypes.length === 0) {
            Alert.alert("Missing property type", "Please add at least one property type configuration.");
            return;
        }

        // Use pre-computed ISO string set during time selection
        const scheduled_time = form.followUpISO || null;

        const property_types = selectedTypes.map((t) => ({
            main_type: t.category,
            sub_type: t.projectType,
            configuration: t.subType || null,
        }));
        const primaryType = selectedTypes[0] || {};

        const payload = {
            project_name: projectName,
            builder_name: developerName,
            contact_person: form.contactPerson.trim() || null,
            contact_number: phoneNumber,
            property_category: primaryType.category || null,
            property_subtype: primaryType.projectType || null,
            configuration: primaryType.subType || null,
            property_types,
            city: form.city.trim() || null,
            area: form.area.trim() || null,
            colony_landmark: form.colony.trim() || null,
            full_address: form.fullAddress.trim() || null,
            state: form.state.trim() || null,
            pincode: form.pincode.trim() || null,
            stage: 'new_lead',
            interaction_type: interactionType || null,
            remarks: form.builderNotes.trim() || null,
            scheduled_time,
            lead_temperature: priority.toLowerCase(),
            voice_note_url: voiceNoteUri || null,
        };

        try {
            setSaving(true);
            const response = await leadsAPI.createLead(payload);

            // Optimistic local Redux update for instant UI
            const newFollowUpId = String(Date.now());
            const localFollowUps = scheduled_time ? [
                {
                    id: newFollowUpId,
                    projectId: response.data?.id?.toString() || createProjectId(projectName),
                    time: new Date(scheduled_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
                    note: form.builderNotes.trim() || 'Initial follow-up scheduled.',
                    status: priority,
                    tone: priority.toLowerCase() === "hot" ? "hot" : "warning",
                    isDone: false,
                    voice_note_url: voiceNoteUri || null,
                    site_photo_url: null,
                    meta: {
                        followUpType: (interactionType && ['Call', 'Site Visit', 'Office Visit', 'Reference'].includes(interactionType))
                            ? interactionType.toLowerCase().replace(' ', '_')
                            : 'call',
                        outcome: 'connected',
                        followUpStatus: priority.toLowerCase(),
                        nextAction: 'schedule_another_call',
                        nextFollowUpAt: scheduled_time,
                    }
                }
            ] : [];

            dispatch(
                addProject({
                    id: response.data?.id?.toString() || createProjectId(projectName),
                    projectName,
                    developerName,
                    contactPerson: form.contactPerson.trim(),
                    phoneNumber,
                    city: form.city.trim(),
                    location: form.area.trim(),
                    area: form.area.trim(),
                    colony: form.colony.trim(),
                    fullAddress: form.fullAddress.trim(),
                    state: form.state.trim(),
                    pincode: form.pincode.trim(),
                    category: primaryType.category || "",
                    projectType: selectedTypes.map(t => [t.category, t.projectType, t.subType].filter(Boolean).join(" - ")).join(" | "),
                    type: priority,
                    status: "New Lead",
                    statusType: "newLead",
                    nextAction: "Call builder",
                    lastContact: "Not contacted",
                    addedOn: formatAddedDate(now),
                    createdAt: now.toISOString(),
                    leadStage,
                    interactionType,
                    builderNotes: form.builderNotes.trim(),
                    plannedFollowUpAt: form.followUpDate,
                    voiceNoteUri,
                    voiceNoteDuration,
                    journeyStage: "New Lead Added",
                    followUps: localFollowUps,
                    meetings: [],
                }),
            );

            // Refresh dashboard metrics
            dispatch(fetchDashboard());

            // Reset form
            setForm(resetLeadForm());
            setCategory("Residential");
            setProjectType("");
            setSubType("");
            setSelectedTypes([]);
            setLeadStage("New Lead");
            setInteractionType("Call");
            setPriority("Hot");
            setVoiceNoteUri(null);
            setVoiceNoteDuration(0);
            setMapPickerVisible(false);
            setMapRegion(DEFAULT_MAP_REGION);
            setPickedCoordinate(null);
            setMapInteracting(false);
            setMapMessage("");
            handleClose();
        } catch (error) {
            Alert.alert(
                "Failed to save",
                error.response?.data?.message || "Could not create lead. Please try again.",
            );
        } finally {
            setSaving(false);
        }
    };

    const startVoiceRecording = async () => {
        try {
            const permission = await requestRecordingPermissionsAsync();

            if (!permission.granted) {
                Alert.alert("Microphone permission needed", "Please allow microphone access to record a voice note.");
                return;
            }

            if (isPlayingVoiceNote) {
                voicePlayer.pause();
            }

            setVoiceNoteUri(null);
            setVoiceNoteDuration(0);
            await setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true,
            });
            await audioRecorder.prepareToRecordAsync();
            audioRecorder.record();
        } catch {
            Alert.alert("Recording failed", "Could not start voice recording. Please try again.");
        }
    };

    const stopVoiceRecording = async () => {
        try {
            const duration = recorderState.durationMillis;

            await audioRecorder.stop();
            await setAudioModeAsync({
                allowsRecording: false,
                playsInSilentMode: true,
            });

            const uri = audioRecorder.uri || recorderState.url;
            if (uri) {
                setVoiceNoteUri(uri);
                setVoiceNoteDuration(duration);
            }
        } catch {
            Alert.alert("Recording failed", "Could not save the voice note. Please try again.");
        }
    };

    const toggleVoiceRecording = () => {
        if (isRecordingVoiceNote) {
            stopVoiceRecording();
            return;
        }

        startVoiceRecording();
    };

    const toggleVoicePlayback = async () => {
        if (!voiceNoteUri) return;

        if (isPlayingVoiceNote) {
            voicePlayer.pause();
            return;
        }

        await voicePlayer.seekTo(0);
        voicePlayer.play();
    };

    const deleteVoiceNote = () => {
        if (isPlayingVoiceNote) {
            voicePlayer.pause();
        }

        setVoiceNoteUri(null);
        setVoiceNoteDuration(0);
    };

    useEffect(() => {
        if (voicePlayerStatus.didJustFinish) {
            voicePlayer.seekTo(0);
        }
    }, [voicePlayer, voicePlayerStatus.didJustFinish]);

    useEffect(() => {
        scrollRef.current?.scrollToPosition?.(0, 0, false);
        scrollRef.current?.scrollTo?.({ y: 0, animated: false });
    }, [currentStep]);

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 8,
                onPanResponderMove: (_, gestureState) => {
                    translateY.setValue(Math.max(0, gestureState.dy));
                },
                onPanResponderRelease: (_, gestureState) => {
                    if (gestureState.dy > 135 || gestureState.vy > 1.1) {
                        onClose();
                        return;
                    }

                    Animated.spring(translateY, {
                        toValue: 0,
                        useNativeDriver: true,
                        damping: 24,
                        stiffness: 190,
                    }).start();
                },
            }),
        [onClose, translateY]
    );

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="none"
            transparent={true}
            onRequestClose={handleClose}
        >
            <Animated.View
                className="absolute inset-0 z-50 bg-[#F8F9FE]"
                style={{
                    transform: [{ translateY }],
                    minHeight: screenHeight,
                }}
            >
            <StatusBar barStyle="light-content" />
            <View className="flex-1">
                <SafeAreaView className="bg-[#4A43EC]" edges={["top"]}>
                    <View className="bg-[#4A43EC] px-5 pb-8" {...panResponder.panHandlers}>
                        <View className="mt-2 mb-8 flex-row items-center justify-between">
                            <TouchableOpacity
                                activeOpacity={0.78}
                                onPress={handleClose}
                                className="p-1"
                            >
                                <Ionicons name="arrow-back" size={20} color="white" />
                            </TouchableOpacity>
                            <Text className="flex-1 text-center text-base font-lato-bold text-white">
                                Add New Project Lead
                            </Text>
                            <View style={{ width: 20 }} />
                        </View>

                        <View className="mt-2 flex-row items-start justify-between">
                            {steps.map((step, index) => {
                                const active = index === currentStep;

                                return (
                                    <View
                                        key={step}
                                        className="items-center"
                                        style={{ width: (width - 40) / steps.length }}
                                    >
                                        <View
                                            className={`mb-1.5 h-7 w-7 items-center justify-center rounded-full ${
                                                active ? "bg-white" : "border border-white/40 bg-transparent"
                                            }`}
                                        >
                                            <Text
                                                className={`text-xs font-lato-bold ${
                                                    active ? "text-[#4A43EC]" : "text-white/60"
                                                }`}
                                            >
                                                {index + 1}
                                            </Text>
                                        </View>
                                        <Text
                                            className={`text-center text-[8px] font-lato ${
                                                active ? "text-white" : "text-white/60"
                                            }`}
                                            numberOfLines={1}
                                        >
                                            {step.replace(/^\d\s*/, "")}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                </SafeAreaView>

                <View className="-mt-5 flex-1 overflow-hidden rounded-t-[20px] bg-white">
                    <KeyboardAwareScrollView
                        innerRef={(ref) => {
                            scrollRef.current = ref;
                        }}
                        className="flex-1 px-5 pt-6"
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{
                            paddingBottom:
                                Platform.OS === "android"
                                    ? ANDROID_CONTENT_BOTTOM_PADDING
                                    : IOS_CONTENT_BOTTOM_PADDING,
                            flexGrow: 1,
                        }}
                        keyboardShouldPersistTaps="always"
                        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                        enableOnAndroid
                        extraScrollHeight={
                            Platform.OS === "android" ? ANDROID_KEYBOARD_EXTRA_SCROLL : IOS_KEYBOARD_EXTRA_SCROLL
                        }
                        extraHeight={
                            Platform.OS === "android" ? ANDROID_KEYBOARD_EXTRA_HEIGHT : IOS_KEYBOARD_EXTRA_HEIGHT
                        }
                        viewIsInsideTabBar={Platform.OS === "android"}
                        enableAutomaticScroll
                        keyboardOpeningTime={Platform.OS === "android" ? 0 : 250}
                        enableResetScrollToCoords={false}
                        nestedScrollEnabled={Platform.OS === "android"}
                        scrollEnabled={!mapInteracting}
                    >
                    {/* Step 1: Basic Project Info */}
                    {currentStep === 0 && (
                        <View className="gap-6">
                            <Text className="text-base font-lato-bold text-black">
                                Step 1: Basic Project Info
                            </Text>

                            <Field
                                label="Project Name *"
                                placeholder="e.g. Skyline Residency"
                                value={form.projectName}
                                onChangeText={setField("projectName")}
                                containerClassName="mb-4"
                            />

                            <Field
                                label="Builder / Developer Name *"
                                placeholder="e.g. Shree Developers"
                                value={form.builderName}
                                onChangeText={setField("builderName")}
                                containerClassName="mb-4"
                            />

                            <View className="mb-4">
                                <View className="flex-row justify-between items-center mb-1.5">
                                    <Text className="text-xs font-lato-bold text-black">Contact Person</Text>
                                    <TouchableOpacity
                                        onPress={() => setSearchModalVisible(true)}
                                        activeOpacity={0.7}
                                        className="flex-row items-center"
                                    >
                                        <Ionicons name="search" size={11} color="#4A43EC" style={{ marginRight: 2 }} />
                                        <Text className="text-[11px] font-lato-bold text-[#4A43EC]">Select Existing Developer</Text>
                                    </TouchableOpacity>
                                </View>
                                <View className="h-12 justify-center rounded-xl border border-gray-200 bg-white px-4">
                                    <TextInput
                                        value={form.contactPerson}
                                        onChangeText={setField("contactPerson")}
                                        placeholder="Name"
                                        placeholderTextColor="#9CA3AF"
                                        className="text-[13px] font-lato text-gray-800"
                                        style={{ paddingVertical: 0, textAlignVertical: "center", includeFontPadding: false }}
                                    />
                                </View>
                            </View>

                            <View className="mb-4">
                                <Text className="mb-1.5 text-xs font-lato-bold text-black">Mobile *</Text>
                                <View className="h-12 justify-center rounded-xl border border-gray-200 bg-white px-4">
                                    <TextInput
                                        value={form.mobile}
                                        onChangeText={handlePhoneChange}
                                        placeholder="+91 98765 43210"
                                        placeholderTextColor="#9CA3AF"
                                        keyboardType="phone-pad"
                                        className="text-[13px] font-lato text-gray-800"
                                        style={{ paddingVertical: 0, textAlignVertical: "center", includeFontPadding: false }}
                                    />
                                </View>

                                {inlineSuggestions.length > 0 && (
                                    <View className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl mt-2 p-2 gap-2">
                                        <Text className="text-[10px] font-lato-bold text-[#64748B] px-1">Found existing developer(s):</Text>
                                        {inlineSuggestions.map((user) => (
                                            <TouchableOpacity
                                                key={user.id}
                                                activeOpacity={0.7}
                                                onPress={() => {
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        contactPerson: `${user.first_name} ${user.last_name || ""}`.trim(),
                                                        mobile: (user.phone || "").replace(/^\+91/, ""),
                                                    }));
                                                    setInlineSuggestions([]);
                                                }}
                                                className="flex-row justify-between items-center bg-white border border-[#E2E8F0] rounded-lg p-2.5"
                                            >
                                                <View className="flex-1 mr-2">
                                                    <Text className="text-[12px] font-lato-bold text-black">{user.first_name} {user.last_name || ""}</Text>
                                                    <Text className="text-[10px] text-[#64748B] mt-0.5">{user.phone}</Text>
                                                </View>
                                                <View className="bg-[#4A43EC]/10 px-2 py-1 rounded">
                                                    <Text className="text-[10px] font-lato-bold text-[#4A43EC]">Use</Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            {/* Selected property types list */}
                            {selectedTypes.length > 0 && (
                                <View className="mb-2">
                                    <Text className="text-xs font-lato-bold text-black mb-2">Added Property Types ({selectedTypes.length})</Text>
                                    {selectedTypes.map((item) => {
                                        const typeIcon = subTypesData[item.category]?.find(t => t.id === item.projectType)?.image;
                                        return (
                                            <View key={item.id} className="bg-[#F8F9FE] border border-gray-100 rounded-xl px-4 py-2.5 flex-row justify-between items-center mb-2">
                                                <View className="flex-row items-center flex-1">
                                                    <View className="w-10 h-10 bg-white rounded-xl items-center justify-center mr-3 border border-gray-50">
                                                        {typeIcon && <Image source={typeIcon} className="w-6 h-6" resizeMode="contain" />}
                                                    </View>
                                                    <View className="justify-center">
                                                        <Text className="font-lato-bold text-black text-[12px] leading-tight">
                                                            {item.projectType} {item.subType ? `(${item.subType})` : ''}
                                                        </Text>
                                                        <Text className="text-[10px] text-[#4A43EC] font-lato-bold uppercase mt-0.5 leading-tight">
                                                            {item.category}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <TouchableOpacity onPress={() => setSelectedTypes(prev => prev.filter(t => t.id !== item.id))} className="p-1">
                                                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}

                            <Text className="text-xs font-lato-bold text-black">Property Category</Text>
                            <View className="flex-row justify-between">
                                {mainTypes.map((item) => (
                                    <CategoryImageCard
                                        key={item.id}
                                        item={item}
                                        active={category === item.id}
                                        onPress={() => selectCategory(item.id)}
                                    />
                                ))}
                            </View>

                            <Text className="text-sm font-lato-bold text-black">Property Type</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                className="flex-row"
                            >
                                {visibleProjectTypes.map((item) => (
                                    <TypeImageCard
                                        key={item.id}
                                        item={item}
                                        active={projectType === item.id}
                                        onPress={() => selectProjectType(item.id)}
                                    />
                                ))}
                            </ScrollView>

                            <SubTypeDropdown
                                propertyType={projectType}
                                subType={subType}
                                open={showSubTypeDropdown}
                                onToggle={() => setShowSubTypeDropdown((open) => !open)}
                                onSelect={selectSubType}
                            />

                            {Boolean(projectType && (!subTypeOptions[projectType] || subType)) && (
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={handleAddPropertyType}
                                    className="items-center justify-center rounded-xl bg-[#4A43EC]/10 border border-[#4A43EC]/20 py-3 mt-1 mb-2"
                                >
                                    <Text className="text-xs font-lato-bold text-[#4A43EC]">
                                        + Add Property Type
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                activeOpacity={0.86}
                                onPress={nextStep}
                                className="items-center rounded-xl bg-[#4A43EC] py-4"
                            >
                                <Text className="text-sm font-lato-bold text-white">
                                    Next: Location Info {"\u2192"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Step 2: Location Info */}
                    {currentStep === 1 && (
                        <View className="gap-6">
                            <Text className="text-base font-lato-bold text-black">
                                Step 2: Location Info
                            </Text>

                            <View className="mb-4 flex-row" style={{ columnGap: 10 }}>
                                <Field
                                    label="City"
                                    placeholder="Indore"
                                    value={form.city}
                                    onChangeText={setField("city")}
                                    containerClassName="flex-1"
                                />
                                <Field
                                    label="Area"
                                    placeholder="Vijay Nagar"
                                    value={form.area}
                                    onChangeText={setField("area")}
                                    containerClassName="flex-1"
                                />
                            </View>

                            <View className="mb-4 flex-row" style={{ columnGap: 10 }}>
                                <Field
                                    label="State"
                                    placeholder="Madhya Pradesh"
                                    value={form.state}
                                    onChangeText={setField("state")}
                                    containerClassName="flex-1"
                                />
                                <Field
                                    label="Pincode"
                                    placeholder="452010"
                                    value={form.pincode}
                                    onChangeText={setField("pincode")}
                                    containerClassName="flex-1"
                                    keyboardType="numeric"
                                />
                            </View>

                            <Field
                                label="Colony / Landmark"
                                placeholder="Near MR-9 Flyover"
                                value={form.colony}
                                onChangeText={setField("colony")}
                                containerClassName="mb-4"
                            />

                            <Field
                                label="Full Address"
                                placeholder="Enter full address"
                                value={form.fullAddress}
                                onChangeText={setField("fullAddress")}
                                containerClassName="mb-4"
                            />

                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={openLocationPicker}
                                disabled={locatingMap || resolvingAddress}
                                className="h-12 flex-row items-center justify-center rounded-2xl border border-dashed border-[#4A43EC]/30 bg-[#F4F7FF]"
                            >
                                <Ionicons
                                    name={mapPickerVisible ? "locate-outline" : "location-outline"}
                                    size={20}
                                    color="#4A43EC"
                                />
                                <Text className="ml-2 text-xs font-lato-bold text-[#4A43EC]">
                                    {locatingMap
                                        ? "Detecting Current Location..."
                                        : mapPickerVisible
                                          ? "Use Current Location"
                                          : "Pick Location on Map"}
                                </Text>
                            </TouchableOpacity>

                            {mapPickerVisible ? (
                                <View className="overflow-hidden rounded-2xl border border-gray-100 bg-[#F4F7FF]">
                                    {Platform.OS === "web" ? (
                                        <View className="h-[180px] items-center justify-center px-6">
                                            <Ionicons name="map-outline" size={42} color="#D1D5DB" />
                                            <Text className="mt-2 text-center text-[13px] text-[#9CA3AF]">
                                                Map picking is available on the mobile app.
                                            </Text>
                                        </View>
                                    ) : (
                                        <View className="relative">
                                            <MapView
                                                ref={mapRef}
                                                provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
                                                initialRegion={mapRegion}
                                                onRegionChange={handleMapRegionChange}
                                                onRegionChangeComplete={handleMapRegionChangeComplete}
                                                onTouchStart={() => setMapInteracting(true)}
                                                onTouchEnd={() => setMapInteracting(false)}
                                                onTouchCancel={() => setMapInteracting(false)}
                                                loadingEnabled
                                                pitchEnabled={false}
                                                rotateEnabled={false}
                                                style={{ height: 240, width: "100%" }}
                                                showsUserLocation
                                                showsMyLocationButton
                                            />
                                            <View
                                                pointerEvents="none"
                                                className="absolute inset-0 items-center justify-center"
                                            >
                                                <View className="mb-7 h-11 w-11 items-center justify-center rounded-full bg-white shadow">
                                                    {resolvingAddress ? (
                                                        <ActivityIndicator color="#4A43EC" size="small" />
                                                    ) : (
                                                        <Ionicons name="location-sharp" size={30} color="#4A43EC" />
                                                    )}
                                                </View>
                                                <View className="h-2 w-2 rounded-full bg-[#4A43EC]/25" />
                                            </View>
                                        </View>
                                    )}

                                    <View className="px-4 py-3">
                                        <Text className="text-[11px] font-lato text-gray-500">
                                            {resolvingAddress
                                                ? "Getting address..."
                                                : mapMessage || "Move the map to place the pin exactly on the project location."}
                                        </Text>
                                        {pickedCoordinate && Platform.OS !== "web" ? (
                                            <Text className="mt-1 text-[10px] font-lato text-gray-400">
                                                {formatCoordinateAddress(pickedCoordinate)}
                                            </Text>
                                        ) : null}
                                    </View>
                                </View>
                            ) : (
                                <View className="h-[130px] items-center justify-center rounded-2xl bg-[#F4F7FF]">
                                    <Ionicons name="map-outline" size={48} color="#D1D5DB" />
                                    <Text className="mt-2 text-[13px] text-[#9CA3AF]">
                                        Map preview will appear here
                                    </Text>
                                </View>
                            )}

                            <View className="flex-row" style={{ columnGap: 10 }}>
                                <TouchableOpacity
                                    activeOpacity={0.86}
                                    onPress={prevStep}
                                    className="flex-1 items-center justify-center rounded-xl bg-gray-100 py-4"
                                >
                                    <Text className="text-sm font-lato-bold text-gray-700">
                                        {"\u2190"} Back
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    activeOpacity={0.86}
                                    onPress={nextStep}
                                    className="flex-[2] items-center justify-center rounded-xl bg-[#4A43EC] py-4"
                                >
                                    <Text className="text-sm font-lato-bold text-white">
                                        Next: Stage {"\u2192"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Step 3: Current Lead Stage */}
                    {currentStep === 2 && (
                        <View className="gap-5">
                            <Text className="text-base font-lato-bold text-black">
                                Step 3: Current Lead Stage
                            </Text>
                            <Text className="text-[11px] text-gray-400">
                                What is the current stage of this project?
                            </Text>

                            {leadStages.map((stage) => (
                                <RadioOption
                                    key={stage}
                                    label={stage}
                                    selected={leadStage === stage}
                                    onPress={() => setLeadStage(stage)}
                                />
                            ))}

                            <View className="mt-2 flex-row" style={{ columnGap: 10 }}>
                                <TouchableOpacity
                                    activeOpacity={0.86}
                                    onPress={prevStep}
                                    className="flex-1 items-center justify-center rounded-xl bg-gray-100 py-4"
                                >
                                    <Text className="text-sm font-lato-bold text-gray-700">
                                        {"\u2190"} Back
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    activeOpacity={0.86}
                                    onPress={nextStep}
                                    className="flex-[2] items-center justify-center rounded-xl bg-[#4A43EC] py-4"
                                >
                                    <Text className="text-sm font-lato-bold text-white">
                                        Next: Notes {"\u2192"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Step 4: First Interaction Notes */}
                    {currentStep === 3 && (
                        <View className="gap-5">
                            <Text className="text-base font-lato-bold text-black">
                                Step 4: First Interaction Notes
                            </Text>

                            <Text className="text-xs font-lato-bold text-black">Interaction Type</Text>
                            <View className="flex-row flex-wrap">
                                {interactionTypes.map((item) => (
                                    <Chip
                                        key={item}
                                        label={item}
                                        active={interactionType === item}
                                        onPress={() => setInteractionType(item)}
                                    />
                                ))}
                            </View>

                            <View>
                                <Text className="mb-1.5 text-xs font-lato-bold text-black">
                                    What did the builder say?
                                </Text>
                                <View className="min-h-[100px] rounded-xl border border-gray-200 bg-white px-4 py-3">
                                    <TextInput
                                        value={form.builderNotes}
                                        onChangeText={setField("builderNotes")}
                                        placeholder="e.g. Builder said partner is out of station. Need to call again on Monday."
                                        placeholderTextColor="#9CA3AF"
                                        multiline
                                        textAlignVertical="top"
                                        className="text-[13px] font-lato text-gray-800"
                                    />
                                </View>
                            </View>

                            <View>
                                <Text className="mb-1.5 text-xs font-lato-bold text-black">
                                    Next Follow-up Date & Time
                                </Text>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={toggleFollowUpPicker}
                                    className="h-12 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4"
                                >
                                    <Text className={`text-[13px] font-lato ${form.followUpDate ? "text-gray-800" : "text-gray-400"}`}>
                                        {form.followUpDate || "Select date & time"}
                                    </Text>
                                    <Ionicons
                                        name={followUpPickerOpen ? "chevron-up" : "chevron-down"}
                                        size={20}
                                        color="#9CA3AF"
                                    />
                                </TouchableOpacity>

                                {followUpPickerOpen && (
                                    <View className="mt-2 rounded-xl border border-gray-200 bg-[#F8F9FE] p-3">
                                        <View className="mb-3 flex-row items-center justify-between">
                                            <Text className="text-[13px] font-lato-bold text-[#374151]">
                                                {followUpPickerStep === "date" ? "Select date" : "Select time"}
                                            </Text>
                                            {followUpPickerStep === "time" && (
                                                <TouchableOpacity
                                                    activeOpacity={0.75}
                                                    onPress={() => setFollowUpPickerStep("date")}
                                                    className="flex-row items-center"
                                                >
                                                    <Ionicons name="chevron-back" size={16} color="#4A43EC" />
                                                    <Text className="text-[12px] font-lato-bold text-[#4A43EC]">
                                                        Date
                                                    </Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        {followUpPickerStep === "date" ? (
                                            <View className="flex-row flex-wrap justify-between">
                                                {followUpDateOptions.map((dateOption) => (
                                                    <TouchableOpacity
                                                        key={dateOption.id}
                                                        activeOpacity={0.82}
                                                        onPress={() => selectFollowUpDate(dateOption)}
                                                        className="mb-2 h-[52px] justify-center rounded-[10px] border bg-white px-3"
                                                        style={{
                                                            borderColor:
                                                                selectedFollowUpDate?.id === dateOption.id
                                                                    ? "#4A43EC"
                                                                    : "#E5E7EB",
                                                            width: "48%",
                                                        }}
                                                    >
                                                        <Text className="text-[13px] font-lato-bold text-[#111827]">
                                                            {dateOption.label}
                                                        </Text>
                                                        <Text className="mt-0.5 text-[11px] text-[#8B8D95]">
                                                            {dateOption.value}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        ) : (
                                            <View>
                                                <Text className="mb-2 text-[12px] font-lato text-[#8B8D95]">
                                                    {selectedFollowUpDate?.value}
                                                </Text>
                                                <View className="flex-row flex-wrap justify-between">
                                                    {followUpTimeOptions.map((timeOption) => (
                                                        <TouchableOpacity
                                                            key={timeOption}
                                                            activeOpacity={0.82}
                                                            onPress={() => selectFollowUpTime(timeOption)}
                                                            className="mb-2 h-[38px] items-center justify-center rounded-[10px] border border-[#E5E7EB] bg-white"
                                                            style={{ width: "31%" }}
                                                        >
                                                            <Text className="text-[12px] font-lato-bold text-[#374151]">
                                                                {timeOption}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>

                            <Text className="text-xs font-lato-bold text-black">Priority</Text>
                            <View className="flex-row" style={{ columnGap: 10 }}>
                                {priorities.map((item) => (
                                    <PriorityChip
                                        key={item}
                                        label={item}
                                        active={priority === item}
                                        onPress={() => setPriority(item)}
                                    />
                                ))}
                            </View>

                            <View className="rounded-xl border border-gray-200 bg-[#F8F9FE] p-2.5">
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={toggleVoiceRecording}
                                    className={`h-[46px] flex-row items-center justify-center rounded-xl ${
                                        isRecordingVoiceNote ? "bg-[#FEE2E2]" : "bg-white"
                                    }`}
                                >
                                    <MaterialCommunityIcons
                                        name={isRecordingVoiceNote ? "stop-circle" : "microphone"}
                                        size={22}
                                        color={isRecordingVoiceNote ? "#EF4444" : "#4A43EC"}
                                    />
                                    <Text
                                        className={`ml-2 text-[13px] font-lato-bold ${
                                            isRecordingVoiceNote ? "text-[#EF4444]" : "text-[#374151]"
                                        }`}
                                    >
                                        {isRecordingVoiceNote ? "Stop Recording" : "Add Voice Note"}
                                    </Text>
                                    <Text className="ml-2 text-[13px] text-[#9CA3AF]">
                                        {isRecordingVoiceNote
                                            ? formatDuration(recorderState.durationMillis)
                                            : voiceNoteUri
                                              ? "Recorded"
                                              : "Tap to record"}
                                    </Text>
                                </TouchableOpacity>

                                {voiceNoteUri && !isRecordingVoiceNote && (
                                    <View className="mt-2 flex-row items-center">
                                        <TouchableOpacity
                                            activeOpacity={0.82}
                                            onPress={toggleVoicePlayback}
                                            className="h-9 w-9 items-center justify-center rounded-full bg-[#4A43EC]"
                                        >
                                            <Ionicons
                                                name={isPlayingVoiceNote ? "pause" : "play"}
                                                size={17}
                                                color="#FFFFFF"
                                            />
                                        </TouchableOpacity>
                                        <View className="mx-3 h-2 flex-1 overflow-hidden rounded-full bg-[#E5E7EB]">
                                            <View
                                                className="h-2 rounded-full bg-[#4A43EC]"
                                                style={{
                                                    width: `${
                                                        voicePlayerStatus.duration
                                                            ? Math.min(
                                                                  (voicePlayerStatus.currentTime /
                                                                      voicePlayerStatus.duration) *
                                                                      100,
                                                                  100
                                                              )
                                                            : 0
                                                    }%`,
                                                }}
                                            />
                                        </View>
                                        <Text className="mr-3 text-[12px] font-lato text-[#6B7280]">
                                            {formatDuration(voiceNoteDuration)}
                                        </Text>
                                        <TouchableOpacity
                                            activeOpacity={0.82}
                                            onPress={deleteVoiceNote}
                                            className="h-9 w-9 items-center justify-center rounded-full bg-[#F3F4F6]"
                                        >
                                            <Ionicons name="trash-outline" size={17} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            <View className="flex-row" style={{ columnGap: 10 }}>
                                <TouchableOpacity
                                    activeOpacity={0.86}
                                    onPress={prevStep}
                                    className="flex-1 items-center justify-center rounded-xl bg-gray-100 py-4"
                                >
                                    <Text className="text-sm font-lato-bold text-gray-700">
                                        {"\u2190"} Back
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    activeOpacity={0.86}
                                    onPress={handleSave}
                                    disabled={saving}
                                    className="flex-[2] flex-row items-center justify-center rounded-xl bg-[#4A43EC] py-4"
                                    style={saving ? { opacity: 0.7 } : null}
                                >
                                    <Ionicons name={saving ? "hourglass-outline" : "checkmark"} size={18} color="#FFFFFF" />
                                    <Text className="ml-1 text-sm font-lato-bold text-white">
                                        {saving ? "Saving..." : "Save Lead"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    </KeyboardAwareScrollView>
                </View>
            </View>

            <Modal
                visible={searchModalVisible}
                animationType="slide"
                onRequestClose={() => setSearchModalVisible(false)}
            >
                <SafeAreaView className="flex-1 bg-white">
                    <View className="flex-row items-center justify-between px-4 py-3 border-b border-[#F1F5F9]">
                        <Text className="text-[16px] font-lato-bold text-[#111827]">Select Project Developer</Text>
                        <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={() => {
                                setSearchModalVisible(false);
                                setSearchQuery("");
                                setSearchResults([]);
                            }}
                            className="p-1"
                        >
                            <Ionicons name="close" size={20} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    <View className="px-4 py-3 bg-[#F8FAFC]">
                        <View className="h-10 flex-row items-center rounded-[10px] border border-[#E2E8F0] bg-white px-3">
                            <Ionicons name="search-outline" size={15} color="#8A94A6" />
                            <TextInput
                                value={searchQuery}
                                onChangeText={handleSearchDeveloper}
                                placeholder="Search by name, email or phone..."
                                placeholderTextColor="#9CA3AF"
                                className="ml-2 flex-1 text-[12px] text-[#111827]"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            {searchQuery ? (
                                <TouchableOpacity activeOpacity={0.75} onPress={() => handleSearchDeveloper("")}>
                                    <Ionicons name="close-circle" size={15} color="#9CA3AF" />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </View>

                    <ScrollView
                        className="flex-1 px-4"
                        contentContainerStyle={{ paddingTop: 10, paddingBottom: 20 }}
                        keyboardShouldPersistTaps="handled"
                    >
                        {searching ? (
                            <View className="py-8 items-center">
                                <ActivityIndicator size="small" color="#4A43EC" />
                            </View>
                        ) : searchQuery && searchResults.length === 0 ? (
                            <View className="py-8 items-center">
                                <Text className="text-[12px] text-[#64748B]">No project developers found</Text>
                            </View>
                        ) : !searchQuery ? (
                            <View className="py-8 items-center">
                                <Text className="text-[12px] text-[#94A3B8]">Type to search for active project developers</Text>
                            </View>
                        ) : (
                            searchResults.map((user) => (
                                <TouchableOpacity
                                    key={user.id}
                                    activeOpacity={0.7}
                                    onPress={() => handleSelectDeveloper(user)}
                                    className="flex-row items-center justify-between border-b border-[#F1F5F9] py-3"
                                >
                                    <View className="flex-1 mr-3">
                                        <Text className="text-[13px] font-lato-bold text-[#111827]">
                                            {user.first_name} {user.last_name || ""}
                                        </Text>
                                        {user.company_name && (
                                            <Text className="text-[10px] text-[#64748B] mt-0.5">
                                                Company: {user.company_name}
                                            </Text>
                                        )}
                                        <Text className="text-[10px] text-[#94A3B8] mt-0.5">
                                            {user.email || user.phone}
                                        </Text>
                                    </View>
                                    <View className="h-7 items-center justify-center rounded-[6px] bg-[#4A43EC]/10 px-3">
                                        <Text className="text-[10px] font-lato-bold text-[#4A43EC]">Select</Text>
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </Animated.View>
        </Modal>
    );
}
