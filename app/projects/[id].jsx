import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import {
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    useAudioPlayer,
    useAudioPlayerStatus,
    useAudioRecorder,
    useAudioRecorderState,
} from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import {
    addProjectFollowUp,
    addProjectMeeting,
    markProjectActivityDone,
    markProjectContacted,
    rejectProjectLead,
    selectProjectById,
} from "../../store/slices/projectsSlice";
import { leadsAPI } from "../../services/api";

const typeStyles = {
    Hot: { bg: "#FEE2E2", text: "#B91C1C" },
    Warm: { bg: "#FFEDD5", text: "#C2410C" },
    Cold: { bg: "#DBEAFE", text: "#2563EB" },
};

const statusStyles = {
    newLead: { bg: "#E0F2FE", text: "#0369A1" },
    contacted: { bg: "#E0F2FE", text: "#0369A1" },
    followUp: { bg: "#FFF7ED", text: "#EA580C" },
    meeting: { bg: "#F1EFFF", text: "#4A43EC" },
    interested: { bg: "#DCFCE7", text: "#16A34A" },
    live: { bg: "#DCFCE7", text: "#16A34A" },
    rejected: { bg: "#FEE2E2", text: "#B91C1C" },
};

const followUpToneStyles = {
    danger: { badgeBg: "#FEE2E2", badgeText: "#B91C1C" },
    hot: { badgeBg: "#FFEDD5", badgeText: "#C2410C" },
    warning: { badgeBg: "#FEF3C7", badgeText: "#B45309" },
};

const meetingToneStyles = {
    primary: { badgeBg: "#F1EFFF", badgeText: "#4A43EC" },
    success: { badgeBg: "#DCFCE7", badgeText: "#16A34A" },
};

const followUpTypes = ["Call", "Site Visit", "Office Visit", "Video Call"];
const followUpOutcomes = [
    "No Response",
    "Call Later",
    "Builder Busy",
    "Interested",
    "Need More Time",
    "Meeting Required",
    "Site Visit Required",
    "Documents Asked",
    "Pricing Discussion Pending",
    "Not Interested",
    "Onboarding Ready",
];
const followUpActions = ["Schedule another call", "Schedule meeting", "Send company profile", "Collect documents", "Start onboarding"];
const followUpStatuses = ["Hot", "Warm", "Docs Pending", "Overdue", "Done"];
const meetingTypes = ["Site Meeting", "Builder Office", "SquarFT Office", "Phone", "Video Call"];
const meetingStatuses = ["Scheduled", "Today", "Tomorrow", "Planned", "Done"];
const meetingAgenda = ["Company Introduction", "Project Collaboration Discussion", "Pricing Discussion", "Inventory Collection", "Document Collection"];
const reminderOptions = ["30 minutes before", "1 hour before", "2 hours before", "1 day before"];
const projectJourneyTemplate = [
    "New Lead Added",
    "First Contact",
    "Follow-up",
    "Meeting Scheduled",
    "Interested",
    "In-Review",
    "Project live",
];
const rejectedProjectJourneyTemplate = [
    "New Lead Added",
    "First Contact",
    "Follow-up",
    "Meeting Scheduled",
    "Interested",
    "In-Review",
    "Rejected",
];
const defaultProjectJourneyStage = "New Lead Added";

function getProjectJourney(project) {
    const stage = project.journeyStage || defaultProjectJourneyStage;
    const isRejected = project.statusType === "rejected" || stage === "Rejected";
    const template = isRejected ? rejectedProjectJourneyTemplate : projectJourneyTemplate;
    const stageHistory = project.stageHistory || [];
    const completedRejectedIndex = isRejected
        ? Math.max(
              0,
              ...stageHistory
                  .filter((item) => item.stage !== "Rejected")
                  .map((item) => template.findIndex((label) => label === item.stage))
                  .filter((index) => index >= 0),
          )
        : -1;
    const stageIndex = template.findIndex((item) => item === stage);
    const fallbackIndex = template.findIndex((item) => item === defaultProjectJourneyStage);
    const currentIndex = stageIndex >= 0 ? stageIndex : Math.max(0, fallbackIndex);

    return template.map((label, index) => {
        if (isRejected) {
            return {
                label,
                note: stageHistory.find((item) => item.stage === label)?.note,
                state: label === "Rejected" ? "rejectedCurrent" : index <= completedRejectedIndex ? "done" : "rejected",
            };
        }

        return {
            label,
            note: stageHistory.find((item) => item.stage === label)?.note,
            state: index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
        };
    });
}

async function openUrl(url) {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
        await Linking.openURL(url);
    }
}

function ProgressBar({ value, color = "#4A43EC", trackColor = "#E5E7EB", height = 6 }) {
    return (
        <View className="mt-2 overflow-hidden rounded-full" style={{ height, backgroundColor: trackColor }}>
            <View className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
        </View>
    );
}

function Section({ title, children, action }) {
    return (
        <View className="mb-2.5 rounded-[12px] border border-[#E5E7EB] bg-white p-3">
            <View className="mb-2.5 flex-row items-center justify-between">
                <Text className="text-[10px] font-lato-bold uppercase tracking-[1.5px] text-[#64748B]">{title}</Text>
                {action}
            </View>
            {children}
        </View>
    );
}

function Badge({ label, styleSet }) {
    return (
        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: styleSet.bg }}>
            <Text className="text-[9px] font-lato-bold" style={{ color: styleSet.text }}>
                {label}
            </Text>
        </View>
    );
}

