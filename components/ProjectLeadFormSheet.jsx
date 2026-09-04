import { Ionicons } from "@expo/vector-icons";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Image, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch } from "react-redux";
import { leadsAPI } from "../services/api";
import { fetchDashboard } from "../store/slices/dashboardSlice";

const STEPS = ["Project", "Stage", "Notes"];
const DEFAULT_STAGE = "new_lead";
const durationLabel = (ms = 0) => { const seconds = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; };
const audioAsset = (uri) => {
    const detected = uri?.split("?")[0]?.split(".").pop()?.toLowerCase();
    const extension = ["aac", "amr", "mp3", "m4a", "mp4", "ogg", "wav", "webm"].includes(detected) ? detected : "m4a";
    const mime = { aac: "audio/aac", amr: "audio/amr", mp3: "audio/mpeg", m4a: "audio/m4a", mp4: "audio/mp4", ogg: "audio/ogg", wav: "audio/wav", webm: "audio/webm" };
    return { uri, name: `project-lead-note.${extension}`, type: mime[extension] };
};

export default function ProjectLeadFormSheet({ visible, translateY, screenHeight, onClose }) {
    const dispatch = useDispatch();
    const wasVisible = useRef(false);
    const scrollRef = useRef(null);
    const [step, setStep] = useState(0);
    const [projects, setProjects] = useState([]);
    const [stages, setStages] = useState([]);
    const [projectId, setProjectId] = useState(null);
    const [stage, setStage] = useState(DEFAULT_STAGE);
    const [notes, setNotes] = useState("");
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [saving, setSaving] = useState(false);
    const [voiceUri, setVoiceUri] = useState(null);
    const [voiceDuration, setVoiceDuration] = useState(0);
    const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recorderState = useAudioRecorderState(recorder, 250);
    const player = useAudioPlayer(voiceUri ? { uri: voiceUri } : null, { updateInterval: 250 });
    const playerState = useAudioPlayerStatus(player);

    const selectedProject = projects.find((item) => item.id === projectId);
    const filteredProjects = useMemo(() => {
        const query = search.trim().toLowerCase();
        return query ? projects.filter((item) => [item.name, item.builder_name, item.location].some((value) => String(value || "").toLowerCase().includes(query))) : projects;
    }, [projects, search]);

    const reset = () => { setStep(0); setProjectId(null); setStage(DEFAULT_STAGE); setNotes(""); setSearch(""); setVoiceUri(null); setVoiceDuration(0); setLoadError(""); };
    const loadOptions = async () => {
        try {
            setLoading(true); setLoadError("");
            const response = await leadsAPI.getFormOptions();
            const data = response?.data || {};
            setProjects(Array.isArray(data.projects) ? data.projects : []);
            setStages(Array.isArray(data.stages) ? data.stages : []);
            setStage(data.default_stage || DEFAULT_STAGE);
        } catch (error) { setLoadError(error?.response?.data?.message || "Could not load projects. Please try again."); }
        finally { setLoading(false); }
    };
    useEffect(() => {
        if (visible && !wasVisible.current) { reset(); loadOptions(); }
        wasVisible.current = visible;
    }, [visible]);
    useEffect(() => { if (playerState.didJustFinish) player.seekTo(0); }, [player, playerState.didJustFinish]);

    const close = async () => {
        if (recorderState.isRecording) { try { await recorder.stop(); } catch (_error) { /* no-op */ } }
        if (playerState.playing) player.pause();
        onClose();
    };
    const startRecording = async () => {
        try {
            const permission = await requestRecordingPermissionsAsync();
            if (!permission.granted) return Alert.alert("Microphone permission needed", "Allow microphone access to attach a voice note.");
            if (playerState.playing) player.pause();
            setVoiceUri(null); setVoiceDuration(0);
            await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
            await recorder.prepareToRecordAsync(); recorder.record();
        } catch (_error) { Alert.alert("Recording failed", "Could not start recording. Please try again."); }
    };
    const stopRecording = async () => {
        try {
            const duration = recorderState.durationMillis || 0;
            await recorder.stop();
            await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
            if (recorder.uri) { setVoiceUri(recorder.uri); setVoiceDuration(duration); }
        } catch (_error) { Alert.alert("Recording failed", "The voice note could not be saved."); }
    };
    const togglePlayback = async () => {
        if (!voiceUri) return;
        if (playerState.playing) return player.pause();
        if (playerState.didJustFinish) await player.seekTo(0);
        player.play();
    };
    const next = () => {
        if (step === 0 && !projectId) return Alert.alert("Select a project", "Choose the project this lead belongs to.");
        if (step === 1 && !stage) return Alert.alert("Select a stage", "Choose the lead's current stage.");
        setStep((current) => Math.min(current + 1, 2)); scrollRef.current?.scrollToPosition?.(0, 0, true);
    };
    const save = async () => {
        const cleanNotes = notes.trim();
        if (!cleanNotes) return Alert.alert("Notes required", "Add a short note explaining this lead.");
        try {
            setSaving(true);
            const payload = new FormData();
            payload.append("project_id", projectId); payload.append("stage", stage); payload.append("remarks", cleanNotes);
            if (voiceUri) { payload.append("voice_note_duration_ms", String(voiceDuration)); payload.append("voice_note", audioAsset(voiceUri)); }
            await leadsAPI.createLead(payload);
            dispatch(fetchDashboard());
            Alert.alert("Lead added", `${selectedProject?.name || "Project"} was added to your pipeline.`);
            close();
        } catch (error) { Alert.alert("Could not add lead", error?.response?.data?.message || "Please check your connection and try again."); }
        finally { setSaving(false); }
    };

    const projectStep = () => <>
        <Text style={styles.heading}>Choose an existing project</Text>
        <Text style={styles.subheading}>Projects and builder information come directly from the Project Panel.</Text>
        <View style={styles.searchBox}><Ionicons name="search-outline" size={19} color="#788197" /><TextInput value={search} onChangeText={setSearch} placeholder="Search project, builder or city" placeholderTextColor="#9CA3AF" style={styles.searchInput} />{!!search && <TouchableOpacity onPress={() => setSearch("")}><Ionicons name="close-circle" size={19} color="#A1A8B7" /></TouchableOpacity>}</View>
        {loading ? <View style={styles.center}><ActivityIndicator color="#4A43EC" /><Text style={styles.muted}>Loading projects…</Text></View> : loadError ? <View style={styles.empty}><Ionicons name="cloud-offline-outline" size={34} color="#E45858" /><Text style={styles.emptyTitle}>{loadError}</Text><TouchableOpacity style={styles.retry} onPress={loadOptions}><Text style={styles.retryText}>Try again</Text></TouchableOpacity></View> : filteredProjects.length === 0 ? <View style={styles.empty}><Ionicons name="business-outline" size={34} color="#A4AABA" /><Text style={styles.emptyTitle}>{search ? "No matching projects" : "No active projects available"}</Text><Text style={styles.emptyBody}>{search ? "Try another search." : "Add a project in the Project Panel first."}</Text></View> : filteredProjects.map((project) => {
            const selected = projectId === project.id;
            return <TouchableOpacity key={project.id} activeOpacity={0.86} onPress={() => setProjectId(project.id)} style={[styles.card, selected && styles.selected]}>
                {project.cover_image_url ? <Image source={{ uri: project.cover_image_url }} style={styles.image} /> : <View style={styles.imageFallback}><Ionicons name="business" size={25} color="#716BF2" /></View>}
                <View style={styles.grow}><View style={styles.rowBetween}><Text style={styles.projectName} numberOfLines={1}>{project.name}</Text><Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={22} color={selected ? "#4A43EC" : "#CBD0DA"} /></View><Text style={styles.builder} numberOfLines={1}>{project.builder_name || "Builder details not provided"}</Text>{!!project.location && <View style={styles.metaRow}><Ionicons name="location-outline" size={14} color="#7C8495" /><Text style={styles.meta} numberOfLines={1}>{project.location}</Text></View>}{!!project.builder_phone && <View style={styles.metaRow}><Ionicons name="call-outline" size={14} color="#7C8495" /><Text style={styles.meta}>{project.builder_phone}</Text></View>}{!!project.builder_email && <View style={styles.metaRow}><Ionicons name="mail-outline" size={14} color="#7C8495" /><Text style={styles.meta} numberOfLines={1}>{project.builder_email}</Text></View>}</View>
            </TouchableOpacity>;
        })}
    </>;
    const stageStep = () => <>
        <Text style={styles.heading}>Select the lead stage</Text><Text style={styles.subheading}>New Lead is selected by default. Change it only if contact has already progressed.</Text>
        {stages.map((item) => { const selected = stage === item.value; return <TouchableOpacity key={item.value} style={[styles.stageCard, selected && styles.selected]} onPress={() => setStage(item.value)}><View style={[styles.stageIcon, selected && styles.stageIconSelected]}><Ionicons name="flag-outline" size={20} color={selected ? "#FFF" : "#4A43EC"} /></View><View style={styles.grow}><Text style={styles.stageTitle}>{item.label}</Text><Text style={styles.meta}>{item.progress}% pipeline progress</Text></View><Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={22} color={selected ? "#4A43EC" : "#CBD0DA"} /></TouchableOpacity>; })}
    </>;
    const notesStep = () => <>
        <Text style={styles.heading}>Add lead details</Text><Text style={styles.subheading}>These notes and the optional voice recording will be visible to the admin team.</Text>
        <View style={styles.summary}><Ionicons name="business-outline" size={21} color="#4A43EC" /><View style={styles.grow}><Text style={styles.projectName}>{selectedProject?.name}</Text><Text style={styles.builder}>{selectedProject?.builder_name || "Builder details not provided"}</Text></View></View>
        <Text style={styles.label}>Notes <Text style={styles.required}>*</Text></Text><TextInput value={notes} onChangeText={setNotes} placeholder="Add context, discussion details or the next action…" placeholderTextColor="#9CA3AF" multiline maxLength={2000} textAlignVertical="top" style={styles.notes} autoFocus /><Text style={styles.counter}>{notes.length}/2000</Text>
        <Text style={styles.label}>Voice note <Text style={styles.optional}>(optional)</Text></Text>
        {recorderState.isRecording ? <View style={styles.audio}><View style={styles.dot} /><View style={styles.grow}><Text style={styles.stageTitle}>Recording…</Text><Text style={styles.meta}>{durationLabel(recorderState.durationMillis)}</Text></View><TouchableOpacity style={styles.stop} onPress={stopRecording}><Ionicons name="stop" size={18} color="#FFF" /></TouchableOpacity></View> : voiceUri ? <View style={styles.audio}><TouchableOpacity style={styles.play} onPress={togglePlayback}><Ionicons name={playerState.playing ? "pause" : "play"} size={18} color="#FFF" /></TouchableOpacity><View style={styles.grow}><Text style={styles.stageTitle}>Voice note ready</Text><Text style={styles.meta}>{durationLabel(voiceDuration)}</Text></View><TouchableOpacity onPress={() => { if (playerState.playing) player.pause(); setVoiceUri(null); setVoiceDuration(0); }}><Ionicons name="trash-outline" size={20} color="#E45858" /></TouchableOpacity></View> : <TouchableOpacity style={styles.record} onPress={startRecording}><Ionicons name="mic-outline" size={21} color="#4A43EC" /><Text style={styles.recordText}>Record voice note</Text></TouchableOpacity>}
    </>;

    return <Modal visible={visible} transparent animationType="none" onRequestClose={close}><Pressable style={styles.backdrop} onPress={close} /><Animated.View style={[styles.sheet, { height: Math.min(screenHeight * 0.92, 820), transform: [{ translateY }] }]}><SafeAreaView edges={["bottom"]} style={styles.safe}><View style={styles.handle} /><View style={styles.header}><TouchableOpacity onPress={step ? () => setStep(step - 1) : close} style={styles.iconButton}><Ionicons name={step ? "arrow-back" : "close"} size={22} color="#202538" /></TouchableOpacity><View style={styles.headerText}><Text style={styles.title}>Add Project Lead</Text><Text style={styles.headerSub}>{STEPS[step]} · Step {step + 1} of 3</Text></View><View style={styles.iconButton} /></View><View style={styles.track}><View style={[styles.fill, { width: `${((step + 1) / 3) * 100}%` }]} /></View><KeyboardAwareScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled" enableOnAndroid extraScrollHeight={72}>{step === 0 ? projectStep() : step === 1 ? stageStep() : notesStep()}</KeyboardAwareScrollView><View style={styles.footer}>{step > 0 && <TouchableOpacity style={styles.secondary} onPress={() => setStep(step - 1)} disabled={saving}><Text style={styles.secondaryText}>Back</Text></TouchableOpacity>}<TouchableOpacity style={[styles.primary, (saving || (step === 0 && (loading || !projects.length))) && styles.disabled]} onPress={step === 2 ? save : next} disabled={saving || (step === 0 && (loading || !projects.length))}>{saving ? <ActivityIndicator color="#FFF" /> : <><Text style={styles.primaryText}>{step === 2 ? "Add lead" : "Continue"}</Text><Ionicons name={step === 2 ? "checkmark" : "arrow-forward"} size={18} color="#FFF" /></>}</TouchableOpacity></View></SafeAreaView></Animated.View></Modal>;
}