function formatDate(date) {
    return date.toLocaleDateString("en-GB").replace(/\//g, "-");
}

function formatTime(date) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDuration(durationMillis = 0) {
    const totalSeconds = Math.max(0, Math.floor(durationMillis / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, "0");

    return `${minutes}:${seconds}`;
}

function buildDateTime(dateValue, timeValue) {
    const nextDate = new Date(dateValue);
    nextDate.setHours(timeValue.getHours());
    nextDate.setMinutes(timeValue.getMinutes());
    nextDate.setSeconds(0);
    nextDate.setMilliseconds(0);
    return nextDate;
}

function openNativeDateTimePicker({ value, mode, onChange }) {
    if (Platform.OS === "android") {
        DateTimePickerAndroid.open({
            value,
            mode,
            display: "default",
            onChange: (event, selectedValue) => {
                if (event.type === "set" && selectedValue) {
                    onChange(selectedValue);
                }
            },
        });
        return true;
    }

    return false;
}

function FormLabel({ children }) {
    return <Text className="mb-1.5 mt-3 text-[10px] font-lato-bold text-[#475569]">{children}</Text>;
}

function SheetInput({ value, onChangeText, placeholder, multiline = false }) {
    return (
        <BottomSheetTextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#94A3B8"
            multiline={multiline}
            textAlignVertical={multiline ? "top" : "center"}
            className={`rounded-[10px] border border-[#E2E8F0] bg-white px-3 text-[11px] text-[#111827] ${
                multiline ? "h-20 py-2.5" : "h-10"
            }`}
        />
    );
}

function ChoiceChip({ label, active, icon, onPress }) {
    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            className={`mb-2 mr-2 h-8 flex-row items-center justify-center rounded-full border px-3 ${
                active ? "border-[#4A43EC] bg-[#4A43EC]" : "border-[#E2E8F0] bg-white"
            }`}
        >
            {icon ? <Ionicons name={icon} size={12} color={active ? "#fff" : "#475569"} /> : null}
            <Text className={`text-[10px] font-lato-bold ${icon ? "ml-1" : ""} ${active ? "text-white" : "text-[#475569]"}`}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

function RadioRow({ label, active, onPress }) {
    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            className="mb-2 h-10 flex-row items-center rounded-[10px] border border-[#E2E8F0] bg-white px-3"
        >
            <View className={`h-4 w-4 items-center justify-center rounded-full border ${active ? "border-[#4A43EC]" : "border-[#CBD5E1]"}`}>
                {active ? <View className="h-2 w-2 rounded-full bg-[#4A43EC]" /> : null}
            </View>
            <Text className="ml-2 text-[11px] text-[#111827]">{label}</Text>
        </TouchableOpacity>
    );
}

function CheckRow({ label, active, onPress }) {
    return (
        <TouchableOpacity activeOpacity={0.85} onPress={onPress} className="mb-2 flex-row items-center">
            <View
                className={`h-4 w-4 items-center justify-center rounded-[4px] border ${
                    active ? "border-[#4A43EC] bg-[#4A43EC]" : "border-[#CBD5E1] bg-white"
                }`}
            >
                {active ? <Ionicons name="checkmark" size={11} color="#fff" /> : null}
            </View>
            <Text className="ml-2 text-[11px] text-[#111827]">{label}</Text>
        </TouchableOpacity>
    );
}

function SelectBox({ value, placeholder, options, open, onToggle, onSelect }) {
    return (
        <View>
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={onToggle}
                className={`h-10 flex-row items-center justify-between rounded-[10px] border bg-white px-3 ${
                    open ? "border-[#4A43EC]" : "border-[#E2E8F0]"
                }`}
            >
                <Text className={`text-[11px] ${value ? "text-[#111827]" : "text-[#64748B]"}`}>{value || placeholder}</Text>
                <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color="#64748B" />
            </TouchableOpacity>
            {open ? (
                <View className="-mt-1 overflow-hidden rounded-b-[10px] border border-[#4A43EC] bg-white">
                    {[placeholder, ...options].map((option, index) => {
                        const isPlaceholder = index === 0;
                        const isActive = (!value && isPlaceholder) || value === option;

                        return (
                            <TouchableOpacity
                                key={option}
                                activeOpacity={0.85}
                                onPress={() => onSelect(isPlaceholder ? "" : option)}
                                className={`px-3 py-2 ${isActive ? "bg-[#2563D8]" : "bg-white"}`}
                            >
                                <Text className={`text-[11px] ${isActive ? "text-white" : "text-[#111827]"}`}>{option}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ) : null}
        </View>
    );
}

function DateTimeField({ value, icon, onPress }) {
    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            className="h-10 flex-row items-center justify-between rounded-[10px] border border-[#E2E8F0] bg-white px-3"
        >
            <Text className="text-[11px] text-[#111827]">{value}</Text>
            <Ionicons name={icon} size={14} color="#111827" />
        </TouchableOpacity>
    );
}

function DateTimePickerModal({ visible, value, mode, onChange, onClose }) {
    if (!visible) return null;

    return (
        <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
            <View className="flex-1 justify-end bg-black/35">
                <View className="rounded-t-[18px] bg-white px-4 pb-5 pt-3">
                    <View className="mb-3 flex-row items-center justify-between">
                        <TouchableOpacity activeOpacity={0.8} onPress={onClose} className="h-9 justify-center">
                            <Text className="text-[13px] font-lato-bold text-[#64748B]">Cancel</Text>
                        </TouchableOpacity>
                        <Text className="text-[14px] font-lato-bold text-[#111827]">
                            Select {mode === "date" ? "Date" : "Time"}
                        </Text>
                        <TouchableOpacity activeOpacity={0.8} onPress={onClose} className="h-9 justify-center">
                            <Text className="text-[13px] font-lato-bold text-[#4A43EC]">Done</Text>
                        </TouchableOpacity>
                    </View>
                    <DateTimePicker
                        value={value}
                        mode={mode}
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        textColor="#111827"
                        themeVariant="light"
                        accentColor="#4A43EC"
                        onChange={(event, selectedValue) => {
                            if (selectedValue) onChange(selectedValue);
                            if (Platform.OS !== "ios") onClose();
                        }}
                    />
                </View>
            </View>
        </Modal>
    );
}

function ProjectContextCard({ project }) {
    return (
        <View className="rounded-[12px] border border-[#DDE2FF] bg-[#F1EFFF] p-3">
            <Text className="text-[10px] text-[#4A43EC]">Project</Text>
            <Text className="mt-1 text-[12px] font-lato-bold text-[#312E81]" numberOfLines={1}>
                {project.projectName} . {project.developerName}
            </Text>
        </View>
    );
}

function FollowUpForm({ project, onSave, submitting }) {
    const [followUpType, setFollowUpType] = useState(followUpTypes[0]);
    const [outcome, setOutcome] = useState("");
    const [outcomeOpen, setOutcomeOpen] = useState(false);
    const [followUpStatus, setFollowUpStatus] = useState(project.type === "Hot" ? "Hot" : "Warm");
    const [statusOpen, setStatusOpen] = useState(false);
    const [remarks, setRemarks] = useState("");
    const [nextAction, setNextAction] = useState(followUpActions[0]);
    const [nextDate, setNextDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [sitePhoto, setSitePhoto] = useState(null);
    const [voiceNoteUri, setVoiceNoteUri] = useState(null);
    const [voiceNoteDuration, setVoiceNoteDuration] = useState(0);
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recorderState = useAudioRecorderState(audioRecorder, 250);
    const voicePlayer = useAudioPlayer(voiceNoteUri ? { uri: voiceNoteUri } : null, {
        updateInterval: 250,
    });
    const voicePlayerStatus = useAudioPlayerStatus(voicePlayer);
    const isRecordingVoiceNote = recorderState.isRecording;
    const isPlayingVoiceNote = voicePlayerStatus.playing;

    const pickSitePhoto = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.75,
        });

        if (!result.canceled) {
            setSitePhoto(result.assets[0]);
        }
    };

    const handleSave = () => {
        if (!outcome) {
            Alert.alert("Missing field", "Please select an outcome.");
            return;
        }
        onSave({
            id: `followup-${project.id}-${Date.now()}`,
            projectId: project.id,
            projectName: project.projectName,
            builderName: project.developerName,
            developerName: project.developerName,
            projectLocation: project.location,
            city: project.city,
            phoneNumber: project.phoneNumber,
            time: formatTime(nextDate),
            note: remarks.trim() || nextAction,
            status: followUpStatus,
            tone: followUpStatus === "Overdue" ? "danger" : followUpStatus === "Hot" ? "hot" : "warning",
            // File objects for FormData upload
            voiceNoteFile: voiceNoteUri ? { uri: voiceNoteUri } : null,
            sitePhotoFile: sitePhoto ? { uri: sitePhoto.uri } : null,
            meta: {
                followUpType,
                outcome,
                followUpStatus,
                nextAction,
                nextFollowUpAt: nextDate.toISOString(),
                sitePhoto,
                voiceNoteUri,
                voiceNoteDuration,
            },
        });
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

    return (
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
            <View className="mb-3 h-1.5 w-10 self-center rounded-full bg-[#CBD5E1]" />
            <Text className="mb-3 text-[16px] font-lato-bold text-[#111827]">Add Follow-up</Text>
            <ProjectContextCard project={project} />

            <FormLabel>Follow-up Type</FormLabel>
            <View className="flex-row flex-wrap">
                {followUpTypes.map((type, index) => (
                    <ChoiceChip
                        key={type}
                        label={type}
                        active={followUpType === type}
                        icon={index === 0 ? "call-outline" : undefined}
                        onPress={() => setFollowUpType(type)}
                    />
                ))}
            </View>

            <FormLabel>Outcome</FormLabel>
            <SelectBox
                value={outcome}
                placeholder="Select outcome..."
                options={followUpOutcomes}
                open={outcomeOpen}
                onToggle={() => setOutcomeOpen((value) => !value)}
                onSelect={(value) => {
                    setOutcome(value);
                    setOutcomeOpen(false);
                }}
            />

            <FormLabel>Follow-up Status</FormLabel>
            <SelectBox
                value={followUpStatus}
                placeholder="Select status..."
                options={followUpStatuses}
                open={statusOpen}
                onToggle={() => setStatusOpen((value) => !value)}
                onSelect={(value) => {
                    setFollowUpStatus(value || followUpStatuses[0]);
                    setStatusOpen(false);
                }}
            />

            <FormLabel>Remarks</FormLabel>
            <SheetInput
                value={remarks}
                onChangeText={setRemarks}
                multiline
                placeholder="e.g. Builder said partner is out of station. Need to call again on Monday."
            />

            <FormLabel>Next Action</FormLabel>
            {followUpActions.map((action, index) => (
                <RadioRow key={action} label={action} active={nextAction === action} onPress={() => setNextAction(action)} />
            ))}

            <FormLabel>Next Follow-up Date & Time</FormLabel>
            <View className="flex-row">
                <View className="mr-2 flex-1">
                    <DateTimeField
                        value={formatDate(nextDate)}
                        icon="calendar-outline"
                        onPress={() => {
                            const opened = openNativeDateTimePicker({
                                value: nextDate,
                                mode: "date",
                                onChange: (selectedDate) => setNextDate(buildDateTime(selectedDate, nextDate)),
                            });
                            if (!opened) setShowDatePicker(true);
                        }}
                    />
                </View>
                <View className="flex-1">
                    <DateTimeField
                        value={formatTime(nextDate)}
                        icon="time-outline"
                        onPress={() => {
                            const opened = openNativeDateTimePicker({
                                value: nextDate,
                                mode: "time",
                                onChange: (selectedTime) => setNextDate(buildDateTime(nextDate, selectedTime)),
                            });
                            if (!opened) setShowTimePicker(true);
                        }}
                    />
                </View>
            </View>
            <DateTimePickerModal
                visible={showDatePicker}
                value={nextDate}
                mode="date"
                onChange={(selectedDate) => setNextDate(buildDateTime(selectedDate, nextDate))}
                onClose={() => setShowDatePicker(false)}
            />
            <DateTimePickerModal
                visible={showTimePicker}
                value={nextDate}
                mode="time"
                onChange={(selectedTime) => setNextDate(buildDateTime(nextDate, selectedTime))}
                onClose={() => setShowTimePicker(false)}
            />

            <TouchableOpacity activeOpacity={0.85} onPress={toggleVoiceRecording} className="mt-3 rounded-[10px] bg-[#F1F3FA] p-3">
                <View className="flex-row items-center">
                    <Ionicons name={isRecordingVoiceNote ? "stop-circle-outline" : "mic-outline"} size={17} color={isRecordingVoiceNote ? "#EF4444" : "#4A43EC"} />
                    <View className="ml-2">
                        <Text className="text-[11px] font-lato-bold text-[#111827]">
                            {isRecordingVoiceNote ? "Stop Recording" : "Add Voice Note"}
                        </Text>
                        <Text className="text-[9px] text-[#64748B]">
                            {isRecordingVoiceNote ? formatDuration(recorderState.durationMillis) : voiceNoteUri ? "Recorded" : "Tap to record"}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
            {voiceNoteUri && !isRecordingVoiceNote ? (
                <View className="mt-2 flex-row items-center rounded-[10px] bg-white p-2.5">
                    <TouchableOpacity
                        activeOpacity={0.82}
                        onPress={toggleVoicePlayback}
                        className="h-9 w-9 items-center justify-center rounded-full bg-[#4A43EC]"
                    >
                        <Ionicons name={isPlayingVoiceNote ? "pause" : "play"} size={17} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View className="mx-3 h-2 flex-1 overflow-hidden rounded-full bg-[#E5E7EB]">
                        <View
                            className="h-2 rounded-full bg-[#4A43EC]"
                            style={{
                                width: `${
                                    voicePlayerStatus.duration
                                        ? Math.min((voicePlayerStatus.currentTime / voicePlayerStatus.duration) * 100, 100)
                                        : 0
                                }%`,
                            }}
                        />
                    </View>
                    <Text className="mr-3 text-[12px] font-lato text-[#6B7280]">{formatDuration(voiceNoteDuration)}</Text>
                    <TouchableOpacity
                        activeOpacity={0.82}
                        onPress={deleteVoiceNote}
                        className="h-9 w-9 items-center justify-center rounded-full bg-[#F3F4F6]"
                    >
                        <Ionicons name="trash-outline" size={17} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            ) : null}

            <TouchableOpacity activeOpacity={0.85} onPress={pickSitePhoto} className="mt-2 rounded-[10px] bg-[#F1F3FA] p-3">
                <View className="flex-row items-center">
                    <Ionicons name="camera-outline" size={17} color="#4A43EC" />
                    <View className="ml-2">
                        <Text className="text-[11px] font-lato-bold text-[#111827]">Add Site Photo Proof</Text>
                        <Text className="text-[9px] text-[#64748B]">
                            {sitePhoto ? sitePhoto.fileName || "Photo selected" : "With auto location + timestamp"}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.9} onPress={handleSave} disabled={submitting} className="mt-4 h-11 flex-row items-center justify-center rounded-[10px] bg-[#16A34A]">
                {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                        <Text className="ml-1.5 text-[12px] font-lato-bold text-white">Save Follow-up</Text>
                    </>
                )}
            </TouchableOpacity>
        </BottomSheetScrollView>
    );
}

function MeetingForm({ project, onSave, submitting }) {
    const [meetingType, setMeetingType] = useState(meetingTypes[0]);
    const [meetingStatus, setMeetingStatus] = useState("Scheduled");
    const [statusOpen, setStatusOpen] = useState(false);
    const [meetingDate, setMeetingDate] = useState(new Date());
    const [meetingTime, setMeetingTime] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [location, setLocation] = useState(project.location);
    const [selectedAgenda, setSelectedAgenda] = useState([meetingAgenda[0]]);
    const [notes, setNotes] = useState("");
    const [reminder, setReminder] = useState(reminderOptions[0]);
    const [reminderOpen, setReminderOpen] = useState(false);

    const toggleAgenda = (agenda) => {
        setSelectedAgenda((items) => (items.includes(agenda) ? items.filter((item) => item !== agenda) : [...items, agenda]));
    };

    const handleSave = () => {
        const scheduledAt = buildDateTime(meetingDate, meetingTime);

        onSave({
            id: `meeting-${project.id}-${Date.now()}`,
            projectId: project.id,
            projectName: project.projectName,
            developerName: project.developerName,
            phoneNumber: project.phoneNumber,
            location: location.trim() || project.location,
            latitude: project.latitude,
            longitude: project.longitude,
            type: meetingType,
            time: formatTime(scheduledAt),
            status: meetingStatus,
            tone: "primary",
            meta: {
                scheduledAt: scheduledAt.toISOString(),
                agenda: selectedAgenda,
                notes,
                reminder,
                meetingStatus,
            },
        });
    };

    return (
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
            <View className="mb-3 h-1.5 w-10 self-center rounded-full bg-[#CBD5E1]" />
            <Text className="mb-3 text-[16px] font-lato-bold text-[#111827]">Schedule Meeting</Text>
            <ProjectContextCard project={project} />

            <FormLabel>Meeting Type</FormLabel>
            <View className="flex-row flex-wrap">
                {meetingTypes.map((type, index) => (
                    <ChoiceChip key={type} label={type} active={meetingType === type} onPress={() => setMeetingType(type)} />
                ))}
            </View>

            <FormLabel>Meeting Status</FormLabel>
            <SelectBox
                value={meetingStatus}
                placeholder="Select status..."
                options={meetingStatuses}
                open={statusOpen}
                onToggle={() => setStatusOpen((value) => !value)}
                onSelect={(value) => {
                    setMeetingStatus(value || meetingStatuses[0]);
                    setStatusOpen(false);
                }}
            />

            <View className="flex-row">
                <View className="mr-2 flex-1">
                    <FormLabel>Date</FormLabel>
                    <DateTimeField
                        value={formatDate(meetingDate)}
                        icon="calendar-outline"
                        onPress={() => {
                            const opened = openNativeDateTimePicker({
                                value: meetingDate,
                                mode: "date",
                                onChange: setMeetingDate,
                            });
                            if (!opened) setShowDatePicker(true);
                        }}
                    />
                </View>
                <View className="flex-1">
                    <FormLabel>Time</FormLabel>
                    <DateTimeField
                        value={formatTime(meetingTime)}
                        icon="time-outline"
                        onPress={() => {
                            const opened = openNativeDateTimePicker({
                                value: meetingTime,
                                mode: "time",
                                onChange: setMeetingTime,
                            });
                            if (!opened) setShowTimePicker(true);
                        }}
                    />
                </View>
            </View>
            <DateTimePickerModal
                visible={showDatePicker}
                value={meetingDate}
                mode="date"
                onChange={setMeetingDate}
                onClose={() => setShowDatePicker(false)}
            />
            <DateTimePickerModal
                visible={showTimePicker}
                value={meetingTime}
                mode="time"
                onChange={setMeetingTime}
                onClose={() => setShowTimePicker(false)}
            />

            <FormLabel>Location / Address</FormLabel>
            <SheetInput value={location} onChangeText={setLocation} placeholder="Site address or meeting location" />

            <FormLabel>Agenda</FormLabel>
            {meetingAgenda.map((agenda, index) => (
                <CheckRow key={agenda} label={agenda} active={selectedAgenda.includes(agenda)} onPress={() => toggleAgenda(agenda)} />
            ))}

            <FormLabel>Notes / Preparation</FormLabel>
            <SheetInput value={notes} onChangeText={setNotes} multiline placeholder="Things to prepare, bring, or discuss..." />

            <FormLabel>Reminder</FormLabel>
            <SelectBox
                value={reminder}
                placeholder="Select reminder..."
                options={reminderOptions}
                open={reminderOpen}
                onToggle={() => setReminderOpen((value) => !value)}
                onSelect={(value) => {
                    setReminder(value || reminderOptions[0]);
                    setReminderOpen(false);
                }}
            />

            <TouchableOpacity activeOpacity={0.9} onPress={handleSave} disabled={submitting} className="mt-4 h-11 flex-row items-center justify-center rounded-[10px] bg-[#4A43EC]">
                {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <>
                        <Ionicons name="calendar-outline" size={14} color="#fff" />
                        <Text className="ml-1.5 text-[12px] font-lato-bold text-white">Schedule Meeting</Text>
                    </>
                )}
            </TouchableOpacity>
        </BottomSheetScrollView>
    );
}

function ProjectJourney({ items }) {
    return (
        <Section title="Project Journey">
            {items.map((item, index) => {
                const isDone = item.state === "done";
                const isCurrent = item.state === "current";
                const isRejected = item.state === "rejected" || item.state === "rejectedCurrent";
                const circleClass = isDone
                    ? "border-[#DCFCE7] bg-[#DCFCE7]"
                    : isRejected
                      ? "border-[#FEE2E2] bg-[#FEE2E2]"
                    : isCurrent
                      ? "border-[#4A43EC] bg-white"
                      : "border-[#E5E7EB] bg-white";
                const iconName = isDone ? "checkmark" : isRejected ? "close" : isCurrent ? "time-outline" : "ellipse-outline";
                const iconColor = isDone ? "#16A34A" : isRejected ? "#B91C1C" : isCurrent ? "#4A43EC" : "#CBD5E1";

                return (
                    <View key={item.label} className="flex-row">
                        <View className="items-center">
                            <View className={`h-6 w-6 items-center justify-center rounded-full border ${circleClass}`}>
                                <Ionicons name={iconName} size={12} color={iconColor} />
                            </View>
                            {index < items.length - 1 ? <View className="h-8 w-px bg-[#E5E7EB]" /> : null}
                        </View>
                        <View className="ml-3 flex-1 pb-3">
                            <Text
                                className={`text-[12px] font-lato-bold ${
                                    isRejected
                                        ? "text-[#B91C1C]"
                                        : isCurrent
                                          ? "text-[#4A43EC]"
                                          : item.state === "upcoming"
                                            ? "text-[#A1A1AA]"
                                            : "text-[#111827]"
                                }`}
                            >
                                {item.label}
                            </Text>
                            {item.note ? <Text className="mt-0.5 text-[10px] text-[#94A3B8]">{item.note}</Text> : null}
                        </View>
                    </View>
                );
            })}
        </Section>
    );
}

function Overview({ project, onReject }) {
    const typeStyle = typeStyles[project.type] ?? typeStyles.Warm;
    const hasCompletedFollowUp = (project.followUps || []).some((item) => item.isDone || item.status === "Done");
    const hasCompletedMeeting = (project.meetings || []).some((item) => item.isDone || item.status === "Done");
    const canContinueOnboarding = hasCompletedFollowUp && hasCompletedMeeting;
    const isOnboardingComplete = project.projectLastCompletedStep >= 6;

    // Button state logic:
    // - No project linked OR linked but not complete → "Continue Onboarding"
    // - Project linked and complete (submitted) → "Edit Onboarding"
    const linkedProjectId = project.linkedProjectId;
    const onboardingBtnLabel = isOnboardingComplete ? "Edit Onboarding" : "Continue Onboarding";
    const onboardingBtnColor = isOnboardingComplete ? "#0369A1" : "#4A43EC";
    const projectInfo = [
        ["Builder", project.developerName],
        ["Contact Person", project.contactPerson],
        ["Type", project.projectType],
        ["Contact", project.phoneNumber],
        ["WhatsApp", project.whatsappNumber],
        ["City", project.city],
        ["Area", project.area || project.location],
        ["Colony / Landmark", project.colony],
        ["Address", project.fullAddress],
        ["Added", project.addedOn],
        ["Lead Type", project.type],
        ["Notes", project.builderNotes],
    ].filter(([, value]) => Boolean(value));
    const onboardingDraftForm = project.onboardingDraft?.form;
    const propertyTypes = project.onboardingData?.propertyTypes ?? onboardingDraftForm?.step2?.selectedTypes;
    const approvals = project.onboardingData?.approvals ?? onboardingDraftForm?.step4;
    const finance = project.onboardingData?.finance ?? onboardingDraftForm?.step5;
    const media = project.onboardingData?.media ?? onboardingDraftForm?.step6;
    const onboardingInfo = propertyTypes || approvals || finance || media
        ? [
              ["Property Types", propertyTypes?.map((item) => `${item.mainType} . ${item.subType}`).join(", ")],
              ["Approval Status", approvals?.overallApprovalStatus],
              ["Possession Status", approvals?.possessionStatus],
              ["Development Progress", approvals?.developmentCompletionPercentage ? `${approvals.developmentCompletionPercentage}%` : ""],
              ["Loan Available", finance?.loanAvailable],
              ["Ownership Type", finance?.ownershipType],
              ["Images", media?.images?.length ? `${media.images.length} added` : ""],
              ["Documents", media?.documents?.length ? `${media.documents.length} added` : ""],
          ].filter(([, value]) => Boolean(value))
        : [];

    return (
        <View className="px-4 pt-3">
            <ProjectJourney items={getProjectJourney(project)} />

            <Section title="Project Info">
                {projectInfo.map(([label, value]) => (
                    <View key={label} className="flex-row justify-between border-b border-[#F1F5F9] py-2 last:border-b-0">
                        <Text className="text-[11px] text-[#64748B]">{label}</Text>
                        <Text className="ml-4 flex-1 text-right text-[11px] font-lato-bold text-[#111827]">{value}</Text>
                    </View>
                ))}
                <View className="mt-1 self-end">
                    <Badge label={project.type} styleSet={typeStyle} />
                </View>
            </Section>

            <Section
                title="Onboarding Progress"
                action={<Text className="text-[13px] font-lato-bold text-[#4A43EC]">{project.onboardingProgress || 0}%</Text>}
            >
                <ProgressBar value={project.onboardingProgress || 0} color="#4A43EC" trackColor="#DDE1EA" height={7} />
                {onboardingInfo.length ? (
                    <View className="mt-3">
                        {onboardingInfo.map(([label, value]) => (
                            <View key={label} className="flex-row justify-between border-b border-[#F1F5F9] py-2 last:border-b-0">
                                <Text className="text-[11px] text-[#64748B]">{label}</Text>
                                <Text className="ml-4 flex-1 text-right text-[11px] font-lato-bold text-[#111827]">{value}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}
                <View className="mt-3 flex-row" style={{ columnGap: 8 }}>
                    {isOnboardingComplete ? (
                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => router.push({
                                pathname: "/onboarding/project-form",
                                params: { id: project.id },
                            })}
                            className="h-10 flex-1 flex-row items-center justify-center rounded-[10px]"
                            style={{ backgroundColor: "#0369A1" }}
                        >
                            <Ionicons name="create-outline" size={14} color="#fff" />
                            <Text className="ml-1.5 text-[12px] font-lato-bold text-white">Edit Onboarding</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => router.push({
                                pathname: "/onboarding/project-form",
                                params: { id: project.id },
                            })}
                            className="h-10 flex-1 items-center justify-center rounded-[10px]"
                            style={{ backgroundColor: onboardingBtnColor }}
                        >
                            <Text className="text-[12px] font-lato-bold text-white">
                                {onboardingBtnLabel}
                            </Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={onReject}
                        className="h-10 flex-1 items-center justify-center rounded-[10px] bg-[#FEE2E2]"
                    >
                        <Text className="text-[12px] font-lato-bold text-[#B91C1C]">Reject Lead</Text>
                    </TouchableOpacity>
                </View>
                {!linkedProjectId ? (
                    <Text className="mt-2 text-center text-[10px] text-[#64748B]">
                        (At least 1 follow-up and 1 meeting is recommended but you can continue without them)
                    </Text>
                ) : null}
            </Section>



            {media?.documents?.length ? (
                <Section title="Documents">
                    {media.documents.map((document, index) => (
                        <View key={`${document.name || document.uri}-${index}`} className="flex-row items-center border-b border-[#F1F5F9] py-2 last:border-b-0">
                            <Ionicons name="document-text-outline" size={14} color="#16A34A" />
                            <Text className="ml-2 flex-1 text-[11px] text-[#111827]" numberOfLines={1}>
                                {document.name || document.fileName || document.uri}
                            </Text>
                        </View>
                    ))}
                </Section>
            ) : null}
        </View>
    );
}



function FollowUpCard({ item, projectName, onDone }) {
    const tone = followUpToneStyles[item.tone] ?? followUpToneStyles.warning;

    return (
        <View className="mb-2 rounded-[12px] border border-[#EEF0F4] bg-white px-3 py-2.5">
            <View className="flex-row items-start justify-between">
                <Text className="text-[12px] font-lato-bold text-[#111827]" numberOfLines={1}>
                    {projectName || item.projectName}
                </Text>
                <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: tone.badgeBg }}>
                    <Text className="text-[9px] font-semibold" style={{ color: tone.badgeText }}>
                        {item.status}
                    </Text>
                </View>
            </View>
            <View className="mt-0.5 flex-row items-center">
                {item.meta?.followUpType ? (
                    <>
                        <Text className="text-[9px] font-lato-bold uppercase tracking-[1.5px] text-[#64748B]">
                            {item.meta.followUpType.replace(/_/g, " ")}
                        </Text>
                        <View className="mx-1.5 h-0.5 w-0.5 rounded-full bg-[#C8CDD8]" />
                    </>
                ) : null}
                <Text className="text-[10px] text-[#6B7280]">{item.time}</Text>
            </View>
            <View className="mt-2 rounded-[9px] bg-[#F8F9FF] px-2.5 py-2">
                <Text className="text-[10px] leading-4 text-[#4B5563]">{item.note}</Text>
            </View>
            <View className="mt-2 flex-row items-center">
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => openUrl(`tel:${item.phoneNumber}`)}
                    className="mr-2 h-8 flex-1 flex-row items-center justify-center rounded-[9px] bg-[#4A43EC]"
                >
                    <Ionicons name="call" size={12} color="#fff" />
                    <Text className="ml-1.5 text-[11px] font-lato-bold text-white">Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => !item.isDone && onDone(item.id)}
                    className={`h-8 flex-1 items-center justify-center rounded-[9px] ${item.isDone ? "bg-[#DCFCE7]" : "bg-[#EBF1FF]"}`}
                >
                    <Text className={`text-[11px] font-lato-bold ${item.isDone ? "text-[#16A34A]" : "text-[#4A43EC]"}`}>
                        {item.isDone ? "Completed" : "Done"}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

function MeetingCard({ item, projectName, projectId, onDone }) {
    const tone = meetingToneStyles[item.tone] ?? meetingToneStyles.primary;

    const handleNavigate = () => {
        if (!item.location && !item.latitude) {
            Alert.alert("No location", "This meeting has no location set.");
            return;
        }
        // Always use in-app navigation — address will be geocoded inside navigate.jsx
        router.push({
            pathname: "/projects/navigate",
            params: {
                lat: item.latitude || "",
                lng: item.longitude || "",
                address: item.location || "",
                label: item.location || projectName,
                meetingId: item.id,
                leadId: projectId,
            },
        });
    };

    return (
        <View className="mb-2 rounded-[12px] border border-[#EEF0F4] bg-white px-3 py-2.5">
            <View className="flex-row items-start justify-between">
                <Text className="text-[12px] font-lato-bold text-[#111827]" numberOfLines={1}>
                    {projectName || item.projectName}
                </Text>
                <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: tone.badgeBg }}>
                    <Text className="text-[9px] font-semibold" style={{ color: tone.badgeText }}>
                        {item.status}
                    </Text>
                </View>
            </View>
            <View className="mt-0.5 flex-row items-center">
                <Text className="text-[9px] font-lato-bold uppercase tracking-[0.5px] text-[#64748B]">
                    {item.type}
                </Text>
                <View className="mx-1.5 h-0.5 w-0.5 rounded-full bg-[#C8CDD8]" />
                <Text className="text-[10px] text-[#6B7280]">{item.time}</Text>
            </View>
            <View className="mt-2 rounded-[9px] bg-[#F8F9FF] px-2.5 py-2">
                <Text className="text-[10px] leading-4 text-[#4B5563]">
                    Meet at {item.location} for {item.type.toLowerCase()}.
                </Text>
            </View>
            <View className="mt-2 flex-row items-center">
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => onDone(item.id)}
                    className="mr-2 h-8 flex-1 flex-row items-center justify-center rounded-[9px] bg-[#4A43EC]"
                >
                    <Ionicons name="checkmark" size={12} color="#fff" />
                    <Text className="ml-1.5 text-[11px] font-lato-bold text-white">
                        {item.isDone ? "Completed" : "Done"}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleNavigate}
                    className="h-8 flex-1 flex-row items-center justify-center rounded-[9px] bg-[#EBF1FF]"
                >
                    <Ionicons name="location-outline" size={12} color="#4A43EC" />
                    <Text className="ml-1.5 text-[11px] font-lato-bold text-[#4A43EC]">Navigate</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

function Activity({ project, activeActivityTab, onActivityTabChange, onActivityDone }) {    const items = (activeActivityTab === "followUp" ? project.followUps : project.meetings) || [];

    return (
        <View className="px-4 pt-3">
            <View className="mb-3 flex-row items-center justify-between rounded-[12px] bg-[#4A43EC] p-1.5">
                {[
                    ["followUp", "Follow Up"],
                    ["meeting", "Meeting"],
                ].map(([key, label]) => {
                    const isActive = activeActivityTab === key;

                    return (
                        <TouchableOpacity
                            key={key}
                            activeOpacity={0.85}
                            onPress={() => onActivityTabChange(key)}
                            className={`h-8 flex-1 items-center justify-center rounded-[9px] ${isActive ? "bg-white" : "bg-[#4A43EC]"}`}
                        >
                            <Text className={`text-[12px] font-lato-bold ${isActive ? "text-[#4A43EC]" : "text-white"}`}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {items.map((item) =>
                activeActivityTab === "followUp" ? (
                    <FollowUpCard key={item.id} item={item} projectName={project.projectName} onDone={(activityId) => onActivityDone("followUp", activityId)} />
                ) : (
                    <MeetingCard key={item.id} item={item} projectName={project.projectName} projectId={project.id} onDone={(activityId) => onActivityDone("meeting", activityId)} />
                ),
            )}

            {!items.length ? (
                <View className="mt-16 items-center">
                    <Ionicons name="calendar-outline" size={32} color="#CBD5E1" />
                    <Text className="mt-3 text-[14px] font-lato-bold text-[#64748B]">No activity yet</Text>
                </View>
            ) : null}
        </View>
    );
}

// Map backend snake_case stage → display label used by getProjectJourney
const stageDisplayMap = {
    new_lead: "New Lead Added",
    first_contact: "First Contact",
    follow_up: "Follow-up",
    meeting_scheduled: "Meeting Scheduled",
    interested: "Interested",
    in_review: "In-Review",
    project_live: "Project live",
    rejected: "Rejected",
};

// Map backend follow_up values → UI shape
const normalizeFollowUps = (apiFollowUps = []) =>
    apiFollowUps.map((f) => ({
        id: String(f.id),
        projectId: String(f.lead_id),
        time: f.next_follow_up_at
            ? new Date(f.next_follow_up_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
            : "",
        note: f.remarks || f.next_action || "",
        status: f.follow_up_status
            ? f.follow_up_status.charAt(0).toUpperCase() + f.follow_up_status.slice(1)
            : "Warm",
        tone: f.follow_up_status === "hot" ? "hot" : f.follow_up_status === "cold" ? "warning" : "warning",
        isDone: f.is_completed === true,
        voice_note_url: f.voice_note_url || null,
        site_photo_url: f.site_photo_url || null,
        meta: {
            followUpType: f.follow_up_type,
            outcome: f.outcome,
            followUpStatus: f.follow_up_status,
            nextAction: f.next_action,
            nextFollowUpAt: f.next_follow_up_at,
        },
    }));

// Map backend meetings → UI shape
const normalizeMeetings = (apiMeetings = []) =>
    apiMeetings.map((m) => ({
        id: String(m.id),
        location: m.location_address || "",
        type: m.meeting_type
            ? m.meeting_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
            : "Meeting",
        time: m.meeting_at
            ? new Date(m.meeting_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
            : "",
        status: m.meeting_status
            ? m.meeting_status.charAt(0).toUpperCase() + m.meeting_status.slice(1)
            : "Scheduled",
        tone: m.meeting_status === "completed" ? "success" : "primary",
        isDone: m.meeting_status === "completed",
        meta: {
            scheduledAt: m.meeting_at,
            agenda: m.agenda || [],
            notes: m.notes_preparation || "",
            reminder: m.reminder_minutes,
        },
    }));

// Normalize API lead shape → internal project shape
const normalizeApiLead = (d, journey = [], follow_ups = [], meetings = []) => {
    const displayStage = stageDisplayMap[d.stage] || "New Lead Added";
    const stageHistory = journey.map((t) => ({
        stage: stageDisplayMap[t.stage] || t.stage,
        note: t.description || t.title || "",
        at: t.created_at,
    }));
    return {
        id: String(d.id),
        projectName: d.project_name || d.projectName || "",
        developerName: d.builder_name || d.developerName || "",
        contactPerson: d.contact_person || "",
        phoneNumber: d.contact_number || d.phoneNumber || "",
        city: d.city || "",
        location: d.area || d.location || "",
        area: d.area || "",
        colony: d.colony_landmark || "",
        fullAddress: d.full_address || "",
        category: d.property_category || "",
        projectType: (() => {
            let pts = d.property_types;
            if (typeof pts === "string") {
                try {
                    pts = JSON.parse(pts);
                } catch {
                    pts = null;
                }
            }
            return pts && Array.isArray(pts) && pts.length > 0
                ? pts.map(t => [t.main_type || t.category, t.sub_type || t.projectType, t.configuration || t.subType].filter(Boolean).join(" - ")).join(" | ")
                : [d.property_category, d.property_subtype, d.configuration].filter(Boolean).join(" . ");
        })(),
        type: d.lead_temperature
            ? d.lead_temperature.charAt(0).toUpperCase() + d.lead_temperature.slice(1)
            : "Warm",
        status: d.stage ? d.stage.replace(/_/g, " ") : "New Lead",
        statusType: d.stage || "new_lead",
        nextAction: d.next_action || d.remarks || "",
        lastContact: d.updated_at
            ? new Date(d.updated_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
            : "Not contacted",
        addedOn: d.created_at
            ? new Date(d.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
            : "",
        builderNotes: d.remarks || "",
        journeyStage: displayStage,
        onboardingProgress: d.onboarding_progress || 0,
        linkedProjectId: d.project_id || null,
        projectLastCompletedStep: d.project_last_completed_step || 0,
        stageHistory,
        followUps: normalizeFollowUps(follow_ups),
        meetings: normalizeMeetings(meetings),
        onboardingData: null,
        onboardingDraft: null,
    };
};

export default function ProjectDetail() {
    const router = useRouter();
    const { id, leadData } = useLocalSearchParams();
    const projectId = Array.isArray(id) ? id[0] : id;
    const dispatch = useDispatch();
    const [activeTab, setActiveTab] = useState("overview");
    const [activeActivityTab, setActiveActivityTab] = useState("followUp");
    const [activeSheet, setActiveSheet] = useState("followUp");
    const [submitting, setSubmitting] = useState(false);
    const bottomSheetRef = useRef(null);
    const sheetSnapPoints = useMemo(() => ["92%"], []);
    const reduxProject = useSelector((state) => selectProjectById(state, projectId));

    const [apiProject, setApiProject] = useState(() => {
        if (leadData) {
            try {
                const parsed = JSON.parse(leadData);
                return normalizeApiLead(parsed, [], [], []);
            } catch { return null; }
        }
        return null;
    });
    const [apiLoading, setApiLoading] = useState(!reduxProject);

    // Merge updated lead fields from any API response into apiProject
    const applyLeadUpdate = useCallback((updatedLead, extraFields = {}) => {
        if (!updatedLead) return;
        const displayStage = stageDisplayMap[updatedLead.stage] || "New Lead Added";
        setApiProject((prev) => {
            if (!prev) return prev;
            const alreadyHas = (prev.stageHistory || []).some((s) => s.stage === displayStage);
            return {
                ...prev,
                statusType: updatedLead.stage || prev.statusType,
                status: updatedLead.stage ? updatedLead.stage.replace(/_/g, " ") : prev.status,
                journeyStage: displayStage,
                type: updatedLead.lead_temperature
                    ? updatedLead.lead_temperature.charAt(0).toUpperCase() + updatedLead.lead_temperature.slice(1)
                    : prev.type,
                nextAction: updatedLead.next_action || prev.nextAction,
                onboardingProgress: updatedLead.onboarding_progress ?? prev.onboardingProgress,
                stageHistory: alreadyHas
                    ? prev.stageHistory
                    : [...(prev.stageHistory || []), {
                        stage: displayStage,
                        note: extraFields.note || "",
                        at: new Date().toISOString(),
                    }],
                ...extraFields,
            };
        });
    }, []);

    // Always fetch from API to get latest follow_ups + meetings with lead_id
    useEffect(() => {
        setApiLoading(!reduxProject);
        leadsAPI.getLeadDetails(projectId)
            .then((res) => {
                const inner = res?.data || res || {};
                const { lead, journey, follow_ups, meetings } = inner;
                if (lead) {
                    setApiProject(normalizeApiLead(lead, journey || [], follow_ups || [], meetings || []));
                }
            })
            .catch((err) => {
                console.log("getLeadDetails error", err?.response?.data || err?.message);
            })
            .finally(() => setApiLoading(false));
    }, [projectId, reduxProject]);

    const project = useMemo(
        () => apiProject || reduxProject,
        [reduxProject, apiProject],
    );
    const renderBackdrop = useCallback(
        (props) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.35} />,
        [],
    );

    const openSheet = useCallback((sheetName) => {
        setActiveSheet(sheetName);
        bottomSheetRef.current?.present();
    }, []);

    const closeSheet = useCallback(() => {
        bottomSheetRef.current?.dismiss();
    }, []);

    // Build FormData for follow-up (handles optional file attachments)
    const buildFollowUpPayload = (followUp) => {
        const { meta, voiceNoteFile, sitePhotoFile } = followUp;

        // Map UI follow-up status labels → backend enum values
        // Backend accepts: hot | warm | cold | suspended
        const statusValueMap = {
            "Hot":          "hot",
            "Warm":         "warm",
            "Cold":         "cold",
            "Docs Pending": "warm",   // no direct equivalent → warm
            "Overdue":      "cold",   // treat overdue as cold
            "Done":         "warm",   // completed state → warm fallback
        };

        // Map UI next-action labels → backend enum values
        // Backend accepts: schedule_another_call | schedule_meeting | send_company_profile |
        //                  collect_documents | start_onboarding
        const actionValueMap = {
            "Schedule another call":  "schedule_another_call",
            "Schedule meeting":       "schedule_meeting",
            "Send company profile":   "send_company_profile",
            "Collect documents":      "collect_documents",
            "Start onboarding":       "start_onboarding",
        };

        // Map UI follow-up type labels → backend enum values
        // Backend accepts: call | site_visit | office_visit | video_call
        const typeValueMap = {
            "Call":         "call",
            "Site Visit":   "site_visit",
            "Office Visit": "office_visit",
            "Video Call":   "video_call",
        };

        const follow_up_type   = typeValueMap[meta.followUpType]   || "call";
        const follow_up_status = statusValueMap[meta.followUpStatus] || "warm";
        const next_action      = actionValueMap[meta.nextAction]    || "schedule_another_call";

        // Map UI outcome labels → backend enum values
        // Backend accepts: connected | not_reachable | interested | need_more_time |
        //                  not_interested | documents_pending | meeting_requested
        const outcomeValueMap = {
            "No Response":               "not_reachable",
            "Call Later":                "need_more_time",
            "Builder Busy":              "not_reachable",
            "Interested":                "interested",
            "Need More Time":            "need_more_time",
            "Meeting Required":          "meeting_requested",
            "Site Visit Required":       "meeting_requested",
            "Documents Asked":           "documents_pending",
            "Pricing Discussion Pending":"need_more_time",
            "Not Interested":            "not_interested",
            "Onboarding Ready":          "interested",
        };
        const outcome = outcomeValueMap[meta.outcome] || "connected";

        if (!voiceNoteFile && !sitePhotoFile) {
            return {
                follow_up_type,
                outcome,
                follow_up_status,
                next_action,
                next_follow_up_at: meta.nextFollowUpAt,
                remarks: followUp.note || undefined,
            };
        }

        const form = new FormData();
        form.append("follow_up_type",    follow_up_type);
        form.append("outcome",           outcome);
        form.append("follow_up_status",  follow_up_status);
        form.append("next_action",       next_action);
        form.append("next_follow_up_at", meta.nextFollowUpAt);
        if (followUp.note) form.append("remarks", followUp.note);
        if (voiceNoteFile) {
            form.append("voice_note", { uri: voiceNoteFile.uri, name: "voice_note.m4a", type: "audio/m4a" });
        }
        if (sitePhotoFile) {
            form.append("site_photo", { uri: sitePhotoFile.uri, name: "site_photo.jpg", type: "image/jpeg" });
        }
        return form;
    };

    const saveFollowUp = useCallback(
        async (followUp) => {
            setSubmitting(true);
            try {
                const payload = buildFollowUpPayload(followUp);
                const res = await leadsAPI.createFollowUp(projectId, payload);
                const { followUp: saved, lead: updatedLead } = res.data || {};
                // Update local apiProject state with the saved follow-up and updated lead fields
                setApiProject((prev) => {
                    const base = prev || {};
                    const newFollowUp = saved
                        ? normalizeFollowUps([{ ...saved, lead_id: projectId }])[0]
                        : { ...followUp, id: followUp.id || String(Date.now()) };
                    const updatedFields = updatedLead ? {
                        type: updatedLead.lead_temperature
                            ? updatedLead.lead_temperature.charAt(0).toUpperCase() + updatedLead.lead_temperature.slice(1)
                            : base.type,
                        statusType: updatedLead.stage || base.statusType,
                        status: updatedLead.stage ? updatedLead.stage.replace(/_/g, " ") : base.status,
                        nextAction: updatedLead.next_action || base.nextAction,
                        onboardingProgress: updatedLead.onboarding_progress || base.onboardingProgress,
                    } : {};
                    return {
                        ...base,
                        ...updatedFields,
                        followUps: [newFollowUp, ...(base.followUps || [])],
                    };
                });
                // Keep Redux in sync for leads that are also in Redux store
                dispatch(addProjectFollowUp({ projectId, followUp }));
            } catch (err) {
                Alert.alert("Failed", err?.response?.data?.message || "Could not save follow-up. Please try again.");
                return; // don't close sheet on error
            } finally {
                setSubmitting(false);
            }
            closeSheet();
            setActiveTab("activity");
            setActiveActivityTab("followUp");
        },
        [closeSheet, dispatch, projectId],
    );

    const saveMeeting = useCallback(
        async (meeting) => {
            setSubmitting(true);
            try {
                const reminderMap = {
                    "No reminder": 0,
                    "15 minutes before": 15,
                    "30 minutes before": 30,
                    "1 hour before": 60,
                    "2 hours before": 120,
                    "1 day before": 1440,
                };
                const agendaValueMap = {
                    "Company Introduction": "company_introduction",
                    "Project Collaboration Discussion": "project_collaboration_discussion",
                    "Pricing Discussion": "pricing_discussion",
                    "Inventory Collection": "inventory_collection",
                    "Document Collection": "document_collection",
                };
                const meetingTypeValueMap = {
                    "Site Meeting": "site_meeting",
                    "Builder Office": "builder_office",
                    "SquarFT Office": "squarft_office",
                    "Phone": "phone",
                    "Video Call": "video_call",
                };
                const meetingStatusValueMap = {
                    "Scheduled": "scheduled",
                    "Today": "scheduled",
                    "Tomorrow": "scheduled",
                    "Planned": "scheduled",
                    "Done": "completed",
                };
                const payload = {
                    meeting_type: meetingTypeValueMap[meeting.type] || "site_meeting",
                    meeting_status: meetingStatusValueMap[meeting.status] || "scheduled",
                    meeting_at: meeting.meta.scheduledAt,
                    location_address: meeting.location || "To be confirmed",
                    agenda: (meeting.meta.agenda || []).map((a) => agendaValueMap[a] || a),
                    notes_preparation: meeting.meta.notes || undefined,
                    reminder_minutes: reminderMap[meeting.meta.reminder] ?? 30,
                };
                const res = await leadsAPI.scheduleMeeting(projectId, payload);
                const { meeting: saved, lead: updatedLead } = res.data || {};
                setApiProject((prev) => {
                    const base = prev || {};
                    const newMeeting = saved
                        ? normalizeMeetings([{ ...saved, lead_id: projectId }])[0]
                        : { ...meeting, id: meeting.id || String(Date.now()) };
                    const updatedFields = updatedLead ? {
                        statusType: updatedLead.stage || base.statusType,
                        status: updatedLead.stage ? updatedLead.stage.replace(/_/g, " ") : base.status,
                        nextAction: updatedLead.next_action || base.nextAction,
                        onboardingProgress: updatedLead.onboarding_progress || base.onboardingProgress,
                    } : {};
                    return {
                        ...base,
                        ...updatedFields,
                        meetings: [newMeeting, ...(base.meetings || [])],
                    };
                });
                dispatch(addProjectMeeting({ projectId, meeting }));
            } catch (err) {
                Alert.alert("Failed", err?.response?.data?.message || "Could not schedule meeting. Please try again.");
                return;
            } finally {
                setSubmitting(false);
            }
            closeSheet();
            setActiveTab("activity");
            setActiveActivityTab("meeting");
        },
        [closeSheet, dispatch, projectId],
    );

    const callProject = useCallback(() => {
        dispatch(markProjectContacted(projectId));
        openUrl(`tel:${project?.phoneNumber || ""}`);
        leadsAPI.recordCall(projectId)
            .then((res) => {
                if (res?.data?.lead) {
                    const { stage, onboarding_progress } = res.data.lead;
                    const displayStage = stageDisplayMap[stage] || "First Contact";
                    setApiProject((prev) => {
                        if (!prev) return prev;
                        const alreadyHas = (prev.stageHistory || []).some((s) => s.stage === displayStage);
                        return {
                            ...prev,
                            statusType: stage || prev.statusType,
                            status: stage ? stage.replace(/_/g, " ") : prev.status,
                            journeyStage: displayStage,
                            onboardingProgress: onboarding_progress || prev.onboardingProgress,
                            stageHistory: alreadyHas
                                ? prev.stageHistory
                                : [...(prev.stageHistory || []), { stage: displayStage, note: "Call initiated", at: new Date().toISOString() }],
                        };
                    });
                }
            })
            .catch(() => {});
    }, [dispatch, project?.phoneNumber, projectId]);

    const markActivityDone = useCallback(
        async (activityType, activityId) => {
            try {
                // leadId is always the current screen's projectId
                // activityId is the follow-up/meeting UUID
                if (activityType === "followUp") {
                    await leadsAPI.updateFollowUpCompletion(projectId, activityId, true);
                    setApiProject((prev) => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            followUps: prev.followUps.map((f) =>
                                f.id === activityId ? { ...f, isDone: true } : f,
                            ),
                        };
                    });
                } else {
                    await leadsAPI.updateMeetingCompletion(projectId, activityId, true);
                    setApiProject((prev) => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            meetings: prev.meetings.map((m) =>
                                m.id === activityId ? { ...m, isDone: true, status: "Completed" } : m,
                            ),
                        };
                    });
                }
                dispatch(markProjectActivityDone({ projectId, activityType, activityId }));
                Alert.alert("Done", activityType === "followUp" ? "Follow-up marked as completed." : "Meeting marked as completed.");
            } catch (err) {
                console.log("markActivityDone error", err?.response?.data || err?.message);
                Alert.alert("Failed", err?.response?.data?.message || "Could not mark as done. Please try again.");
            }
        },
        [dispatch, projectId],
    );

    const rejectLead = useCallback(() => {
        dispatch(rejectProjectLead(projectId));
    }, [dispatch, projectId]);

    if (!project) {
        return (
            <View className="flex-1 bg-white">
                <SafeAreaView className="flex-1 items-center justify-center px-6">
                    {apiLoading ? (
                        <ActivityIndicator size="large" color="#4A43EC" />
                    ) : (
                        <>
                            <Text className="text-[18px] font-lato-bold text-[#111827]">Project not found</Text>
                            <TouchableOpacity onPress={() => router.back()} className="mt-4 h-10 justify-center rounded-[10px] bg-[#4A43EC] px-5">
                                <Text className="font-lato-bold text-white">Go Back</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </SafeAreaView>
            </View>
        );
    }

    const typeStyle = typeStyles[project.type] ?? typeStyles.Warm;
    const statusStyle = statusStyles[project.statusType] ?? statusStyles.followUp;

    return (
        <>
            <View className="flex-1 bg-white">
                <StatusBar style="light" />
                <SafeAreaView className="flex-1 bg-[#4A43EC]" edges={["top"]}>
                    <View className="bg-[#4A43EC] px-4 pb-3 pt-1">
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => router.back()}
                            className="mb-3 h-9 w-9 items-start justify-center"
                        >
                            <Ionicons name="arrow-back" size={26} color="#fff" />
                        </TouchableOpacity>

                        <View className="flex-row items-start justify-between">
                            <View className="mr-4 flex-1">
                                <Text className="text-[20px] font-lato-bold text-white" numberOfLines={1}>
                                    {project.projectName}
                                </Text>
                                <Text className="mt-0.5 text-[12px] text-white/90">{project.developerName}</Text>
                                <View className="mt-2 flex-row items-center">
                                    <Ionicons name="location-outline" size={12} color="#DDE2FF" />
                                    <Text className="ml-1 text-[11px] text-[#DDE2FF]">
                                        {[project.location, project.city].filter(Boolean).join(", ")}
                                    </Text>
                                </View>
                            </View>
                            <View className="items-end">
                                <Badge label={`${project.type} Lead`} styleSet={typeStyle} />
                                <View className="mt-2">
                                    <Badge label={project.status} styleSet={statusStyle} />
                                </View>
                            </View>
                        </View>

                        <View className="mt-3 flex-row items-center justify-between">
                            <Text className="text-[11px] text-white/90">Onboarding Progress</Text>
                            <Text className="text-[12px] font-lato-bold text-white">{project.onboardingProgress || 0}%</Text>
                        </View>
                        <ProgressBar value={project.onboardingProgress || 0} color="#FFFFFF" trackColor="rgba(255,255,255,0.28)" height={7} />
                    </View>

                    <View className="flex-1 bg-white">
                        <View className="flex-row border-b border-[#E5E7EB] bg-white px-4 py-2.5">
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={callProject}
                                className="mr-2 h-8 flex-row items-center justify-center rounded-[8px] bg-[#4A43EC] px-3"
                            >
                                <Ionicons name="call-outline" size={12} color="#fff" />
                                <Text className="ml-1.5 text-[10px] font-lato-bold text-white">Call</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => openSheet("followUp")}
                                className="mr-2 h-8 flex-row items-center justify-center rounded-[8px] border border-[#E2E8F0] px-2.5"
                            >
                                <Ionicons name="add" size={12} color="#111827" />
                                <Text className="ml-1 text-[10px] font-lato-bold text-[#111827]">Follow-up</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => openSheet("meeting")}
                                className="h-8 flex-row items-center justify-center rounded-[8px] border border-[#E2E8F0] px-2.5"
                            >
                                <Ionicons name="calendar-outline" size={12} color="#111827" />
                                <Text className="ml-1 text-[10px] font-lato-bold text-[#111827]">Meeting</Text>
                            </TouchableOpacity>
                        </View>

                        <View className="flex-row border-b border-[#E5E7EB] bg-white">
                            {[
                                ["overview", "Overview"],
                                ["activity", "Activity"],
                            ].map(([key, label]) => {
                                const isActive = activeTab === key;

                                return (
                                    <TouchableOpacity
                                        key={key}
                                        activeOpacity={0.85}
                                        onPress={() => setActiveTab(key)}
                                        className={`h-10 flex-1 items-center justify-center border-b-2 ${
                                            isActive ? "border-[#4A43EC]" : "border-transparent"
                                        }`}
                                    >
                                        <Text className={`text-[12px] ${isActive ? "font-lato-bold text-[#4A43EC]" : "text-[#475569]"}`}>
                                            {label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
                            {activeTab === "overview" ? (
                                <Overview project={project} onReject={rejectLead} />
                            ) : (
                                <Activity
                                    project={project}
                                    activeActivityTab={activeActivityTab}
                                    onActivityTabChange={setActiveActivityTab}
                                    onActivityDone={markActivityDone}
                                />
                            )}
                        </ScrollView>
                    </View>
                </SafeAreaView>
            </View>
            <BottomSheetModal
                ref={bottomSheetRef}
                index={0}
                snapPoints={sheetSnapPoints}
                backdropComponent={renderBackdrop}
                enablePanDownToClose
                keyboardBehavior="extend"
                keyboardBlurBehavior="restore"
                android_keyboardInputMode="adjustResize"
                backgroundStyle={{ backgroundColor: "#F8FAFC" }}
                handleIndicatorStyle={{ backgroundColor: "transparent" }}
            >
                {activeSheet === "followUp" ? (
                    <FollowUpForm project={project} onSave={saveFollowUp} submitting={submitting} />
                ) : (
                    <MeetingForm project={project} onSave={saveMeeting} submitting={submitting} />
                )}
            </BottomSheetModal>
        </>
    );
}