const styles = StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(18,22,35,0.46)" }, sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#FFF", borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden" }, safe: { flex: 1 }, handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: "#D9DCE5", alignSelf: "center", marginTop: 10 },
    header: { height: 68, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 }, iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" }, headerText: { flex: 1, alignItems: "center" }, title: { fontSize: 18, fontFamily: "Lato_700Bold", color: "#15192A" }, headerSub: { marginTop: 2, fontSize: 12, fontFamily: "Lato_400Regular", color: "#7B8293" }, track: { height: 3, backgroundColor: "#EEEFFC" }, fill: { height: 3, backgroundColor: "#4A43EC" },
    content: { flex: 1 }, contentInner: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 30 }, heading: { fontSize: 21, fontFamily: "Lato_700Bold", color: "#15192A" }, subheading: { marginTop: 6, marginBottom: 18, fontSize: 13, lineHeight: 19, fontFamily: "Lato_400Regular", color: "#697184" }, searchBox: { height: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderRadius: 14, backgroundColor: "#F6F7FA", borderWidth: 1, borderColor: "#E9EAF0", marginBottom: 14 }, searchInput: { flex: 1, marginHorizontal: 9, fontSize: 14, fontFamily: "Lato_400Regular", color: "#202538" },
    center: { paddingVertical: 52, alignItems: "center", gap: 10 }, muted: { fontSize: 13, fontFamily: "Lato_400Regular", color: "#7B8293" }, empty: { marginTop: 18, padding: 28, borderRadius: 18, alignItems: "center", backgroundColor: "#F8F9FC" }, emptyTitle: { marginTop: 10, fontSize: 14, fontFamily: "Lato_700Bold", textAlign: "center", color: "#34394B" }, emptyBody: { marginTop: 5, fontSize: 12, color: "#7B8293", textAlign: "center" }, retry: { marginTop: 14, paddingHorizontal: 18, paddingVertical: 9, backgroundColor: "#4A43EC", borderRadius: 10 }, retryText: { color: "#FFF", fontFamily: "Lato_700Bold", fontSize: 13 },
    card: { flexDirection: "row", padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#EAEBF0", borderRadius: 16 }, selected: { borderColor: "#4A43EC", backgroundColor: "#F7F6FF" }, image: { width: 64, height: 64, borderRadius: 12, backgroundColor: "#EEEFFC" }, imageFallback: { width: 64, height: 64, borderRadius: 12, backgroundColor: "#EEEFFC", alignItems: "center", justifyContent: "center" }, grow: { flex: 1, marginLeft: 12 }, rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, projectName: { flex: 1, marginRight: 8, fontSize: 15, fontFamily: "Lato_700Bold", color: "#202538" }, builder: { marginTop: 3, fontSize: 12, fontFamily: "Lato_700Bold", color: "#636B7D" }, metaRow: { flexDirection: "row", alignItems: "center", marginTop: 5 }, meta: { marginLeft: 4, fontSize: 12, color: "#7C8495", flexShrink: 1 },
    stageCard: { minHeight: 70, flexDirection: "row", alignItems: "center", padding: 13, marginBottom: 10, borderWidth: 1, borderColor: "#EAEBF0", borderRadius: 15 }, stageIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#EEEFFC", alignItems: "center", justifyContent: "center" }, stageIconSelected: { backgroundColor: "#4A43EC" }, stageTitle: { fontSize: 14, fontFamily: "Lato_700Bold", color: "#202538" }, summary: { flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: "#F7F6FF", borderRadius: 14, marginBottom: 20 }, label: { marginBottom: 8, fontSize: 13, fontFamily: "Lato_700Bold", color: "#34394B" }, required: { color: "#E45858" }, optional: { color: "#8A91A1", fontFamily: "Lato_400Regular" }, notes: { minHeight: 142, borderWidth: 1, borderColor: "#DFE2E9", borderRadius: 14, padding: 14, fontSize: 14, lineHeight: 20, color: "#202538" }, counter: { textAlign: "right", marginTop: 5, marginBottom: 18, fontSize: 11, color: "#969DAC" },
    audio: { minHeight: 64, flexDirection: "row", alignItems: "center", padding: 12, borderWidth: 1, borderColor: "#E1E3EA", borderRadius: 14, backgroundColor: "#FAFAFC" }, record: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderColor: "#AAA6F8", borderRadius: 14, backgroundColor: "#F8F7FF" }, recordText: { marginLeft: 8, fontSize: 13, fontFamily: "Lato_700Bold", color: "#4A43EC" }, play: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#4A43EC", alignItems: "center", justifyContent: "center" }, stop: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#E45858", alignItems: "center", justifyContent: "center" }, dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#E45858", marginHorizontal: 10 },
    footer: { flexDirection: "row", paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, borderTopWidth: 1, borderTopColor: "#ECEEF3", gap: 10 }, secondary: { height: 50, minWidth: 92, borderRadius: 14, borderWidth: 1, borderColor: "#DDE0E8", alignItems: "center", justifyContent: "center" }, secondaryText: { fontSize: 14, fontFamily: "Lato_700Bold", color: "#596174" }, primary: { height: 50, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, backgroundColor: "#4A43EC" }, primaryText: { color: "#FFF", fontSize: 14, fontFamily: "Lato_700Bold" }, disabled: { opacity: 0.5 },
});
