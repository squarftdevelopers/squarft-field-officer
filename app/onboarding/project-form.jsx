/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Image,
    Dimensions,
    TextInput,
    Platform,
    Pressable,
    Keyboard,
    TouchableWithoutFeedback,
    Modal,
    ActivityIndicator,
    Linking,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Location from "expo-location";
import { useDispatch, useSelector } from "react-redux";
import {
    setStep,
    updateStep1,
    addPropertyType,
    removePropertyType,
    updatePropertyType,
    updateBuilderData,
    updateStep4,
    updateStep4Approval,
    updateStep5,
    updateStep6,
    bulkUploadProject,
    bulkUploadSubtype,
    resetForm,
    setProjectId,
    setUploadMode,
} from "../../store/slices/projectSlice";
import { completeProjectOnboarding, saveProjectOnboardingDraft, selectProjectById } from "../../store/slices/projectsSlice";
import { addNotification } from "../../store/slices/notificationSlice";
import { projectFormApi, leadsAPI, projectMembersAPI } from "../../services/api";
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const mainTypes = [
    {
        id: "residential",
        label: "Residential",
        image: require("../../assets/icons/property-types/House2.png"),
        cloudImage: require("../../assets/icons/property-types/Clouds.png"),
    },
    {
        id: "commercial",
        label: "Commercial",
        image: require("../../assets/icons/property-types/commercial.png"),
    },
];

const subTypesData = {
    residential: [
        { id: "plot", label: "Plot", image: require("../../assets/icons/property-types/plot.png") },
        { id: "villa", label: "Villa", image: require("../../assets/icons/property-types/villa.png") },
        { id: "apartment", label: "Apartment", image: require("../../assets/icons/property-types/apartment.png") },
        { id: "rowhouse", label: "Rowhouse", image: require("../../assets/icons/property-types/rowhouse.png") },
    ],
    commercial: [
        { id: "shop", label: "Shop", image: require("../../assets/icons/property-types/Shop.png") },
        { id: "showroom", label: "Showroom", image: require("../../assets/icons/property-types/showroom.png") },
        { id: "office", label: "Office", image: require("../../assets/icons/property-types/office.png") },
    ]
};

const bhkOptions = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "5 BHK", "5 BHK+"];
const officeTypes = ["Co-working", "Ready to Move", "Bare Shell"];
const areaUnits = [
    'Sq-ft', 'Sq-yrd', 'Sq-m', 'Acre', 'Bigha', 
    'Hectare', 'Guntha', 'Kanal', 'Marla', 'Biswa', 'Kottah'
];

const steps = [
    { id: 1, title: "Basic Details" },
    { id: 2, title: "Property Type" },
    { id: 3, title: "Property Detail" },
    { id: 4, title: "Approvals" },
    { id: 5, title: "Finance" },
    { id: 6, title: "Image & Price" },
];

const ANDROID_KEYBOARD_EXTRA_SCROLL = 72;
const ANDROID_KEYBOARD_EXTRA_HEIGHT = 240;
const IOS_KEYBOARD_EXTRA_SCROLL = 40;
const IOS_KEYBOARD_EXTRA_HEIGHT = 66;
const ANDROID_CONTENT_BOTTOM_PADDING = 180;
const IOS_CONTENT_BOTTOM_PADDING = 140;
const RANGE_BASED_SUB_TYPES = new Set(["plot", "villa", "rowhouse"]);
const DEVELOPMENT_STAGE_OPTIONS = [
    "Road work completed",
    "Drainage work completed",
    "Electricity work completed",
    "Water line completed",
    "Boundary wall completed",
    "Garden / Park work completed",
    "Street lights completed",
    "Main gate completed",
    "Clubhouse / Amenities work completed",
    "Work in progress",
    "Other",
];
const APPROVAL_STATUS_OPTIONS = ["Yes", "No"];
const OPTIONAL_APPROVAL_STATUS_OPTIONS = ["Yes", "No", "Not Applicable"];
const OVERALL_APPROVAL_STATUS_OPTIONS = [
    "All approvals completed",
    "Major approvals completed",
    "Some approvals pending",
    "Approvals under process",
    "Not verified yet",
];
const GUIDELINE_VALUE_UNITS = ["Per Sq. Ft.", "Per Sq. Meter", "Per Acre", "Per Hectare"];
const OWNERSHIP_TYPES = [
    "Owned Project",
    "Joint Venture Project",
    "Development Agreement Project",
    "Collaboration Project",
    "Other",
];

const normalizeApiDate = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value.split("T")[0];
    if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString().split("T")[0];
    return String(value);
};

const resolveApprovalStatusFromApi = (approval) => {
    if (!approval) return "";
    if (approval.is_approved === true) return "Yes";
    if (approval.is_approved === false && approval.expected_time) return "No";
    return "";
};

const mapStep4ApprovalFromApi = (approvalKey, approval) => {
    if (!approval) return {};
    const data = {
        status: resolveApprovalStatusFromApi(approval),
        expectedTime: approval.expected_time || "",
        documents: approval.documents || [],
    };

    switch (approvalKey) {
        case "diversion":
            data.referenceNumber = approval.referenceNumber || "";
            data.approvalDate = normalizeApiDate(approval.approvalDate);
            break;
        case "tncp":
            data.approvalNumber = approval.referenceNumber || "";
            data.approvalDate = normalizeApiDate(approval.approvalDate);
            break;
        case "developmentPermission":
            data.permissionNumber = approval.referenceNumber || "";
            data.permissionDate = normalizeApiDate(approval.approvalDate);
            break;
        case "rera":
            data.registrationNumber = approval.rera_id || "";
            data.registrationDate = normalizeApiDate(approval.approvalDate);
            break;
        case "buildingPermission":
            data.permissionNumber = approval.referenceNumber || "";
            data.permissionDate = normalizeApiDate(approval.approvalDate);
            break;
        default:
            break;
    }

    return data;
};

const buildStep4ApprovalPayload = (approvalKey, approval) => {
    if (!approval.status || approval.status === "Not Applicable") {
        return { is_approved: false, expected_time: null };
    }

    const isApproved = approval.status === "Yes";
    const payload = {
        is_approved: isApproved,
        expected_time: isApproved ? null : (approval.expectedTime || null),
        documents: approval.documents || [],
    };

    switch (approvalKey) {
        case "diversion":
            payload.referenceNumber = approval.referenceNumber || null;
            payload.approvalDate = approval.approvalDate || null;
            break;
        case "tncp":
            payload.referenceNumber = approval.approvalNumber || null;
            payload.approvalDate = approval.approvalDate || null;
            break;
        case "developmentPermission":
            payload.referenceNumber = approval.permissionNumber || null;
            payload.approvalDate = approval.permissionDate || null;
            break;
        case "rera":
            payload.rera_id = approval.registrationNumber || null;
            payload.approvalDate = approval.registrationDate || null;
            break;
        case "buildingPermission":
            payload.referenceNumber = approval.permissionNumber || null;
            payload.approvalDate = approval.permissionDate || null;
            break;
        default:
            break;
    }

    return payload;
};

const shouldUseProjectFormApi = Boolean(process.env.EXPO_PUBLIC_API_BASE_URL);

export default function AddProject() {
    const dispatch = useDispatch();
    const { projectId: routeProjectId, id: routeId } = useLocalSearchParams();
    const { currentStep, step1, step2, step3, step4, step5, step6 } = useSelector((state) => state.project);
    const projectId = useSelector((state) => state.project.projectId);
    const leadProjectId = routeProjectId || routeId;
    const existingProject = useSelector((state) => selectProjectById(state, leadProjectId));
    const scrollRef = useRef(null);
    const [step1Errors, setStep1Errors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [draftReady, setDraftReady] = useState(false);

    useEffect(() => {
        scrollRef.current?.scrollToPosition?.(0, 0, false);
        scrollRef.current?.scrollTo?.({ y: 0, animated: false });
    }, [currentStep]);

    useEffect(() => {
        setDraftReady(false);
        dispatch(resetForm());
        if (existingProject?.onboardingDraft?.form) {
            dispatch(bulkUploadProject(existingProject.onboardingDraft.form));
            dispatch(setStep(existingProject.onboardingDraft.currentStep || 2));
            // Draft already exists — projectId was set when draft was created, keep it
            dispatch(setProjectId(existingProject.onboardingDraft.projectId || leadProjectId));
            setDraftReady(true);
        } else if (existingProject) {
            dispatch(
                updateStep1({
                    projectName: existingProject.projectName || "",
                    location: existingProject.fullAddress || existingProject.location || "",
                    city: existingProject.city || "",
                    state: existingProject.state || "",
                    pincode: existingProject.pincode || "",
                    salesOfficerName: existingProject.contactPerson || "",
                    salesOfficerContact: (existingProject.phoneNumber || "").replace(/^\+91/, ""),
                    responsiblePersonName: existingProject.contactPerson || existingProject.developerName || "",
                    responsiblePersonContact: (existingProject.phoneNumber || "").replace(/^\+91/, ""),
                }),
            );

            const seen = new Set();
            const finalPts = [];
            let pts = existingProject.property_types;
            console.log("[Prefill Cache] Raw property_types from Redux cache:", existingProject.property_types);
            if (typeof pts === 'string') {
                try {
                    pts = JSON.parse(pts);
                } catch (e) {
                    console.log("[Prefill Cache] Error parsing JSON string:", e);
                    pts = [];
                }
            }
            console.log("[Prefill Cache] Parsed property_types array:", pts);
            if (Array.isArray(pts) && pts.length > 0) {
                pts.forEach(pt => {
                    finalPts.push({
                        main_type: pt.main_type || pt.category,
                        sub_type: pt.sub_type || pt.projectType,
                    });
                });
            } else if (existingProject.category) {
                const parts = String(existingProject.projectType || "").split(" | ")[0]?.split(" - ");
                if (parts && parts.length >= 2) {
                    finalPts.push({
                        main_type: parts[0]?.trim(),
                        sub_type: parts[1]?.trim()
                    });
                } else {
                    finalPts.push({
                        main_type: existingProject.category,
                        sub_type: existingProject.projectType
                    });
                }
            }

            console.log("[Prefill Cache] Final mapped property_types to dispatch:", finalPts);
            finalPts.forEach((pt, index) => {
                if (!pt.main_type || !pt.sub_type) return;
                const mainType = String(pt.main_type).toLowerCase() === 'commercial' ? 'commercial' : 'residential';
                const subType = String(pt.sub_type).toLowerCase();
                const key = `${mainType}_${subType}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    console.log(`[Prefill Cache] Dispatching addPropertyType for key: ${key}, mainType: ${mainType}, subType: ${subType}`);
                    dispatch(addPropertyType({
                        id: `lead_${mainType}_${subType}_${index}_${Math.random().toString(36).substring(2, 9)}`,
                        mainType,
                        subType
                    }));
                }
            });

            dispatch(setStep(1));
            // No projectId yet — createDraft will set it
            setDraftReady(true);
        } else if (leadProjectId) {
            // First fetch lead details — it may have a linked project_id
            leadsAPI.getLeadDetails(leadProjectId)
                .then(async (res) => {
                    const lead = res?.data?.lead || res?.data || res;
                    const linkedProjectId = lead?.project_id;
                    const lastCompletedStep = lead?.project_last_completed_step || 0;

                    if (linkedProjectId && lastCompletedStep >= 2) {
                        // Lead already has a linked project AND step 2 was completed — resume it
                        try {
                            await resumeDraft(linkedProjectId);
                        } catch (e) {
                            console.warn("resumeDraft failed, falling back to step1", e);
                            dispatch(setStep(1));
                            setDraftReady(true);
                        }
                    } else {
                        // No project yet, or step 2 not completed yet — prefill step1 and step2 from lead details
                        if (lead) {
                            dispatch(resetForm());
                            if (linkedProjectId) {
                                dispatch(setProjectId(linkedProjectId));
                            }
                            dispatch(
                                updateStep1({
                                    projectName: lead.project_name || lead.projectName || "",
                                    location: lead.full_address || lead.area || lead.location || "",
                                    city: lead.city || "",
                                    state: lead.state || "",
                                    pincode: lead.pincode || "",
                                    salesOfficerName: lead.contact_person || "",
                                    salesOfficerContact: (lead.contact_number || lead.phoneNumber || "").replace(/^\+91/, ""),
                                    responsiblePersonName: lead.builder_name || lead.contact_person || "",
                                    responsiblePersonContact: (lead.contact_number || lead.phoneNumber || "").replace(/^\+91/, ""),
                                }),
                            );

                            const seen = new Set();
                            let pts = lead.property_types || [];
                            console.log("[Prefill API] Raw property_types from API response:", lead.property_types);
                            if (typeof pts === 'string') {
                                try {
                                    pts = JSON.parse(pts);
                                } catch (e) {
                                    console.log("[Prefill API] Error parsing JSON string:", e);
                                    pts = [];
                                }
                            }
                            console.log("[Prefill API] Parsed property_types array:", pts);
                            if (pts.length === 0 && (lead.property_category || lead.property_subtype)) {
                                pts.push({
                                    main_type: lead.property_category,
                                    sub_type: lead.property_subtype,
                                    configuration: lead.configuration
                                });
                            }

                            console.log("[Prefill API] Final property_types to dispatch:", pts);
                            pts.forEach((pt, index) => {
                                if (!pt.main_type || !pt.sub_type) return;
                                const mainType = String(pt.main_type).toLowerCase() === 'commercial' ? 'commercial' : 'residential';
                                const subType = String(pt.sub_type).toLowerCase();
                                const key = `${mainType}_${subType}`;
                                if (!seen.has(key)) {
                                    seen.add(key);
                                    console.log(`[Prefill API] Dispatching addPropertyType for key: ${key}, mainType: ${mainType}, subType: ${subType}`);
                                    dispatch(addPropertyType({
                                        id: `lead_${mainType}_${subType}_${index}_${Math.random().toString(36).substring(2, 9)}`,
                                        mainType,
                                        subType
                                    }));
                                }
                            });
                        }
                        dispatch(setStep(1));
                        setDraftReady(true);
                    }
                })
                .catch(() => {
                    dispatch(setStep(1));
                    setDraftReady(true);
                });
        } else {
            dispatch(setStep(1));
            // Do NOT pre-set projectId — createDraft will assign it
            setDraftReady(true);
        }
    }, [dispatch, leadProjectId]);

    const validateStep1Fields = (values) => {
        const errors = {};

        if (!values.projectName || values.projectName.trim().length < 3) {
            errors.projectName = 'Project name must be at least 3 characters';
        }

        if (!values.location || values.location.trim().length === 0) {
            errors.location = 'Location is required';
        }

        if (!values.city || values.city.trim().length === 0) {
            errors.city = 'City is required';
        }

        if (!values.state || values.state.trim().length === 0) {
            errors.state = 'State is required';
        }

        if (!values.pincode || !/^[0-9]{5,6}$/.test(values.pincode.trim())) {
            errors.pincode = 'Enter a valid pincode (5-6 digits)';
        }

        const nameValidator = (v) => v && v.trim().length >= 2;
        if (!nameValidator(values.salesOfficerName)) {
            errors.salesOfficerName = 'Enter sales officer name';
        }
        if (!/^[0-9]{10}$/.test((values.salesOfficerContact || '').trim())) {
            errors.salesOfficerContact = 'Enter a valid 10-digit contact number';
        }

        if (!nameValidator(values.responsiblePersonName)) {
            errors.responsiblePersonName = 'Enter responsible person name';
        }
        if (!/^[0-9]{10}$/.test((values.responsiblePersonContact || '').trim())) {
            errors.responsiblePersonContact = 'Enter a valid 10-digit contact number';
        }

        return { valid: Object.keys(errors).length === 0, errors };
    };

    const buildOnboardingData = (mediaItems = []) => ({
        basicDetails: step1,
        propertyTypes: step2.selectedTypes,
        propertyDetails: step3.unitConfigs,
        approvals: step4,
        finance: step5,
        media: {
            images: step6.images,
            documents: step6.documents,
            uploadedMedia: mediaItems,
        },
        completedAt: new Date().toISOString(),
    });

    const normalizeImageSource = (value) => {
        if (!value) return null;
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed ? { uri: trimmed } : null;
        }
        if (typeof value === 'object') {
            if (typeof value.uri === 'string' && value.uri.trim()) return { uri: value.uri.trim() };
            if (typeof value.url === 'string' && value.url.trim()) return { uri: value.url.trim() };
            if (typeof value.path === 'string' && value.path.trim()) return { uri: value.path.trim() };
        }
        return null;
    };

    const normalizeImageList = (value) => {
        if (!value) return [];
        if (Array.isArray(value)) {
            return value.map(normalizeImageSource).filter(Boolean).map(i => i.uri);
        }
        const n = normalizeImageSource(value);
        return n ? [n.uri] : [];
    };

    const resumeDraft = async (projectIdToResume) => {
        dispatch(resetForm());
        dispatch(setProjectId(projectIdToResume));

        try {
            const res = await projectFormApi.getProjectFormResume(projectIdToResume);
            const resumeData = res.data?.data;
            if (!resumeData) throw new Error("Empty resume data");

            const s1 = resumeData.step1 || {};
            const s2 = resumeData.step2 || {};
            const s4 = resumeData.step4 || {};
            const s5 = resumeData.step5 || {};

            // Step 1
            dispatch(updateStep1({
                projectName: s1.name || '',
                location: s1.location || '',
                city: s1.city || '',
                state: s1.state || '',
                pincode: s1.pincode || '',
                salesOfficerName: s1.sales_officer_name || '',
                salesOfficerContact: s1.sales_officer_contact || '',
                responsiblePersonName: s1.responsible_person_name || '',
                responsiblePersonContact: s1.responsible_person_contact || '',
            }));

            // Step 2 — deduplicated property types from variants
            const variants = resumeData.step3?.variants || [];
            const dbUnits  = resumeData.step3?.units    || [];
            const seen = new Set();
            const typeMap = {};

            variants.forEach((v) => {
                const mainType = String(v.property_type).toLowerCase() === 'commercial' ? 'commercial' : 'residential';
                const subType  = String(v.property_subtype).toLowerCase();
                const key      = `${mainType}_${subType}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    dispatch(addPropertyType({ id: `resume_${mainType}_${subType}`, mainType, subType }));
                    typeMap[subType] = { mainType, subType, typeId: `resume_${mainType}_${subType}` };
                }
            });

            if (variants.length === 0) {
                (s2.property_types || []).forEach((pt) => {
                    const mainType = String(pt.main_type).toLowerCase() === 'commercial' ? 'commercial' : 'residential';
                    const subType  = String(pt.sub_type).toLowerCase();
                    const key      = `${mainType}_${subType}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        dispatch(addPropertyType({ id: `resume_${mainType}_${subType}`, mainType, subType }));
                        typeMap[subType] = { mainType, subType, typeId: `resume_${mainType}_${subType}` };
                    }
                });
            }

            // Step 3 — rebuild unitConfigs from saved units + variants
            const variantById = {};
            variants.forEach((v) => { variantById[v.id] = v; });

            const unitsBySubType = {};
            dbUnits.forEach((u) => {
                const variant = variantById[u.property_id];
                if (!variant) return;
                const subType = variant.property_subtype;
                if (!unitsBySubType[subType]) unitsBySubType[subType] = [];
                unitsBySubType[subType].push({ unit: u, variant });
            });

            const parseJsonField = (val) => {
                if (Array.isArray(val)) return val;
                try { return JSON.parse(val || '[]'); } catch { return []; }
            };

            const buildUnitConfig = (unit, variant) => {
                const bhkLabel = variant.category_type || (variant.bedrooms ? `${variant.bedrooms} BHK` : variant.property_subtype);
                return {
                    tower:          unit?.block_name || '',
                    floor:          unit?.floor != null ? String(unit.floor) : '',
                    bhk:            bhkLabel,
                    officeType:     bhkLabel,
                    variantName:    variant.variant_name || '',
                    area:           variant.area_sqft != null ? String(variant.area_sqft) : '',
                    areaUnit:       variant.area_unit || unit?.area_unit || 'Sq-ft',
                    price:          variant.selling_price != null ? String(variant.selling_price) : '',
                    images:         normalizeImageList(variant.images),
                    amenities:      parseJsonField(variant.amenities).length > 0 ? parseJsonField(variant.amenities) : [''],
                    extraCharges:   parseJsonField(variant.extra_charges).length > 0 ? parseJsonField(variant.extra_charges) : [{ title: '', amount: '' }],
                    brochure:       variant.brochure_url ? { uri: variant.brochure_url, name: 'Brochure', mimeType: '', size: 0 } : null,
                    propertyNumber: unit?.unit_number || '',
                    hasShop:        false,
                };
            };

            const RESUME_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

            const parseFloorNum = (floorVal, fallback) => {
                if (floorVal == null) return fallback;
                const n = parseInt(String(floorVal).replace(/\D/g, ''), 10);
                return isNaN(n) ? fallback : n;
            };

            const buildBuilderState = (subType, entries) => {
                const sectionMap = {};
                const sectionOrder = [];
                entries.forEach(({ unit, variant }) => {
                    const sec = unit?.block_name || 'Block A';
                    if (!sectionMap[sec]) { sectionMap[sec] = []; sectionOrder.push(sec); }
                    sectionMap[sec].push({ unit, variant });
                });

                const sections = sectionOrder.map((secName, secIdx) => {
                    const sEntries = sectionMap[secName];
                    const variantToConfigId = {};
                    const configs = [];
                    sEntries.forEach(({ variant }) => {
                        if (!variantToConfigId[variant.id]) {
                            const cfgId = 'cfg_' + variant.id;
                            variantToConfigId[variant.id] = cfgId;
                            configs.push({
                                id: cfgId,
                                type: variant.category_type || variant.property_subtype || '',
                                name: variant.variant_name || '',
                                area: variant.area_sqft != null ? String(variant.area_sqft) : '',
                                areaUnit: variant.area_unit || 'Sq-ft',
                                price: variant.selling_price != null ? String(variant.selling_price) : '',
                                color: RESUME_COLORS[configs.length % RESUME_COLORS.length],
                                images: normalizeImageList(variant.images),
                                brochure: variant.brochure_url ? { uri: variant.brochure_url, name: 'Brochure', mimeType: '', size: 0 } : null,
                                amenities: parseJsonField(variant.amenities).filter(Boolean).length > 0
                                    ? parseJsonField(variant.amenities).filter(Boolean) : [''],
                            });
                        }
                    });

                    const floorGroups = {};
                    sEntries.forEach(({ unit, variant }, idx) => {
                        const floor = parseFloorNum(unit?.floor, idx + 1);
                        if (!floorGroups[floor]) floorGroups[floor] = [];
                        floorGroups[floor].push({ unit, variant });
                    });

                    const builderMeta = sEntries[0]?.variant?.builder_meta;
                    const savedUnitsPerFloor = (builderMeta && typeof builderMeta === 'object')
                        ? builderMeta.units_per_floor
                        : (typeof builderMeta === 'string' ? JSON.parse(builderMeta || '{}')?.units_per_floor : null);
                    const allFloors = Object.keys(floorGroups).map(Number).filter(n => !isNaN(n));
                    const savedFloors = sEntries[0]?.variant?.section_floors;
                    const maxPaintedFloor = allFloors.length > 0 ? Math.max(...allFloors) : sEntries.length;
                    const floorCount = savedFloors || maxPaintedFloor;
                    const maxPaintedPerFloor = Object.values(floorGroups).length > 0
                        ? Math.max(...Object.values(floorGroups).map(g => g.length), 1) : 1;
                    const maxCol = savedUnitsPerFloor || maxPaintedPerFloor;

                    const rowUnitCounts = {};
                    const unitMap = {};
                    const unitOverrides = {};
                    for (let row = 1; row <= floorCount; row++) {
                        rowUnitCounts[row] = maxCol;
                    }

                    // First pass: populate assigned cells from DB entries
                    // Derive column position from unit_number (e.g. "103" on floor 1 → col 3)
                    allFloors.forEach((floor) => {
                        floorGroups[floor].forEach(({ unit, variant }, colIdx) => {
                            let col = colIdx + 1; // fallback
                            if (unit?.unit_number) {
                                const numStr = String(unit.unit_number);
                                const floorStr = String(floor);
                                // unit_number like "103": strip floor prefix to get col
                                if (numStr.startsWith(floorStr)) {
                                    const colPart = parseInt(numStr.slice(floorStr.length), 10);
                                    if (!isNaN(colPart) && colPart > 0) col = colPart;
                                }
                            }
                            const key = `${floor}_${col}`;
                            unitMap[key] = variantToConfigId[variant.id];
                            if (unit?.unit_number) unitOverrides[key] = { customName: unit.unit_number };
                        });
                    });

                    // Second pass: fill unitOverrides for ALL cells that don't have one yet
                    // so unassigned cells still show their room number (e.g. 101, 102, 104...)
                    for (let row = 1; row <= floorCount; row++) {
                        for (let col = 1; col <= maxCol; col++) {
                            const key = `${row}_${col}`;
                            if (!unitOverrides[key]) {
                                // Generate room number: floor prefix + zero-padded col (101, 102, 110, 201...)
                                const colStr = col < 10 ? `0${col}` : `${col}`;
                                unitOverrides[key] = { customName: `${row}${colStr}` };
                            }
                        }
                    }

                    return {
                        id: secIdx + 1,
                        name: secName,
                        floors: floorCount, rows: floorCount, lanes: floorCount,
                        unitsPerFloor: maxCol, plotsPerRow: maxCol, villasPerLane: maxCol,
                        configs, unitMap, rowUnitCounts, unitOverrides,
                    };
                });

                const getDefaultBuilderStateFallback = (subType2) => {
                    const secName2 = RANGE_BASED_SUB_TYPES.has(subType2) ? 'A' : subType2 === 'apartment' ? 'Tower A' : 'Section 1';
                    const rCount = subType2 === 'apartment' ? 8 : 4;
                    const cCount = subType2 === 'apartment' ? 4 : 6;
                    return { sections: [{ id: 1, name: secName2, floors: rCount, rows: rCount, lanes: rCount, unitsPerFloor: cCount, plotsPerRow: cCount, villasPerLane: cCount, configs: [], unitMap: {}, rowUnitCounts: {}, unitOverrides: {} }], activeSectionId: 1, activeConfigId: null, gridMode: 'paint', selectedUnitKey: null };
                };

                const finalSections = sections.length > 0 ? sections : getDefaultBuilderStateFallback(subType).sections;
                return { sections: finalSections, activeSectionId: finalSections[0]?.id || 1, activeConfigId: finalSections[0]?.configs[0]?.id || null, gridMode: 'paint', selectedUnitKey: null };
            };

            Object.entries(unitsBySubType).forEach(([subType, entries]) => {
                const typeId = `resume_${typeMap[subType]?.mainType || 'residential'}_${subType}`;
                const unitConfigs = entries.map(({ unit, variant }) => buildUnitConfig(unit, variant));
                dispatch(bulkUploadSubtype({ typeId, unitConfigs }));
                dispatch(setUploadMode({ typeId, mode: 'bulk' }));
                dispatch(updateBuilderData({ typeId, subType, builderState: buildBuilderState(subType, entries) }));
            });

            variants.forEach((v) => {
                const subType = v.property_subtype;
                if (!unitsBySubType[subType]) {
                    const mainType = v.property_type === 'commercial' ? 'commercial' : 'residential';
                    const typeId = `resume_${mainType}_${subType}`;
                    const unitConfigs = [buildUnitConfig(null, v)];
                    dispatch(bulkUploadSubtype({ typeId, unitConfigs }));
                    dispatch(setUploadMode({ typeId, mode: 'bulk' }));
                    dispatch(updateBuilderData({ typeId, subType, builderState: buildBuilderState(subType, [{ unit: null, variant: v }]) }));
                }
            });

            // Step 4
            const approvals = s4.approvals || {};
            const hasApprovals = Object.values(approvals).some((ap) =>
                ap && (ap.is_approved === true || ap.expected_time || ap.referenceNumber || ap.approvalDate || ap.rera_id)
            );
            if (
                s4.possession_status ||
                s4.project_launch_status ||
                s4.development_progress != null ||
                s4.overall_approval_status ||
                s4.expected_possession_date ||
                s4.project_launch_date ||
                s4.expected_launch_date ||
                hasApprovals
            ) {
                const parseChecklist = (val) => {
                    if (Array.isArray(val)) return val;
                    try { return JSON.parse(val || '[]'); } catch { return []; }
                };
                dispatch(updateStep4({
                    possessionStatus: s4.possession_status ? s4.possession_status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '',
                    expectedPossessionDate: normalizeApiDate(s4.expected_possession_date),
                    possessionRemarks: s4.possession_remarks || '',
                    projectLaunchStatus: s4.project_launch_status || '',
                    projectLaunchDate: normalizeApiDate(s4.project_launch_date),
                    expectedLaunchDate: normalizeApiDate(s4.expected_launch_date),
                    developmentCompletionPercentage: s4.development_progress != null ? String(s4.development_progress) : '',
                    currentDevelopmentStage: parseChecklist(s4.development_checklist),
                    developmentRemarks: s4.development_remarks || '',
                    otherDevelopmentStage: s4.other_development_stage || '',
                    overallApprovalStatus: s4.overall_approval_status || 'Not verified yet',
                }));

                if (approvals.diversion) dispatch(updateStep4Approval({ approvalKey: 'diversion', data: mapStep4ApprovalFromApi('diversion', approvals.diversion) }));
                if (approvals.tncp) dispatch(updateStep4Approval({ approvalKey: 'tncp', data: mapStep4ApprovalFromApi('tncp', approvals.tncp) }));
                if (approvals.developmentPermission) dispatch(updateStep4Approval({ approvalKey: 'developmentPermission', data: mapStep4ApprovalFromApi('developmentPermission', approvals.developmentPermission) }));
                if (approvals.rera) dispatch(updateStep4Approval({ approvalKey: 'rera', data: mapStep4ApprovalFromApi('rera', approvals.rera) }));
                if (approvals.municipal) dispatch(updateStep4Approval({ approvalKey: 'buildingPermission', data: mapStep4ApprovalFromApi('buildingPermission', approvals.municipal) }));
            }

            // Step 5
            const fin = s5.financial_details || {};
            const legal = s5.legal_details || {};
            const brokerage = s5.brokerage || {};
            const bankLoan = fin.bank_loan || {};
            const regCharges = (typeof fin.registry_charges === 'object' && fin.registry_charges) ? fin.registry_charges : {};

            const parseJsonArray = (val) => {
                if (Array.isArray(val)) return val;
                if (!val || val === '[]' || val === 'null') return [];
                if (typeof val === 'string') {
                    try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return val.split(',').map(i => i.trim()).filter(Boolean); }
                }
                return [];
            };
            // Converts string URLs or mixed arrays → proper doc objects for DocumentUploadButton
            const parseDocArray = (val, labelPrefix = 'Document') => {
                const arr = parseJsonArray(val);
                return arr.map((item, i) => {
                    if (typeof item === 'string') {
                        const fileName = item.split('/').pop() || `${labelPrefix} ${i + 1}`;
                        return { uri: item, url: item, name: fileName, isRemote: true };
                    }
                    // Already an object — ensure uri is set
                    return { uri: item.uri || item.url || '', url: item.url || item.uri || '', name: item.name || item.label || `${labelPrefix} ${i + 1}`, isRemote: true, ...item };
                });
            };
            const parseJsonObject = (val) => {
                if (val && typeof val === 'object' && !Array.isArray(val)) return val;
                if (typeof val === 'string') { try { const p = JSON.parse(val); return p && typeof p === 'object' && !Array.isArray(p) ? p : {}; } catch { return {}; } }
                return {};
            };

            const jv = parseJsonObject(legal.jv_details);
            const devAg = parseJsonObject(legal.dev_agreement_details);
            const step5WasSubmitted = !!(fin.guideline_value || fin.guideline_value_unit || legal.ownership_type);
            const loanAvailableVal = bankLoan.is_approved === true ? 'Yes' : (bankLoan.is_approved === false && step5WasSubmitted) ? 'No' : '';
            const bankTieUpVal = bankLoan.banks ? 'Yes' : (bankLoan.bank_tie_up_available === true ? 'Yes' : (bankLoan.is_approved === true ? 'No' : ''));

            dispatch(updateStep5({
                brokerageAvailable:   brokerage.type && brokerage.type !== 'none' ? 'Yes' : 'No',
                brokeragePercentage:  brokerage.value ? String(brokerage.value) : '',
                brokerageTerms:       brokerage.terms || '',
                guidelineValueAmount:       fin.guideline_value != null ? String(fin.guideline_value) : '',
                guidelineValueUnit:         fin.guideline_value_unit || '',
                propertyJurisdictionArea:   fin.property_jurisdiction_area || '',
                guidelineYear:              fin.guideline_year || '',
                guidelineReferenceDocuments: parseDocArray(fin.guideline_reference_documents, 'Guideline Doc'),
                registryChargesAvailable:   (regCharges.male || regCharges.female || regCharges.other) ? 'Yes' : (step5WasSubmitted ? 'No' : ''),
                registryChargesMaleBuyer:   regCharges.male   ? String(regCharges.male)   : '',
                registryChargesFemaleBuyer: regCharges.female ? String(regCharges.female) : '',
                otherGovernmentCharges:     regCharges.other  ? String(regCharges.other)  : '',
                loanAvailable:          loanAvailableVal,
                bankTieUpAvailable:     bankTieUpVal,
                tieUpBankName:          Array.isArray(bankLoan.banks) ? bankLoan.banks.join(', ') : (bankLoan.banks || ''),
                bankNameList:           Array.isArray(bankLoan.banks) ? bankLoan.banks.join(', ') : (bankLoan.banks || ''),
                loanApprovalStatus:     bankLoan.loan_approval_status || '',
                maximumLoanPercentage:  bankLoan.maximum_loan_percentage ? String(bankLoan.maximum_loan_percentage) : '',
                requiredLoanDocuments:  parseJsonArray(bankLoan.required_loan_documents).join(', '),
                ownershipType:              legal.ownership_type || '',
                ownedOwnerCompanyName:      legal.owned_owner_company_name || '',
                ownedDocuments:             parseDocArray(legal.owned_documents, 'Ownership Doc'),
                otherOwnershipType:         legal.other_ownership_type || '',
                ownershipSupportingDocuments: parseDocArray(legal.ownership_supporting_documents, 'Supporting Doc'),
                jvLandOwnerName:            jv.land_owner || '',
                jvDeveloperBuilderName:     jv.developer || '',
                jvAgreementAvailable:       jv.agreement_available || '',
                jvAgreementDocuments:       parseDocArray(jv.documents, 'JV Agreement'),
                jvRevenueAreaSharingDetails: jv.revenue_sharing || '',
                developmentLandOwnerName:       devAg.land_owner || '',
                developmentDeveloperName:        devAg.developer || '',
                developmentAgreementAvailable:   devAg.agreement_available || '',
                developmentAgreementDocuments:   parseDocArray(devAg.documents, 'Dev Agreement'),
                titleVerificationStatus:   legal.title_verification_status || '',
                titleVerificationDoneBy:   legal.title_verification_done_by || '',
                titleVerificationDate:     normalizeApiDate(legal.title_verification_date),
                titleReportDocuments:      parseDocArray(legal.title_report_documents, 'Title Report'),
                titleExpectedCompletionDate: normalizeApiDate(legal.title_expected_completion_date),
                financialOwnershipRemarks: legal.financial_ownership_remarks || '',
                // Extra fields
                customerIncentives: s5.incentives?.customer || '',
                brokerIncentives:   s5.incentives?.broker   || '',
                videoUrl:           s5.video_url            || '',
                visibility:         s5.settings?.visibility || 'public',
                salesOfficerId:     s5.assignments?.sales_officer_id   || null,
                branchManagerId:    s5.assignments?.branch_manager_id  || null,
            }));

            // Step 6 — restore already-uploaded media
            const savedMedia = resumeData.step6?.media || [];
            if (savedMedia.length > 0) {
                dispatch(updateStep6({
                    images: savedMedia
                        .filter(m => m.media_type === 'image')
                        .map(m => ({ uri: m.url, isRemote: true })),
                    documents: savedMedia
                        .filter(m => m.media_type === 'document')
                        .map(m => ({ uri: m.url, name: m.label || 'Document', mimeType: '', isRemote: true })),
                }));
            }

            const resumeAt = resumeData.resume_at_step || 1;
            setTimeout(() => dispatch(setStep(Math.min(resumeAt, 6))), 100);

        } catch (e) {
            console.warn("Resume API failed, cannot restore project data", e);
            dispatch(setStep(1));
        }
        setDraftReady(true);
    };

    useEffect(() => {
        if (!draftReady || !projectId) return;

        dispatch(
            saveProjectOnboardingDraft({
                projectId: leadProjectId || projectId,
                draft: {
                    currentStep,
                    projectId,
                    form: {
                        step1,
                        step2,
                        step3,
                        step4,
                        step5,
                        step6,
                    },
                },
            }),
        );
    }, [currentStep, dispatch, draftReady, projectId, step1, step2, step3, step4, step5, step6]);

    const uploadDocsAndUrls = async (docs, labelPrefix = 'Doc') => {
        if (!docs || !Array.isArray(docs)) return [];
        const result = [];
        for (let i = 0; i < docs.length; i++) {
            const doc = docs[i];
            const uri = doc?.uri || doc?.url || (typeof doc === 'string' ? doc : '');
            if (!uri) continue;

            if (uri.startsWith('http')) {
                result.push({
                    url: uri,
                    uri: uri,
                    name: doc.name || doc.label || `${labelPrefix} ${i + 1}`,
                });
            } else {
                const formData = new FormData();
                formData.append('file', {
                    uri: uri,
                    name: doc.name || `${labelPrefix.toLowerCase().replace(/\s+/g, '_')}_${i + 1}.pdf`,
                    type: doc.mimeType || 'application/pdf',
                });
                try {
                    const uploadRes = await projectFormApi.uploadMedia(projectId, formData);
                    const uploadedUrl = uploadRes.data?.data?.url || uploadRes.data?.url;
                    if (uploadedUrl) {
                        result.push({
                            url: uploadedUrl,
                            uri: uploadedUrl,
                            name: doc.name || `${labelPrefix} ${i + 1}`,
                        });
                    }
                } catch (uploadErr) {
                    console.error(`Failed to upload ${labelPrefix}:`, uploadErr);
                    result.push(doc); // Fallback
                }
            }
        }
        return result;
    };

    const handleNext = async () => {
        if (currentStep === 1) {
            const { valid, errors } = validateStep1Fields(step1);
            if (!valid) {
                setStep1Errors(errors);
                return;
            }
            setStep1Errors({});

            // If draft already created (user went back), skip re-creating
            if (projectId) {
                dispatch(setStep(2));
                return;
            }

            try {
                setIsSubmitting(true);
                const res = await projectFormApi.createDraft({
                    name: step1.projectName,
                    location: step1.location,
                    city: step1.city,
                    state: step1.state,
                    pincode: step1.pincode,
                    sales_officer_name: step1.salesOfficerName,
                    sales_officer_contact: step1.salesOfficerContact,
                    responsible_person_name: step1.responsiblePersonName,
                    responsible_person_contact: step1.responsiblePersonContact,
                    // Link to builder lead if form was opened from a lead
                    lead_id: leadProjectId || undefined,
                });
                dispatch(setProjectId(res.data.data.project_id));
                dispatch(setStep(2));
            } catch (error) {
                const msg = error.response?.data?.message || "Failed to save project. Please try again.";
                setStep1Errors({ api: msg });
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        if (currentStep === 2) {
            if (!projectId) {
                setStep1Errors({ api: "Project ID missing. Please go back to step 1." });
                return;
            }

            if (!shouldUseProjectFormApi) {
                dispatch(setStep(3));
                return;
            }

            try {
                setIsSubmitting(true);
                const property_types = step2.selectedTypes.map(t => ({
                    main_type: t.mainType,
                    sub_type: t.subType,
                }));
                await projectFormApi.configurePropertyTypes(projectId, { property_types });
                dispatch(setStep(3));
            } catch (error) {
                console.error("Step 2 API error:", error);
                const msg = error.response?.data?.message || "Failed to save property types. Please try again.";
                setStep1Errors({ api: msg });
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        if (currentStep === 3) {
            if (!projectId) {
                dispatch(setStep(4));
                return;
            }
            try {
                setIsSubmitting(true);

                await Promise.all(
                    step2.selectedTypes.map(async (type) => {
                        const allUnits = step3.unitConfigs[type.id] || [];
                        // Only send assigned units to backend
                        const units = allUnits.filter(u => u.isAssigned !== false);
                        if (units.length === 0) return;

                        // If bulk mode — CSV already uploaded to server, skip variant/sync
                        const isBulk = step3.uploadModes?.[type.id] === 'bulk';
                        if (isBulk) return;

                        // Group units by unique variant key (bhk/officeType + area + price)
                        const variantMap = {};
                        units.forEach((unit) => {
                            const variantKey = `${unit.bhk || unit.officeType || 'standard'}_${unit.area}_${unit.price || '0'}`;
                            if (!variantMap[variantKey]) {
                                variantMap[variantKey] = { blueprint: unit, units: [] };
                            }
                            variantMap[variantKey].units.push(unit);
                        });

                        // Create one variant per unique combo, then sync its units
                        // Also grab builder section data to persist floors/unitsPerFloor
                        const builderSections = step3.builderData?.[type.id]?.sections || [];

                        const variantIdMap = {};

                        // 1. Create/update all variants sequentially/concurrently
                        await Promise.all(
                            Object.entries(variantMap).map(async ([variantKey, { blueprint }]) => {
                                // Find the section this blueprint belongs to for floor/unit counts
                                const section = builderSections.find(s => s.id === blueprint.sectionId) || builderSections[0];
                                const sectionFloors = section?.floors ?? section?.rows ?? section?.lanes ?? null;
                                const sectionUnitsPerFloor = section?.unitsPerFloor ?? section?.plotsPerRow ?? section?.villasPerLane ?? null;

                                // Upload variant images if they are local
                                const uploadedImages = [];
                                if (blueprint.images && Array.isArray(blueprint.images)) {
                                    for (let i = 0; i < blueprint.images.length; i++) {
                                        const imgUri = blueprint.images[i];
                                        if (imgUri.startsWith('http')) {
                                            uploadedImages.push(imgUri);
                                        } else {
                                            const formData = new FormData();
                                            formData.append('file', {
                                                uri: imgUri,
                                                name: `variant_image_${i}.jpg`,
                                                type: 'image/jpeg',
                                            });
                                            try {
                                                const uploadRes = await projectFormApi.uploadMedia(projectId, formData);
                                                const url = uploadRes.data?.data?.url || uploadRes.data?.url;
                                                if (url) uploadedImages.push(url);
                                            } catch (uploadErr) {
                                                console.error("Failed to upload variant image:", uploadErr);
                                            }
                                        }
                                    }
                                }

                                // Upload variant brochure first if local
                                let uploadedBrochureUrl = null;
                                if (blueprint.brochure) {
                                    if (typeof blueprint.brochure === 'string' && blueprint.brochure.startsWith('http')) {
                                        uploadedBrochureUrl = blueprint.brochure;
                                    } else if (blueprint.brochure.uri) {
                                        if (blueprint.brochure.uri.startsWith('http')) {
                                            uploadedBrochureUrl = blueprint.brochure.uri;
                                        } else {
                                            const formData = new FormData();
                                            formData.append('file', {
                                                uri: blueprint.brochure.uri,
                                                name: blueprint.brochure.name || 'brochure.pdf',
                                                type: blueprint.brochure.mimeType || 'application/pdf',
                                            });
                                            try {
                                                const uploadRes = await projectFormApi.uploadMedia(projectId, formData);
                                                uploadedBrochureUrl = uploadRes.data?.data?.url || uploadRes.data?.url || null;
                                            } catch (uploadErr) {
                                                console.error("Failed to upload variant brochure:", uploadErr);
                                            }
                                        }
                                    }
                                }

                                const variantPayload = {
                                    category_type:    blueprint.bhk || blueprint.officeType || type.subType,
                                    variant_name:     blueprint.variantName || blueprint.bhk || blueprint.officeType || 'Standard',
                                    area_sqft:        parseFloat(blueprint.area) || 0,
                                    area_unit:        blueprint.areaUnit || 'Sq-ft',
                                    selling_price:    parseFloat((blueprint.price || '').toString().replace(/,/g, '')) || 0,
                                    property_type:    type.mainType,
                                    property_subtype: type.subType,
                                    listing_type:     'buy',
                                    images:           uploadedImages,
                                    amenities:        (blueprint.amenities || []).filter(Boolean),
                                    extra_charges:    (blueprint.extraCharges || blueprint.extra_charges || []).filter(charge => charge && charge.title),
                                    brochure_url:     uploadedBrochureUrl,
                                    floors:           sectionFloors,
                                    units_per_floor:  sectionUnitsPerFloor,
                                };

                                const variantRes = await projectFormApi.createVariant(projectId, variantPayload);
                                variantIdMap[variantKey] = variantRes.data.data.variant_id;
                            })
                        );

                        // 2. Map all units to their created variant_id and group by block
                        const blockMap = {};
                        units.forEach((unit) => {
                            const variantKey = `${unit.bhk || unit.officeType || 'standard'}_${unit.area}_${unit.price || '0'}`;
                            const dbVariantId = variantIdMap[variantKey];
                            if (!dbVariantId) return;

                            const blockName = unit.tower || 'Block A';
                            if (!blockMap[blockName]) blockMap[blockName] = [];
                            blockMap[blockName].push({
                                variant_id: dbVariantId,
                                unit_number: unit.propertyNumber,
                                floor: unit.floor || null,
                            });
                        });

                        // 3. Sync all units block-by-block (one single call per block containing all variants!)
                        await Promise.all(
                            Object.entries(blockMap).map(([block_name, blockUnits]) =>
                                projectFormApi.syncGridUnits(projectId, {
                                    property_subtype: type.subType,
                                    block_name,
                                    units: blockUnits,
                                })
                            )
                        );
                    })
                );

                dispatch(setStep(4));
            } catch (error) {
                console.error("Step 3 API error:", error);
                dispatch(setStep(4));
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        if (currentStep < 6) {
            // Step 4 Next → call step4-finalize
            if (currentStep === 4) {
                if (!projectId || !shouldUseProjectFormApi) { dispatch(setStep(5)); return; }
                try {
                    setIsSubmitting(true);

                    // Upload approval documents if they are local
                    const tncpDocs = await uploadDocsAndUrls(step4.approvals?.tncp?.documents, 'TNCP Doc');
                    const diversionDocs = await uploadDocsAndUrls(step4.approvals?.diversion?.documents, 'Diversion Doc');
                    const reraDocs = await uploadDocsAndUrls(step4.approvals?.rera?.documents, 'RERA Doc');
                    const devPermissionDocs = await uploadDocsAndUrls(step4.approvals?.developmentPermission?.documents, 'Dev Permission');
                    const municipalDocs = await uploadDocsAndUrls(step4.approvals?.buildingPermission?.documents, 'Municipal Doc');

                    const approvals = {
                        tncp: {
                            ...buildStep4ApprovalPayload('tncp', step4.approvals.tncp),
                            documents: tncpDocs,
                        },
                        diversion: {
                            ...buildStep4ApprovalPayload('diversion', step4.approvals.diversion),
                            documents: diversionDocs,
                        },
                        rera: {
                            ...buildStep4ApprovalPayload('rera', step4.approvals.rera),
                            documents: reraDocs,
                        },
                        developmentPermission: {
                            ...buildStep4ApprovalPayload('developmentPermission', step4.approvals.developmentPermission),
                            documents: devPermissionDocs,
                        },
                        municipal: {
                            ...buildStep4ApprovalPayload('buildingPermission', step4.approvals.buildingPermission),
                            documents: municipalDocs,
                        },
                    };

                    await projectFormApi.finalizeStep4(projectId, {
                        possession_status: step4.possessionStatus || null,
                        expected_possession_date: step4.expectedPossessionDate || null,
                        possession_remarks: step4.possessionRemarks || null,
                        project_launch_status: step4.projectLaunchStatus || null,
                        project_launch_date: step4.projectLaunchDate || null,
                        expected_launch_date: step4.expectedLaunchDate || null,
                        development_progress: parseInt(step4.developmentCompletionPercentage) || 0,
                        development_checklist: step4.currentDevelopmentStage || [],
                        development_remarks: step4.developmentRemarks || null,
                        other_development_stage: step4.otherDevelopmentStage || null,
                        overall_approval_status: step4.overallApprovalStatus || null,
                        variant_possessions: [],
                        amenity_ids: [],
                        bank_account: null,
                        approvals,
                    });
                    dispatch(setStep(5));
                } catch (error) {
                    console.error("Step 4 API error:", error);
                    const msg = error.response?.data?.message || "Failed to save approvals. Please try again.";
                    setStep1Errors({ api: msg });
                } finally {
                    setIsSubmitting(false);
                }
                return;
            }

            // Step 5 Next → call step5-finalize
            if (currentStep === 5) {
                if (!projectId || !shouldUseProjectFormApi) { dispatch(setStep(6)); return; }
                try {
                    setIsSubmitting(true);

                    // Upload Step 5 financial and legal documents if local
                    const guidelineDocs = await uploadDocsAndUrls(step5.guidelineReferenceDocuments, 'Guideline Doc');
                    const ownedDocs = await uploadDocsAndUrls(step5.ownedDocuments, 'Ownership Doc');
                    const jvDocs = await uploadDocsAndUrls(step5.jvAgreementDocuments, 'JV Agreement');
                    const devAgreementDocs = await uploadDocsAndUrls(step5.developmentAgreementDocuments, 'Dev Agreement');
                    const titleReportDocs = await uploadDocsAndUrls(step5.titleReportDocuments, 'Title Report');
                    const supportingDocs = await uploadDocsAndUrls(step5.ownershipSupportingDocuments, 'Supporting Doc');

                    await projectFormApi.finalizeStep5(projectId, {
                        brokerage: {
                            type:  step5.brokerageAvailable === 'Yes' ? 'percentage' : 'none',
                            value: step5.brokerageAvailable === 'Yes' ? (parseFloat(step5.brokeragePercentage) || 0) : 0,
                            terms: step5.brokerageTerms || null,
                        },
                        incentives: {
                            customer: step5.customerIncentives || null,
                            broker:   step5.brokerIncentives   || null,
                        },
                        settings: {
                            visibility: step5.visibility || 'public',
                        },
                        assignments: {
                            sales_officer_id:   step5.salesOfficerId   || null,
                            branch_manager_id:  step5.branchManagerId  || null,
                        },
                        video_url: step5.videoUrl || null,
                        financial_details: {
                            guideline_value:               step5.guidelineValueAmount ? parseFloat(step5.guidelineValueAmount) || null : null,
                            guideline_value_unit:          step5.guidelineValueUnit || null,
                            property_jurisdiction_area:    step5.propertyJurisdictionArea || null,
                            guideline_year:                step5.guidelineYear || null,
                            guideline_reference_documents: guidelineDocs,
                            registry_charges: step5.registryChargesAvailable === 'Yes'
                                ? {
                                    male:   step5.registryChargesMaleBuyer   || null,
                                    female: step5.registryChargesFemaleBuyer || null,
                                    other:  step5.otherGovernmentCharges     || null,
                                }
                                : null,
                            bank_loan: {
                                is_approved:              step5.loanAvailable === 'Yes',
                                bank_tie_up_available:    step5.bankTieUpAvailable === 'Yes',
                                banks: step5.bankTieUpAvailable === 'Yes'
                                    ? (step5.tieUpBankName || step5.bankNameList || '')
                                        .split(',')
                                        .map((bank) => bank.trim())
                                        .filter(Boolean)
                                    : null,
                                loan_approval_status:     step5.loanApprovalStatus || null,
                                maximum_loan_percentage:  step5.maximumLoanPercentage || null,
                                required_loan_documents:  step5.requiredLoanDocuments
                                    ? (typeof step5.requiredLoanDocuments === 'string'
                                        ? step5.requiredLoanDocuments.split(',').map(s => s.trim()).filter(Boolean)
                                        : step5.requiredLoanDocuments)
                                    : [],
                            },
                        },
                        legal_details: {
                            ownership_type:             step5.ownershipType || null,
                            owned_owner_company_name:   step5.ownedOwnerCompanyName || null,
                            owned_documents:            ownedDocs,
                            other_ownership_type:       step5.otherOwnershipType || null,
                            ownership_supporting_documents: supportingDocs,
                            jv_details: step5.ownershipType === 'Joint Venture Project'
                                ? {
                                    land_owner:          step5.jvLandOwnerName || null,
                                    developer:           step5.jvDeveloperBuilderName || null,
                                    agreement_available: step5.jvAgreementAvailable || null,
                                    revenue_sharing:     step5.jvRevenueAreaSharingDetails || null,
                                    documents:           jvDocs,
                                }
                                : null,
                            dev_agreement_details: step5.ownershipType === 'Development Agreement Project'
                                ? {
                                    land_owner:          step5.developmentLandOwnerName || null,
                                    developer:           step5.developmentDeveloperName || null,
                                    agreement_available: step5.developmentAgreementAvailable || null,
                                    documents:           devAgreementDocs,
                                }
                                : null,
                            title_verification_status:       step5.titleVerificationStatus || null,
                            title_verification_done_by:      step5.titleVerificationDoneBy || null,
                            title_verification_date:         step5.titleVerificationDate || null,
                            title_report_documents:          titleReportDocs,
                            title_expected_completion_date:  step5.titleExpectedCompletionDate || null,
                            financial_ownership_remarks:     step5.financialOwnershipRemarks || null,
                        },
                    });
                    dispatch(setStep(6));
                } catch (error) {
                    console.error("Step 5 API error:", error);
                    // Non-blocking — proceed to step 6
                    dispatch(setStep(6));
                } finally {
                    setIsSubmitting(false);
                }
                return;
            }

            dispatch(setStep(currentStep + 1));
        } else {
            // Step 6 Submit → upload images then call step6-finalize
            if (!projectId) {
                setStep1Errors({ api: "Project ID missing. Cannot submit." });
                return;
            }

            if (!shouldUseProjectFormApi) {
                dispatch(completeProjectOnboarding({ projectId, onboardingData: buildOnboardingData() }));
                dispatch(addNotification({
                    title: "Project onboarding saved",
                    description: `${step1.projectName || "Project"} onboarding details have been saved locally.`,
                    type: "success",
                }));
                dispatch(resetForm());
                router.push('/success');
                return;
            }

            try {
                setIsSubmitting(true);

                const mediaItems = [];

                // Upload images
                for (let i = 0; i < step6.images.length; i++) {
                    const img = step6.images[i];
                    if (img.uri?.startsWith('http')) {
                        mediaItems.push({ media_type: 'image', url: img.uri, is_cover: i === 0, sort_order: i });
                        continue;
                    }
                    const formData = new FormData();
                    formData.append('file', {
                        uri: img.uri,
                        name: img.fileName || `image_${i}.jpg`,
                        type: img.mimeType || 'image/jpeg',
                    });
                    const uploadRes = await projectFormApi.uploadMedia(projectId, formData);
                    const url = uploadRes.data?.data?.url || uploadRes.data?.url;
                    if (url) {
                        mediaItems.push({ media_type: 'image', url, is_cover: i === 0, sort_order: mediaItems.length });
                    }
                }

                // Upload documents
                for (let i = 0; i < (step6.documents || []).length; i++) {
                    const doc = step6.documents[i];
                    if (doc.uri?.startsWith('http')) {
                        mediaItems.push({ media_type: 'document', url: doc.uri, label: doc.name || `Document ${i + 1}`, sort_order: mediaItems.length });
                        continue;
                    }
                    const formData = new FormData();
                    formData.append('file', {
                        uri: doc.uri,
                        name: doc.name || `document_${i}.pdf`,
                        type: doc.mimeType || 'application/pdf',
                    });
                    const uploadRes = await projectFormApi.uploadMedia(projectId, formData);
                    const url = uploadRes.data?.data?.url || uploadRes.data?.url;
                    if (url) {
                        mediaItems.push({ media_type: 'document', url, label: doc.name || `Document ${i + 1}`, sort_order: mediaItems.length });
                    }
                }

                await projectFormApi.finalizeStep6(projectId, { media: mediaItems });

                dispatch(completeProjectOnboarding({ projectId, onboardingData: buildOnboardingData(mediaItems) }));
                dispatch(addNotification({
                    title: "Project added successfully",
                    description: `${step1.projectName || "New project"} has been added to your project panel.`,
                    type: "success",
                }));
                dispatch(resetForm());
                router.push('/success');
            } catch (error) {
                console.error("Submit error:", error);
                const msg = error.response?.data?.message || "Failed to submit project. Please try again.";
                setStep1Errors({ api: msg });
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const isNextDisabled = () => {
        if (currentStep === 1) {
            return !validateStep1Fields(step1).valid;
        }

        if (currentStep === 2) {
            return step2.selectedTypes.length === 0;
        }

        if (currentStep === 3) {
            if (step2.selectedTypes.length === 0) return true;
            
            // Check if all selected types have at least one assigned unit with data filled
            return step2.selectedTypes.some(type => {
                const configs = step3.unitConfigs[type.id] || [];
                const assignedConfigs = configs.filter(u => u.isAssigned !== false);
                if (assignedConfigs.length === 0) return true;

                return assignedConfigs.some(unit => {
                    if (!unit.area) return true;
                    if (type.subType === 'apartment' && (!unit.tower || !unit.floor || !unit.bhk)) return true;
                    if ((type.subType === 'villa' || type.subType === 'rowhouse') && !unit.bhk) return true;
                    if (type.subType === 'office' && !unit.officeType) return true;
                    return false;
                });
            });
        }

        if (currentStep === 4) {
            const percentage = Number(step4.developmentCompletionPercentage);
            if (step4.possessionStatus === "Possession Pending" && !step4.expectedPossessionDate) return true;
            if (step4.projectLaunchStatus === "Already Launched" && !step4.projectLaunchDate) return true;
            if (step4.projectLaunchStatus === "Upcoming Launch" && !step4.expectedLaunchDate) return true;
            if (step4.developmentCompletionPercentage !== '' && (Number.isNaN(percentage) || percentage < 0 || percentage > 100)) return true;
            if (step4.approvals.rera.status === "Yes" && !step4.approvals.rera.registrationNumber) return true;
            if (step4.approvals.buildingPermission.status === "No" && !step4.approvals.buildingPermission.expectedTime) return true;
            if (step4.approvals.developmentPermission.status === "No" && !step4.approvals.developmentPermission.expectedTime) return true;
            return false;
        }

        if (currentStep === 5) {
            if (step5.guidelineValueAmount && !step5.guidelineValueUnit) return true;
            if (step5.guidelineValueUnit && !step5.guidelineValueAmount) return true;
            if (step5.loanAvailable === "Yes" && (!step5.bankTieUpAvailable || !step5.loanApprovalStatus || !(step5.tieUpBankName || step5.bankNameList))) return true;
            if (step5.ownershipType === "Joint Venture Project" && (!step5.jvLandOwnerName || !step5.jvDeveloperBuilderName)) return true;
            return false;
        }

        if (currentStep === 6) {
            return step6.images.length < 3 || !step6.agreed;
        }

        return false;
    };

    const handleBack = () => {
        if (currentStep > 2) {
            dispatch(setStep(currentStep - 1));
        } else {
            router.back();
        }
    };

    return (
        <View className="flex-1 bg-[#F8F9FE]">
                <Stack.Screen options={{ headerShown: false }} />
                <StatusBar barStyle="light-content" />

                    {/* Header Section */}
                    <View className="bg-[#4A43EC] pt-12 pb-8 px-5 relative overflow-hidden">
                        {/* Decorative Circle */}
                        <View
                            style={{
                                position: "absolute",
                                right: -width * 0.5,
                                top: -width * 0.25,
                                width: width * 0.85,
                                height: width * 0.85,
                                borderRadius: width * 0.4,
                                backgroundColor: "#3D36C7",
                                opacity: 0.5
                            }}
                        />

                        <View className="flex-row items-center mt-6 justify-between mb-8">
                            <TouchableOpacity onPress={handleBack} className="p-1">
                                <Ionicons name="arrow-back" size={20} color="white" />
                            </TouchableOpacity>
                            <Text className="text-white text-base font-lato-bold">Add Project</Text>
                            <View style={{ width: 20 }} />
                        </View>

                        {/* Step Indicator */}
                        <View className="flex-row justify-between items-start mt-8">
                            {steps.map((step) => (
                                <View key={step.id} className="items-center" style={{ width: (width - 40) / 6 }}>
                                    <View
                                        className={`w-7 h-7 rounded-full items-center justify-center mb-1.5 ${currentStep === step.id ? 'bg-white' : 'bg-transparent border border-white/40'
                                            }`}
                                    >
                                        <Text className={`text-xs font-lato-bold ${currentStep === step.id ? 'text-[#4A43EC]' : 'text-white/60'
                                            }`}>
                                            {step.id}
                                        </Text>
                                    </View>
                                    <Text className={`text-[8px] text-center font-lato-medium ${currentStep === step.id ? 'text-white' : 'text-white/60'
                                        }`} numberOfLines={1}>
                                        {step.title}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Content Section */}
                    <View className="flex-1 bg-white -mt-5 rounded-t-[20px] overflow-hidden">
                        <KeyboardAwareScrollView
                            innerRef={(ref) => {
                                scrollRef.current = ref;
                            }}
                            className="flex-1 px-5 pt-6"
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{
                                paddingBottom: Platform.OS === "android" ? ANDROID_CONTENT_BOTTOM_PADDING : IOS_CONTENT_BOTTOM_PADDING,
                                flexGrow: 1,
                            }}
                            keyboardShouldPersistTaps="always"
                            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                            enableOnAndroid
                            extraScrollHeight={Platform.OS === "android" ? ANDROID_KEYBOARD_EXTRA_SCROLL : IOS_KEYBOARD_EXTRA_SCROLL}
                            extraHeight={Platform.OS === "android" ? ANDROID_KEYBOARD_EXTRA_HEIGHT : IOS_KEYBOARD_EXTRA_HEIGHT}
                            viewIsInsideTabBar={Platform.OS === "android"}
                            enableAutomaticScroll
                            keyboardOpeningTime={Platform.OS === "android" ? 0 : 250}
                            enableResetScrollToCoords={false}
                            nestedScrollEnabled={Platform.OS === "android"}
                        >
                            <View>
                                {currentStep === 1 && <Step1 errors={step1Errors} setErrors={setStep1Errors} />}
                                {currentStep === 2 && <Step2 />}
                                {currentStep === 3 && <Step3 />}
                                {currentStep === 4 && <Step4 />}
                                {currentStep === 5 && <Step5 />}
                                {currentStep === 6 && <Step6 />}

                                {/* Next Button */}
                                <View className="mt-8 mb-4">
                                    <TouchableOpacity
                                        className={`py-4 rounded-xl items-center ${isNextDisabled() || isSubmitting ? 'bg-gray-300' : 'bg-[#4A43EC]'}`}
                                        activeOpacity={0.8}
                                        onPress={handleNext}
                                        disabled={isNextDisabled() || isSubmitting}
                                    >
                                        <Text className="text-white text-sm font-lato-bold">
                                            {isSubmitting ? "Please wait..." : currentStep === 6 ? "Submit" : "Next"}
                                        </Text>
                                    </TouchableOpacity>
                                    {step1Errors.api && (
                                        <Text className="text-[11px] text-red-500 mt-2 text-center">{step1Errors.api}</Text>
                                    )}
                                </View>
                            </View>
                        </KeyboardAwareScrollView>
                    </View>
                </View>
    );
}

// --- Step 1 Component ---
function Step1({ errors = {}, setErrors }) {
    const dispatch = useDispatch();
    const { step1 } = useSelector((state) => state.project);
    const [fetchingLocation, setFetchingLocation] = useState(false);
    const [mapModalVisible, setMapModalVisible] = useState(false);
    const [searchModalVisible, setSearchModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [inlineSuggestions, setInlineSuggestions] = useState([]);

    const handlePhoneChange = async (val) => {
        updateField('responsiblePersonContact', val);
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
        updateField('responsiblePersonName', `${user.first_name} ${user.last_name || ""}`.trim());
        const cleanPhone = (user.phone || "").replace(/^\+91/, "");
        updateField('responsiblePersonContact', cleanPhone);
        setSearchModalVisible(false);
        setSearchQuery("");
        setSearchResults([]);
    };

    const [mapRegion, setMapRegion] = useState({
        latitude: 22.7196,
        longitude: 75.8577,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
    });
    const [markerCoordinate, setMarkerCoordinate] = useState({
        latitude: 22.7196,
        longitude: 75.8577,
    });
    const [resolvingAddress, setResolvingAddress] = useState(false);
    const [previewAddress, setPreviewAddress] = useState("");
    const [tempAddressDetails, setTempAddressDetails] = useState({
        location: "",
        city: "",
        state: "",
        pincode: "",
    });
    const mapRef = useRef(null);

    const updateField = (field, value) => {
        dispatch(updateStep1({ [field]: value }));
        if (setErrors) {
            setErrors(prev => {
                if (!prev) return {};
                const copy = { ...prev };
                delete copy[field];
                return copy;
            });
        }
    };

    const reverseGeocode = async (latitude, longitude) => {
        setResolvingAddress(true);
        try {
            const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (address) {
                const parts = [address.name, address.street, address.district].filter(Boolean);
                const fullLocation = parts.join(', ') || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                setPreviewAddress(fullLocation);
                setTempAddressDetails({
                    location: fullLocation,
                    city: address.city || address.subregion || "",
                    state: address.region || "",
                    pincode: address.postalCode || "",
                });
            } else {
                const fallback = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                setPreviewAddress(fallback);
                setTempAddressDetails({
                    location: fallback,
                    city: "",
                    state: "",
                    pincode: "",
                });
            }
        } catch (err) {
            console.warn("Reverse geocoding error:", err);
            const fallback = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
            setPreviewAddress(fallback);
            setTempAddressDetails({
                location: fallback,
                city: "",
                state: "",
                pincode: "",
            });
        } finally {
            setResolvingAddress(false);
        }
    };

    const openMapPicker = async () => {
        setFetchingLocation(true);
        try {
            const { granted } = await Location.requestForegroundPermissionsAsync();
            if (!granted) {
                alert("Location permission denied. Please allow location access.");
                return;
            }
            let lat = 22.7196;
            let lng = 75.8577;
            try {
                const loc = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                    timeout: 7000,
                });
                lat = loc.coords.latitude;
                lng = loc.coords.longitude;
            } catch (posErr) {
                console.warn("Failed to get current location coordinates, using default:", posErr.message);
            }

            const initialCoord = { latitude: lat, longitude: lng };
            setMarkerCoordinate(initialCoord);
            setMapRegion({
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            });
            setMapModalVisible(true);
            reverseGeocode(lat, lng);
        } catch (e) {
            console.error("openMapPicker Error:", e);
            alert("Could not load map.");
        } finally {
            setFetchingLocation(false);
        }
    };

    const handleConfirmLocation = () => {
        updateField('location', tempAddressDetails.location);
        if (tempAddressDetails.city) updateField('city', tempAddressDetails.city);
        if (tempAddressDetails.state) updateField('state', tempAddressDetails.state);
        if (tempAddressDetails.pincode) updateField('pincode', tempAddressDetails.pincode);
        setMapModalVisible(false);
    };

    const handleMapRegionChangeComplete = (region) => {
        const coordinate = {
            latitude: region.latitude,
            longitude: region.longitude,
        };
        setMarkerCoordinate(coordinate);
        reverseGeocode(region.latitude, region.longitude);
    };

    const projectNameRef = useRef(null);
    const locationRef = useRef(null);
    const cityRef = useRef(null);
    const stateRef = useRef(null);
    const pincodeRef = useRef(null);
    const salesNameRef = useRef(null);
    const salesContactRef = useRef(null);
    const respNameRef = useRef(null);
    const respContactRef = useRef(null);

    return (
        <View className="gap-6">
            {/* Map Picker Modal */}
            <Modal
                animationType="slide"
                transparent={false}
                visible={mapModalVisible}
                onRequestClose={() => setMapModalVisible(false)}
            >
                <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
                    {/* Modal Header */}
                    <View className="flex-row items-center border-b border-gray-100 px-4 py-3 bg-white justify-between">
                        <TouchableOpacity
                            onPress={() => setMapModalVisible(false)}
                            className="h-8 w-8 items-center justify-center rounded-lg bg-gray-100"
                        >
                            <Ionicons name="close" size={18} color="#111827" />
                        </TouchableOpacity>
                        <Text className="text-[15px] font-lato-bold text-[#0F172A]">Pick Project Location</Text>
                        <View style={{ width: 32 }} />
                    </View>

                    {/* Map Area */}
                    <View className="flex-1 relative">
                        <MapView
                            ref={mapRef}
                            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
                            initialRegion={mapRegion}
                            onRegionChangeComplete={handleMapRegionChangeComplete}
                            style={{ flex: 1 }}
                            showsUserLocation
                            showsMyLocationButton
                        />

                        {/* Fixed Center Pin */}
                        <View
                            pointerEvents="none"
                            className="absolute inset-0 items-center justify-center"
                            style={{ top: -20 }}
                        >
                            <View className="h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg border border-gray-100">
                                {resolvingAddress ? (
                                    <ActivityIndicator color="#4A43EC" size="small" />
                                ) : (
                                    <Ionicons name="location" size={26} color="#4A43EC" />
                                )}
                            </View>
                            <View className="h-1.5 w-1.5 rounded-full bg-[#4A43EC]/40 mt-1" />
                        </View>

                        {/* Bottom Floating Card */}
                        <View className="absolute bottom-5 left-4 right-4 bg-white rounded-2xl p-4 shadow-xl border border-gray-100">
                            <Text className="text-[10px] font-lato-bold uppercase tracking-[1px] text-gray-400 mb-1">Pinpoint Location Address</Text>
                            <Text className="text-xs font-lato-bold text-gray-800 leading-5 mb-4" numberOfLines={2}>
                                {resolvingAddress ? "Resolving address details..." : previewAddress || "Pin point location on the map..."}
                            </Text>

                            <TouchableOpacity
                                onPress={handleConfirmLocation}
                                disabled={resolvingAddress}
                                className="h-12 w-full bg-[#4A43EC] rounded-xl flex-row items-center justify-center"
                                style={resolvingAddress ? { opacity: 0.6 } : null}
                            >
                                <Ionicons name="checkmark-circle-outline" size={16} color="white" />
                                <Text className="text-white text-xs font-lato-bold ml-1.5">Confirm Pin Location</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </SafeAreaView>
            </Modal>

            {/* Project Name */}
            <View>
                <Text className="text-xs font-lato-bold text-black mb-1.5">Project Name</Text>
                <Pressable onPress={() => projectNameRef.current?.focus()} className="bg-white border border-gray-200 rounded-xl px-4 h-12 flex-row items-center">
                    <TextInput
                        ref={projectNameRef}
                        className="flex-1 text-[13px] text-gray-800 font-lato-medium"
                        placeholder="eg. The Grand Residency"
                        placeholderTextColor="#9CA3AF"
                        value={step1.projectName}
                        onChangeText={(v) => updateField('projectName', v)}
                        style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
                    />
                </Pressable>
                {errors.projectName && (
                    <Text className="text-[11px] text-red-500 mt-1">{errors.projectName}</Text>
                )}
            </View>

            {/* Location */}
            <View>
                <Text className="text-xs font-lato-bold text-black mb-1.5">Location</Text>
                <Pressable onPress={() => locationRef.current?.focus()} className="bg-white border border-gray-200 rounded-xl px-4 h-12 flex-row items-center">
                    <TextInput
                        ref={locationRef}
                        className="flex-1 text-[13px] text-gray-800 font-lato-medium"
                        placeholder="Address & Landmark"
                        placeholderTextColor="#9CA3AF"
                        value={step1.location}
                        onChangeText={(v) => updateField('location', v)}
                        style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
                    />
                    <TouchableOpacity
                        onPress={openMapPicker}
                        disabled={fetchingLocation}
                        activeOpacity={0.7}
                        className="w-7 h-7 rounded-lg bg-[#EBEAFF] items-center justify-center"
                    >
                        {fetchingLocation
                            ? <ActivityIndicator size={12} color="#4A43EC" />
                            : <Ionicons name="map-outline" size={15} color="#4A43EC" />
                        }
                    </TouchableOpacity>
                </Pressable>
                {errors.location && (
                    <Text className="text-[11px] text-red-500 mt-1">{errors.location}</Text>
                )}
            </View>

            {/* City, State, Pincode */}
            <View className="flex-row gap-3">
                <View className="flex-1">
                    <Text className="text-xs font-lato-bold text-black mb-1.5">City</Text>
                    <Pressable onPress={() => cityRef.current?.focus()} className="bg-white border border-gray-200 rounded-xl px-4 h-12 justify-center">
                        <TextInput
                            ref={cityRef}
                            className="text-[13px] text-gray-800 font-lato-medium"
                            placeholder="city"
                            placeholderTextColor="#9CA3AF"
                            value={step1.city}
                            onChangeText={(v) => updateField('city', v)}
                            style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
                        />
                    </Pressable>
                    {errors.city && (
                        <Text className="text-[11px] text-red-500 mt-1">{errors.city}</Text>
                    )}
                </View>
                <View className="flex-1">
                    <Text className="text-xs font-lato-bold text-black mb-1.5">State</Text>
                    <Pressable onPress={() => stateRef.current?.focus()} className="bg-white border border-gray-200 rounded-xl px-4 h-12 justify-center">
                        <TextInput
                            ref={stateRef}
                            className="text-[13px] text-gray-800 font-lato-medium"
                            placeholder="state"
                            placeholderTextColor="#9CA3AF"
                            value={step1.state}
                            onChangeText={(v) => updateField('state', v)}
                            style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
                        />
                    </Pressable>
                    {errors.state && (
                        <Text className="text-[11px] text-red-500 mt-1">{errors.state}</Text>
                    )}
                </View>
                <View className="flex-1">
                    <Text className="text-xs font-lato-bold text-black mb-1.5">Pincode</Text>
                    <Pressable onPress={() => pincodeRef.current?.focus()} className="bg-white border border-gray-200 rounded-xl px-4 h-12 justify-center">
                        <TextInput
                            ref={pincodeRef}
                            className="text-[13px] text-gray-800 font-lato-medium"
                            placeholder="pincode"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            value={step1.pincode}
                            onChangeText={(v) => updateField('pincode', v)}
                            style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
                        />
                    </Pressable>
                    {errors.pincode && (
                        <Text className="text-[11px] text-red-500 mt-1">{errors.pincode}</Text>
                    )}
                </View>
            </View>

            {/* Sales Officer Section */}
            <View>
                <Text className="text-xs font-lato-bold text-black mb-1.5">Sales officer name</Text>
                <Pressable onPress={() => salesNameRef.current?.focus()} className="bg-white border border-gray-200 rounded-xl px-4 h-12 flex-row items-center">
                    <TextInput
                        ref={salesNameRef}
                        className="flex-1 text-[13px] text-gray-800 font-lato-medium"
                        placeholder="eg. manas gangrade"
                        placeholderTextColor="#9CA3AF"
                        value={step1.salesOfficerName}
                        onChangeText={(v) => updateField('salesOfficerName', v)}
                        style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
                    />
                    <View className="w-7 h-7 rounded-lg bg-[#EBEAFF] items-center justify-center">
                        <Ionicons name="person" size={16} color="#4A43EC" />
                    </View>
                </Pressable>
                {errors.salesOfficerName && (
                    <Text className="text-[11px] text-red-500 mt-1">{errors.salesOfficerName}</Text>
                )}
            </View>

            <View>
                <Text className="text-xs font-lato-bold text-black mb-1.5">Contact No.</Text>
                <Pressable onPress={() => salesContactRef.current?.focus()} className="flex-row bg-white border border-gray-200 rounded-xl px-4 h-12 items-center">
                    <TextInput
                        ref={salesContactRef}
                        className="flex-1 text-[13px] text-gray-800 font-lato-medium"
                        placeholder="eg. 8120180101"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="phone-pad"
                        value={step1.salesOfficerContact}
                        onChangeText={(v) => updateField('salesOfficerContact', v)}
                        style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
                    />
                </Pressable>
                {errors.salesOfficerContact && (
                    <Text className="text-[11px] text-red-500 mt-1">{errors.salesOfficerContact}</Text>
                )}
            </View>
            

            {/* Responsible Person Section */}
            <View>
                <View className="flex-row justify-between items-center mb-1.5">
                    <Text className="text-xs font-lato-bold text-black">Responsible person name</Text>
                    <TouchableOpacity
                        onPress={() => setSearchModalVisible(true)}
                        activeOpacity={0.7}
                        className="flex-row items-center"
                    >
                        <Ionicons name="search" size={11} color="#4A43EC" style={{ marginRight: 2 }} />
                        <Text className="text-[11px] font-lato-bold text-[#4A43EC]">Select Existing Developer</Text>
                    </TouchableOpacity>
                </View>
                <Pressable onPress={() => respNameRef.current?.focus()} className="bg-white border border-gray-200 rounded-xl px-4 h-12 justify-center">
                    <TextInput
                        ref={respNameRef}
                        className="text-[13px] text-gray-800 font-lato-medium"
                        placeholder="eg. manas gangrade"
                        placeholderTextColor="#9CA3AF"
                        value={step1.responsiblePersonName}
                        onChangeText={(v) => updateField('responsiblePersonName', v)}
                        style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
                    />
                </Pressable>
                {errors.responsiblePersonName && (
                    <Text className="text-[11px] text-red-500 mt-1">{errors.responsiblePersonName}</Text>
                )}
            </View>

            <View>
                <Text className="text-xs font-lato-bold text-black mb-1.5">Contact No.</Text>
                <Pressable onPress={() => respContactRef.current?.focus()} className="flex-row bg-white border border-gray-200 rounded-xl px-4 h-12 items-center">
                    <TextInput
                        ref={respContactRef}
                        className="flex-1 text-[13px] text-gray-800 font-lato-medium"
                        placeholder="eg. 8120180101"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="phone-pad"
                        value={step1.responsiblePersonContact}
                        onChangeText={handlePhoneChange}
                        style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
                    />
                </Pressable>
                {errors.responsiblePersonContact && (
                    <Text className="text-[11px] text-red-500 mt-1">{errors.responsiblePersonContact}</Text>
                )}

                {inlineSuggestions.length > 0 && (
                    <View className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl mt-2 p-2 gap-2">
                        <Text className="text-[10px] font-lato-bold text-[#64748B] px-1">Found existing developer(s):</Text>
                        {inlineSuggestions.map((user) => (
                            <TouchableOpacity
                                key={user.id}
                                activeOpacity={0.7}
                                onPress={() => {
                                    updateField('responsiblePersonName', `${user.first_name} ${user.last_name || ""}`.trim());
                                    updateField('responsiblePersonContact', (user.phone || "").replace(/^\+91/, ""));
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
        </View>
    );
}

// --- CSV Helper ---
const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const data = lines.slice(1).map(line => {
        const values = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim().replace(/^"|"$/g, ''));
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim().replace(/^"|"$/g, ''));
        const obj = {};
        headers.forEach((h, i) => {
            obj[h] = values[i];
        });
        return obj;
    });
    return data;
};

// --- Step 2 Component ---
function Step2() {
    const { width } = Dimensions.get('window');
    const dispatch = useDispatch();
    const { step2 } = useSelector((state) => state.project);
    const [showUnitDropdown, setShowUnitDropdown] = useState(false);

    const towerRef = useRef(null);
    const floorRef = useRef(null);
    const areaRef = useRef(null);
    const propertyNumberRef = useRef(null);

    // Local state for the current type being added
    const [currentConfig, setCurrentConfig] = useState({
        id: '',
        mainType: null,
        subType: null,
        tower: '',
        floor: '',
        bhk: '',
        officeType: '',
        area: '',
        areaUnit: 'Sq-ft',
        amenities: [''],
        propertyNumber: '',
        hasShop: false,
        extraCharges: [{ title: '', amount: '' }]
    });

    const resetCurrentConfig = () => {
        setCurrentConfig({
            id: '',
            mainType: null,
            subType: null,
            tower: '',
            floor: '',
            bhk: '',
            officeType: '',
            area: '',
            areaUnit: 'Sq-ft',
            amenities: [''],
            propertyNumber: '',
            hasShop: false,
            extraCharges: [{ title: '', amount: '' }]
        });
    };

    const handleAddType = () => {
        if (!currentConfig.mainType || !currentConfig.subType) return;
        
        // Check if already added
        const exists = step2.selectedTypes.find(t => t.mainType === currentConfig.mainType && t.subType === currentConfig.subType);
        if (exists) return;

        dispatch(addPropertyType({
            mainType: currentConfig.mainType,
            subType: currentConfig.subType,
            id: Date.now().toString(),
        }));
        resetCurrentConfig();
    };

    const handleRemoveType = (id) => {
        dispatch(removePropertyType(id));
    };

    const subTypes = currentConfig.mainType ? subTypesData[currentConfig.mainType] : [];

    return (
        <View className="gap-5">
            <Text className="text-base font-lato-bold text-black">Configure Property Types</Text>

            {/* Added Types List */}
            {step2.selectedTypes.length > 0 && (
                <View className="gap-3">
                    {step2.selectedTypes.map((item) => {
                        const typeIcon = subTypesData[item.mainType]?.find(t => t.id === item.subType)?.image;
                        return (
                            <View key={item.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex-row justify-between items-center shadow-sm mb-3">
                                <View className="flex-row items-center flex-1">
                                    <View className="w-18 h-18 bg-[#F4F7FF] rounded-2xl items-center justify-center mr-4">
                                        <Image source={typeIcon} className="w-14 h-14" resizeMode="contain" />
                                    </View>
                                    <View className="justify-center">
                                        <Text className="font-lato-bold text-black text-[13px] leading-tight">
                                            {item.subType.toUpperCase()}
                                        </Text>
                                        <Text className="text-[11px] text-[#4A43EC] font-lato-bold uppercase mt-0.5 leading-tight">
                                            {item.mainType}
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => handleRemoveType(item.id)} className="ml-4">
                                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </View>
            )}

            <View className="h-[1px] bg-gray-100 my-2" />

            {/* Main Property Type Selection */}
            <Text className="text-xs font-lato-bold text-black">Select Main Type</Text>
            <View className="flex-row justify-between">
                {mainTypes.map((type) => (
                    <TouchableOpacity
                        key={type.id}
                        onPress={() => setCurrentConfig(prev => ({ ...prev, mainType: type.id, subType: null }))}
                        style={{ width: (width - 50) / 2 }}
                        className={`bg-white rounded-xl h-24 border ${currentConfig.mainType === type.id ? 'border-[#4A43EC] bg-[#F4F7FF]' : 'border-gray-100'
                            } shadow-sm relative overflow-hidden`}
                    >
                        <Text className="text-[10px] font-lato-bold text-black absolute top-2 left-2.5 z-10">{type.label}</Text>
                        <View className="flex-1 justify-end items-end">
                            <Image source={type.image} className="w-[80%] h-[70%] mt-auto" resizeMode="contain" />
                        </View>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Sub Type Selection */}
            {currentConfig.mainType && (
                <>
                    <View className="flex-row justify-between items-center">
                        <Text className="text-sm font-lato-bold text-black">Select Sub Type</Text>
                        {currentConfig.subType && (
                            <TouchableOpacity 
                                onPress={handleAddType}
                                className="bg-[#4A43EC] px-4 py-1.5 rounded-full"
                            >
                                <Text className="text-white text-[10px] font-lato-bold">Add This Type</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-3">
                        {subTypes.map((type) => (
                            <TouchableOpacity
                                key={type.id}
                                onPress={() => setCurrentConfig(prev => ({ ...prev, subType: type.id }))}
                                style={{ width: width * 0.22 }}
                                className={`bg-white rounded-lg h-20 border mr-3 ${currentConfig.subType === type.id ? 'border-[#4A43EC] bg-[#F4F7FF]' : 'border-gray-100'
                                    } shadow-sm items-center overflow-hidden`}
                            >
                                <Text className={`text-[9px] font-lato-bold mt-1.5 mb-0.5 ${currentConfig.subType === type.id ? 'text-[#4A43EC]' : 'text-black'}`}>{type.label}</Text>
                                <Image source={type.image} className="w-full h-[60%]" resizeMode="contain" />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </>
            )}
        </View>
    );
}

// --- Project Engine Helper ---
const getDefaultBuilderState = (subType) => {
    let secName = 'Tower A';
    let rCount = 8;
    let cCount = 4;

    if (RANGE_BASED_SUB_TYPES.has(subType)) {
        secName = 'A';
        rCount = 1;
        cCount = 4;
    } else if (subType === 'apartment') {
        secName = 'Tower A';
        rCount = 8;
        cCount = 4;
    } else {
        secName = 'Section 1';
        rCount = 4;
        cCount = 6;
    }

    return {
        sections: [
            {
                id: 1,
                name: secName,
                floors: rCount,
                rows: rCount,
                lanes: rCount,
                unitsPerFloor: cCount,
                plotsPerRow: cCount,
                villasPerLane: cCount,
                configs: [], // No variants by default
                unitMap: {}, // No units assigned by default
                rowUnitCounts: {},
                unitOverrides: {}
            }
        ],
        activeSectionId: 1,
        activeConfigId: null, // No active config by default
        gridMode: 'paint', // 'paint' | 'edit'
        selectedUnitKey: null
    };
};

// --- Step 3 Component ---
function Step3() {
    const dispatch = useDispatch();
    const { step2, step3 } = useSelector((state) => state.project);
    const projectId = useSelector((state) => state.project.projectId);
    const { width } = Dimensions.get('window');
    
    // Use the first selected type as the default active tab if available
    const [activeTypeTab, setActiveTypeTab] = useState(step2.selectedTypes[0]?.id);
    const uploadModes = step3.uploadModes || {};
    const [openUploadModeDropdown, setOpenUploadModeDropdown] = useState(false);
    const [openGridModeDropdown, setOpenGridModeDropdown] = useState(false);

    // Keep active tab valid if types are removed
    useEffect(() => {
        if (step2.selectedTypes.length > 0 && !step2.selectedTypes.find(t => t.id === activeTypeTab)) {
            setActiveTypeTab(step2.selectedTypes[0].id);
        }
    }, [step2.selectedTypes, activeTypeTab]);

    const activeType = step2.selectedTypes.find(t => t.id === activeTypeTab) || step2.selectedTypes[0];

    // Initialize builder data if not present
    useEffect(() => {
        if (activeType && !step3.builderData?.[activeType.id]) {
            dispatch(updateBuilderData({
                typeId: activeType.id,
                subType: activeType.subType,
                builderState: getDefaultBuilderState(activeType.subType)
            }));
        }
    }, [activeType, step3.builderData]);

    const builderState = step3.builderData?.[activeType?.id] || (activeType ? getDefaultBuilderState(activeType.subType) : null);

    const handleUpdateBuilder = (updater) => {
        if (!activeType) return;
        const currentState = step3.builderData?.[activeType.id] || getDefaultBuilderState(activeType.subType);
        const newState = updater(currentState);
        dispatch(updateBuilderData({
            typeId: activeType.id,
            subType: activeType.subType,
            builderState: newState
        }));
    };

    const handleSetActiveSection = (secId) => {
        handleUpdateBuilder(prev => ({ ...prev, activeSectionId: secId, selectedUnitKey: null }));
    };

    const handleAddSection = () => {
        handleUpdateBuilder(prev => {
            const newId = (prev.sections[prev.sections.length - 1]?.id || 0) + 1;
            let newSecName = '';
            if (RANGE_BASED_SUB_TYPES.has(activeType.subType)) {
                newSecName = String.fromCharCode(64 + newId);
            } else if (activeType.subType === 'apartment') {
                newSecName = `Tower ${String.fromCharCode(64 + newId)}`;
            } else {
                newSecName = `Section ${newId}`;
            }
            const newSection = {
                id: newId,
                name: newSecName,
                floors: prev.sections[0]?.floors ?? 5,
                rows: prev.sections[0]?.rows ?? 5,
                lanes: prev.sections[0]?.lanes ?? 5,
                unitsPerFloor: prev.sections[0]?.unitsPerFloor ?? 4,
                plotsPerRow: prev.sections[0]?.plotsPerRow ?? 4,
                villasPerLane: prev.sections[0]?.villasPerLane ?? 4,
                configs: prev.sections[0]?.configs ? JSON.parse(JSON.stringify(prev.sections[0].configs)) : [],
                unitMap: {},
                rowUnitCounts: prev.sections[0]?.rowUnitCounts ? JSON.parse(JSON.stringify(prev.sections[0].rowUnitCounts)) : {},
                unitOverrides: {}
            };

            return {
                ...prev,
                sections: [...prev.sections, newSection],
                activeSectionId: newId,
                selectedUnitKey: null
            };
        });
    };

    const handleUpdateDimensions = (field, value) => {
        const parsed = parseInt(value);
        const val = isNaN(parsed) ? 0 : parsed;
        handleUpdateBuilder(prev => ({
            ...prev,
            sections: prev.sections.map(sec => {
                if (sec.id !== prev.activeSectionId) return sec;
                const updated = { ...sec, [field]: val };
                if (field === 'floors') { updated.rows = val; updated.lanes = val; }
                if (field === 'rows') { updated.floors = val; updated.lanes = val; }
                if (field === 'lanes') { updated.floors = val; updated.rows = val; }
                if (field === 'unitsPerFloor') { updated.plotsPerRow = val; updated.villasPerLane = val; }
                if (field === 'plotsPerRow') { updated.unitsPerFloor = val; updated.villasPerLane = val; }
                if (field === 'villasPerLane') { updated.unitsPerFloor = val; updated.plotsPerRow = val; }
                return updated;
            })
        }));
    };

    const handleUpdateSectionName = (name) => {
        handleUpdateBuilder(prev => ({
            ...prev,
            sections: prev.sections.map(sec => sec.id === prev.activeSectionId ? { ...sec, name } : sec)
        }));
    };

    const handleRemoveSection = (secId) => {
        handleUpdateBuilder(prev => {
            if (prev.sections.length <= 1) return prev;
            const remaining = prev.sections.filter(s => s.id !== secId);
            return {
                ...prev,
                sections: remaining,
                activeSectionId: prev.activeSectionId === secId ? remaining[0].id : prev.activeSectionId,
                selectedUnitKey: null
            };
        });
    };

    const handleSetActiveConfig = (cfgId) => {
        handleUpdateBuilder(prev => ({ ...prev, activeConfigId: cfgId }));
    };

    const handleAddConfig = () => {
        handleUpdateBuilder(prev => {
            const activeSec = prev.sections.find(s => s.id === prev.activeSectionId);
            if (!activeSec) return prev;
            const shouldApplyAllRanges = RANGE_BASED_SUB_TYPES.has(activeType?.subType);
            const newCfgId = 'cfg_' + Date.now();
            const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];
            const nextColor = colors[activeSec.configs.length % colors.length];
            const newCfg = {
                id: newCfgId,
                type: '',
                name: '',
                area: '',
                price: '',
                color: nextColor,
                images: [],
                brochure: null,
                amenities: ['']
            };
            return {
                ...prev,
                sections: prev.sections.map(sec => {
                    if (!shouldApplyAllRanges && sec.id !== prev.activeSectionId) return sec;
                    return { ...sec, configs: [...sec.configs, JSON.parse(JSON.stringify(newCfg))] };
                }),
                activeConfigId: newCfgId
            };
        });
    };

    const handleRemoveConfig = (cfgId) => {
        handleUpdateBuilder(prev => {
            const activeSec = prev.sections.find(s => s.id === prev.activeSectionId);
            if (!activeSec) return prev;
            const shouldApplyAllRanges = RANGE_BASED_SUB_TYPES.has(activeType?.subType);
            const targetSectionIds = shouldApplyAllRanges ? prev.sections.map(sec => sec.id) : [prev.activeSectionId];

            const remainingConfigs = activeSec.configs.filter(c => c.id !== cfgId);

            return {
                ...prev,
                sections: prev.sections.map(sec => {
                    if (!targetSectionIds.includes(sec.id)) return sec;
                    const secRemainingConfigs = sec.configs.filter(c => c.id !== cfgId);
                    const newUnitMap = { ...sec.unitMap };
                    Object.keys(newUnitMap).forEach(key => {
                        if (newUnitMap[key] === cfgId) {
                            delete newUnitMap[key];
                        }
                    });
                    return {
                        ...sec,
                        configs: secRemainingConfigs,
                        unitMap: newUnitMap
                    };
                }),
                activeConfigId: prev.activeConfigId === cfgId ? (remainingConfigs[0]?.id || null) : prev.activeConfigId
            };
        });
    };

    const handleUpdateConfigField = (cfgId, field, value) => {
        handleUpdateBuilder(prev => ({
            ...prev,
            sections: prev.sections.map(sec => {
                if (!RANGE_BASED_SUB_TYPES.has(activeType?.subType) && sec.id !== prev.activeSectionId) return sec;
                return {
                    ...sec,
                    configs: sec.configs.map(c => c.id === cfgId ? { ...c, [field]: value } : c)
                };
            })
        }));
    };

    const handleAddAmenity = (cfgId) => {
        const config = activeSection?.configs?.find(c => c.id === cfgId);
        if (!config) return;
        handleUpdateConfigField(cfgId, 'amenities', [...(config.amenities || ['']), '']);
    };

    const handleUpdateAmenity = (cfgId, index, value) => {
        const config = activeSection?.configs?.find(c => c.id === cfgId);
        if (!config) return;
        const amenities = [...(config.amenities || [''])];
        amenities[index] = value;
        handleUpdateConfigField(cfgId, 'amenities', amenities);
    };

    const handleRemoveAmenity = (cfgId, index) => {
        const config = activeSection?.configs?.find(c => c.id === cfgId);
        if (!config) return;
        const amenities = [...(config.amenities || [''])];
        amenities.splice(index, 1);
        handleUpdateConfigField(cfgId, 'amenities', amenities.length > 0 ? amenities : ['']);
    };

    const handlePickVariantImages = async (cfgId) => {
        const config = activeSection?.configs?.find(c => c.id === cfgId);
        if (!config) return;

        const currentImages = config.images || [];
        if (currentImages.length >= 5) {
            alert('You can add up to 5 images for each variant.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            selectionLimit: 5 - currentImages.length,
            quality: 0.8,
        });

        if (!result.canceled) {
            const nextImages = [...currentImages, ...result.assets.map(asset => asset.uri)].slice(0, 5);
            handleUpdateConfigField(cfgId, 'images', nextImages);
        }
    };

    const handleRemoveVariantImage = (cfgId, imageUri) => {
        const config = activeSection?.configs?.find(c => c.id === cfgId);
        if (!config) return;
        const nextImages = (config.images || []).filter(uri => uri !== imageUri);
        handleUpdateConfigField(cfgId, 'images', nextImages);
    };

    const handlePickVariantBrochure = async (cfgId) => {
        const config = activeSection?.configs?.find(c => c.id === cfgId);
        if (!config) return;

        const result = await DocumentPicker.getDocumentAsync({
            type: [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ],
            multiple: false,
            copyToCacheDirectory: true
        });

        if (!result.canceled && result.assets?.[0]) {
            const brochure = result.assets[0];
            handleUpdateConfigField(cfgId, 'brochure', {
                name: brochure.name || 'Brochure',
                uri: brochure.uri,
                mimeType: brochure.mimeType || '',
                size: brochure.size || 0,
            });
        }
    };

    const handleRemoveVariantBrochure = (cfgId) => {
        handleUpdateConfigField(cfgId, 'brochure', null);
    };

    const handleCellClick = (key, sectionId) => {
        handleUpdateBuilder(prev => {
            const targetSectionId = sectionId || prev.activeSectionId;
            const targetSec = prev.sections.find(s => s.id === targetSectionId);
            if (!targetSec) return prev;
            const selectedKey = `${targetSectionId}:${key}`;

            if (prev.gridMode === 'paint') {
                if (!prev.activeConfigId) {
                    alert("Please add and select a variant first before assigning units.");
                    return prev;
                }
                const newMap = { ...targetSec.unitMap };
                if (newMap[key] === prev.activeConfigId) {
                    delete newMap[key];
                } else {
                    newMap[key] = prev.activeConfigId;
                }
                return {
                    ...prev,
                    activeSectionId: targetSectionId,
                    sections: prev.sections.map(sec => sec.id === targetSectionId ? { ...sec, unitMap: newMap } : sec)
                };
            } else {
                if (!targetSec.unitMap?.[key]) {
                    alert("Please assign a base variant to this unit in 'Assign Variants' mode before customizing.");
                    return prev;
                }
                return {
                    ...prev,
                    activeSectionId: targetSectionId,
                    selectedUnitKey: selectedKey
                };
            }
        });
    };

    const handleSelectAll = () => {
        handleUpdateBuilder(prev => {
            if (!prev.activeConfigId) {
                alert("Please add and select a variant first before assigning units.");
                return prev;
            }

            const shouldApplyAllRanges = RANGE_BASED_SUB_TYPES.has(activeType?.subType);
            const targetSectionIds = shouldApplyAllRanges
                ? prev.sections.map(sec => sec.id)
                : [prev.activeSectionId];

            return {
                ...prev,
                sections: prev.sections.map(sec => {
                    if (!targetSectionIds.includes(sec.id)) return sec;
                    const rows = sec.floors ?? sec.rows ?? sec.lanes ?? 1;
                    const cols = sec.unitsPerFloor ?? sec.plotsPerRow ?? sec.villasPerLane ?? 1;
                    const newMap = {};
                    for (let r = 1; r <= rows; r++) {
                        const rowCols = sec.rowUnitCounts?.[r] ?? cols;
                        for (let c = 1; c <= rowCols; c++) {
                            newMap[`${r}_${c}`] = prev.activeConfigId;
                        }
                    }
                    return { ...sec, unitMap: newMap };
                })
            };
        });
    };

    const handleClearAll = () => {
        handleUpdateBuilder(prev => {
            const shouldApplyAllRanges = RANGE_BASED_SUB_TYPES.has(activeType?.subType);
            const targetSectionIds = shouldApplyAllRanges
                ? prev.sections.map(sec => sec.id)
                : [prev.activeSectionId];

            return {
                ...prev,
                selectedUnitKey: shouldApplyAllRanges ? null : prev.selectedUnitKey,
                sections: prev.sections.map(sec => {
                    if (!targetSectionIds.includes(sec.id)) return sec;
                    return { ...sec, unitMap: {} };
                })
            };
        });
    };

    const handleAdjustRowUnits = (rowNumber, delta, sectionId) => {
        handleUpdateBuilder(prev => {
            const targetSectionId = sectionId || prev.activeSectionId;
            const activeSec = prev.sections.find(s => s.id === targetSectionId);
            if (!activeSec) return prev;

            const defaultCount = activeSec.unitsPerFloor ?? activeSec.plotsPerRow ?? activeSec.villasPerLane ?? 1;
            const currentCount = activeSec.rowUnitCounts?.[rowNumber] ?? defaultCount;
            const nextCount = Math.max(1, currentCount + delta);
            if (nextCount === currentCount) return prev;

            const nextRowUnitCounts = { ...(activeSec.rowUnitCounts || {}) };
            if (nextCount === defaultCount) {
                delete nextRowUnitCounts[rowNumber];
            } else {
                nextRowUnitCounts[rowNumber] = nextCount;
            }

            const nextUnitMap = { ...(activeSec.unitMap || {}) };
            const nextOverrides = { ...(activeSec.unitOverrides || {}) };
            Object.keys(nextUnitMap).forEach(key => {
                const [rowValue, colValue] = key.split('_').map(Number);
                if (rowValue === rowNumber && colValue > nextCount) {
                    delete nextUnitMap[key];
                }
            });
            Object.keys(nextOverrides).forEach(key => {
                const [rowValue, colValue] = key.split('_').map(Number);
                if (rowValue === rowNumber && colValue > nextCount) {
                    delete nextOverrides[key];
                }
            });

            const selectedUnitKey = prev.selectedUnitKey && (() => {
                const [selectedSectionId, selectedCellKey] = prev.selectedUnitKey.includes(':')
                    ? prev.selectedUnitKey.split(':')
                    : [String(prev.activeSectionId), prev.selectedUnitKey];

                if (parseInt(selectedSectionId, 10) !== targetSectionId) {
                    return prev.selectedUnitKey;
                }

                const [rowValue, colValue] = selectedCellKey.split('_').map(Number);
                return rowValue === rowNumber && colValue > nextCount ? null : prev.selectedUnitKey;
            })();

            return {
                ...prev,
                selectedUnitKey,
                sections: prev.sections.map(sec => sec.id === targetSectionId ? {
                    ...sec,
                    rowUnitCounts: nextRowUnitCounts,
                    unitMap: nextUnitMap,
                    unitOverrides: nextOverrides,
                } : sec)
            };
        });
    };

    const handleUpdateOverride = (compositeKey, field, value) => {
        handleUpdateBuilder(prev => {
            const [sectionIdRaw, key] = compositeKey.includes(':')
                ? compositeKey.split(':')
                : [String(prev.activeSectionId), compositeKey];
            const sectionId = parseInt(sectionIdRaw, 10);
            const activeSec = prev.sections.find(s => s.id === sectionId);
            if (!activeSec) return prev;
            const currentOverrides = { ...activeSec.unitOverrides };
            const unitOverride = { ...(currentOverrides[key] || {}) };
            unitOverride[field] = value;
            currentOverrides[key] = unitOverride;
            return {
                ...prev,
                sections: prev.sections.map(sec => sec.id === sectionId ? { ...sec, unitOverrides: currentOverrides } : sec)
            };
        });
    };

    const handleDownloadFormat = async (type) => {
        try {
            let headers = ['Sub Type', 'Property Number', 'Area', 'Area Unit'];
            
            if (type.subType === 'apartment') {
                headers.push('BHK', 'Tower', 'Floor');
            } else if (type.subType === 'villa' || type.subType === 'rowhouse') {
                headers.push('BHK');
            } else if (type.subType === 'office') {
                headers.push('Office Type');
            }
            
            headers.push('Selling Price', 'Price Negotiable', 'Tax Exclude', 'Payment Mode');
            
            const headersStr = headers.join(',');
            
            const sampleRow = headers.map(h => {
                if (h === 'Sub Type') return type.subType;
                if (h === 'Property Number') return 'A-101';
                if (h === 'Area') return '1200';
                if (h === 'Area Unit') return 'Sq-ft';
                if (h === 'BHK') return '2 BHK';
                if (h === 'Tower') return 'Tower A';
                if (h === 'Floor') return '1st';
                if (h === 'Office Type') return 'Co-working';
                if (h === 'Selling Price') return '5000000';
                if (h === 'Price Negotiable' || h === 'Tax Exclude') return 'false';
                if (h === 'Payment Mode') return 'full';
                return '';
            }).join(',');

            const csvContent = `${headersStr}\n${sampleRow}`;
            const fileUri = `${FileSystem.documentDirectory}${type.subType}_format.csv`;
            
            await FileSystem.writeAsStringAsync(fileUri, csvContent);
            await Sharing.shareAsync(fileUri);
        } catch (error) {
            console.error(error);
        }
    };

    const handleBulkUpload = async (type) => {
        if (!projectId) {
            alert("Project not saved yet. Please complete Step 1 first.");
            return;
        }
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ["text/csv", "text/comma-separated-values", "application/csv", "application/vnd.ms-excel"],
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            const asset = result.assets[0];

            // Validate CSV extension
            const fileName = asset.name || asset.uri || '';
            if (!fileName.toLowerCase().endsWith('.csv')) {
                alert("Invalid file type. Please upload a CSV file only.");
                return;
            }

            const formData = new FormData();
            formData.append('csv_file', {
                uri: asset.uri,
                name: asset.name || `${type.subType}_upload.csv`,
                type: 'text/csv',
            });
            formData.append('property_subtype', type.subType);
            formData.append('listing_type', 'buy');

            const res = await projectFormApi.uploadCsvUnits(projectId, formData);
            const totalUnits = res.data.data?.total_units_inserted || 0;

            // Also parse locally to update Redux state for UI preview
            const content = await FileSystem.readAsStringAsync(asset.uri);
            const data = parseCSV(content);
            const unitConfigs = data
                .filter(row => row['Property Number'])
                .map(row => ({
                    tower: row['Tower'] || '',
                    floor: row['Floor'] || '',
                    bhk: row['BHK'] || '',
                    officeType: row['Office Type'] || '',
                    area: row['Area'] || '',
                    areaUnit: row['Area Unit'] || 'Sq-ft',
                    price: row['Selling Price'] || '',
                    amenities: [''],
                    propertyNumber: row['Property Number'] || '',
                    hasShop: false,
                    extraCharges: [{ title: '', amount: '' }],
                }));

            dispatch(bulkUploadSubtype({ typeId: type.id, unitConfigs }));
            alert(`✓ ${totalUnits} units uploaded successfully for ${type.subType}.`);
        } catch (error) {
            console.error("CSV Upload error:", error);
            const msg = error.response?.data?.message || "Failed to upload CSV. Please check the file format and try again.";
            alert(msg);
        }
    };

    if (step2.selectedTypes.length === 0) {
        return (
            <View className="items-center py-10">
                <Text className="text-gray-400 font-lato">No property types selected in Step 2.</Text>
            </View>
        );
    }

    const activeSection = builderState?.sections?.find(s => s.id === builderState.activeSectionId) || builderState?.sections?.[0];
    const activeConfig = activeSection?.configs?.find(c => c.id === builderState?.activeConfigId) || activeSection?.configs?.[0];
    const configsList = step3.unitConfigs[activeType?.id] || [];
    const getRowUnitCount = (section, rowNumber) => section?.rowUnitCounts?.[rowNumber] ?? (section?.unitsPerFloor ?? section?.plotsPerRow ?? section?.villasPerLane ?? 1);
    const sectionsForGrid = RANGE_BASED_SUB_TYPES.has(activeType?.subType)
        ? (builderState?.sections || [])
        : (activeSection ? [activeSection] : []);

    return (
        <View className="gap-6">
            <Text className="text-base font-lato-bold text-black">Configure Units (Project Engine)</Text>

            {/* Subtypes Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-3">
                {step2.selectedTypes.map((type) => {
                    const typeIcon = subTypesData[type.mainType]?.find(t => t.id === type.subType)?.image;
                    const isActive = activeTypeTab === type.id;
                    return (
                        <TouchableOpacity
                            key={type.id}
                            onPress={() => setActiveTypeTab(type.id)}
                            className={`bg-white border rounded-lg px-3 py-2 mb-1 flex-row items-center mr-3 ${isActive ? 'border-[#4A43EC]' : 'border-gray-100'}`}
                        >
                            <View className="w-8 h-8 bg-[#F4F7FF] rounded-md items-center justify-center mr-2">
                                <Image source={typeIcon} className="w-5 h-5" resizeMode="contain" />
                            </View>
                            <View className="justify-center">
                                <Text className={`font-lato-bold text-[11px] leading-tight ${isActive ? 'text-[#4A43EC]' : 'text-black'}`}>
                                    {type.subType.toUpperCase()}
                                </Text>
                                <Text className={`text-[9px] font-lato-bold uppercase mt-0.5 leading-tight ${isActive ? 'text-[#4A43EC]/80' : 'text-gray-500'}`}>
                                    {type.mainType}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <View className="h-[1px] bg-gray-100 my-1" />

            {/* Upload Mode Switcher */}
            {activeType && (
                <View className="gap-4">
                    <View className="z-[60]">
                        <Text className="text-xs font-lato-bold text-gray-500 mb-2.5">Configuration Mode for {activeType.subType}</Text>
                        <TouchableOpacity
                            onPress={() => setOpenUploadModeDropdown(!openUploadModeDropdown)}
                            className="bg-white border border-gray-200 rounded-xl px-4 h-12 flex-row items-center justify-between"
                        >
                            <Text className="text-sm font-lato-medium text-black">
                                {uploadModes[activeType.id] === 'bulk' ? 'Bulk upload (CSV)' : 'Visual Builder (Project Engine)'}
                            </Text>
                            <Ionicons name={openUploadModeDropdown ? "chevron-up" : "chevron-down"} size={18} color="#666" />
                        </TouchableOpacity>

                        {openUploadModeDropdown && (
                            <View className="absolute top-[72px] left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg z-[61] overflow-hidden">
                                <TouchableOpacity
                                    onPress={() => {
                                        dispatch(setUploadMode({ typeId: activeType.id, mode: 'manual' }));
                                        setOpenUploadModeDropdown(false);
                                    }}
                                    className={`px-4 py-3 border-b border-gray-50 ${uploadModes[activeType.id] !== 'bulk' ? 'bg-[#F4F7FF]' : ''}`}
                                >
                                    <Text className={`text-sm font-lato-bold ${uploadModes[activeType.id] !== 'bulk' ? 'text-[#4A43EC]' : 'text-gray-800'}`}>Visual Builder (Project Engine)</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => {
                                        dispatch(setUploadMode({ typeId: activeType.id, mode: 'bulk' }));
                                        setOpenUploadModeDropdown(false);
                                    }}
                                    className={`px-4 py-3 ${uploadModes[activeType.id] === 'bulk' ? 'bg-[#F4F7FF]' : ''}`}
                                >
                                    <Text className={`text-sm font-lato-bold ${uploadModes[activeType.id] === 'bulk' ? 'text-[#4A43EC]' : 'text-gray-800'}`}>Bulk upload (CSV)</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {uploadModes[activeType.id] === 'bulk' ? (
                        <View className="bg-[#4A43EC]/5 p-6 rounded-2xl border border-[#4A43EC]/10 items-center justify-center gap-5">
                            <MaterialIcons name="cloud-upload" size={48} color="#4A43EC" opacity={0.5} />
                            <Text className="text-center text-sm font-lato-medium text-gray-600 mb-2">
                                Download the format, fill in your {activeType.subType} details, and upload the CSV file.
                            </Text>
                            <View className="flex-row gap-3 w-full">
                                <TouchableOpacity 
                                    onPress={() => handleBulkUpload(activeType)}
                                    className="flex-1 bg-[#4A43EC] h-12 rounded-xl flex-row items-center justify-center gap-2"
                                >
                                    <MaterialIcons name="file-upload" size={18} color="white" />
                                    <Text className="text-white font-lato-bold text-[11px]">Upload CSV</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={() => handleDownloadFormat(activeType)}
                                    className="flex-1 bg-white border border-gray-200 h-12 rounded-xl flex-row items-center justify-center gap-2"
                                >
                                    <MaterialIcons name="file-download" size={18} color="#6B7280" />
                                    <Text className="text-gray-500 font-lato-bold text-[11px]">Down format</Text>
                                </TouchableOpacity>
                            </View>
                            {configsList.length > 0 && (
                                <View className="w-full mt-1 gap-2">
                                    <View className="flex-row items-center gap-2">
                                        <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                                        <Text className="text-xs text-green-600 font-lato-bold">
                                            {configsList.length} units saved
                                        </Text>
                                    </View>
                                    {/* Header row */}
                                    <View className="flex-row bg-[#4A43EC]/10 rounded-lg px-3 py-2">
                                        <Text className="flex-1 text-[9px] font-lato-bold text-[#4A43EC] uppercase">Unit #</Text>
                                        <Text className="w-16 text-[9px] font-lato-bold text-[#4A43EC] uppercase">Tower/Block</Text>
                                        <Text className="w-12 text-[9px] font-lato-bold text-[#4A43EC] uppercase">Floor</Text>
                                        <Text className="w-14 text-[9px] font-lato-bold text-[#4A43EC] uppercase">BHK/Type</Text>
                                        <Text className="w-16 text-[9px] font-lato-bold text-[#4A43EC] uppercase text-right">Price</Text>
                                    </View>
                                    {/* Unit rows — cap at 50 for perf */}
                                    {configsList.slice(0, 50).map((u, idx) => (
                                        <View key={idx} className={`flex-row px-3 py-2 rounded-lg ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border border-gray-100`}>
                                            <Text className="flex-1 text-[10px] font-lato text-gray-700" numberOfLines={1}>{u.propertyNumber || '-'}</Text>
                                            <Text className="w-16 text-[10px] font-lato text-gray-500" numberOfLines={1}>{u.tower || '-'}</Text>
                                            <Text className="w-12 text-[10px] font-lato text-gray-500" numberOfLines={1}>{u.floor || '-'}</Text>
                                            <Text className="w-14 text-[10px] font-lato text-gray-500" numberOfLines={1}>{u.bhk || u.officeType || '-'}</Text>
                                            <Text className="w-16 text-[10px] font-lato-bold text-[#4A43EC] text-right" numberOfLines={1}>
                                                {u.price ? `₹${Number(u.price).toLocaleString('en-IN')}` : '-'}
                                            </Text>
                                        </View>
                                    ))}
                                    {configsList.length > 50 && (
                                        <Text className="text-[10px] text-gray-400 font-lato text-center py-1">
                                            +{configsList.length - 50} more units
                                        </Text>
                                    )}
                                </View>
                            )}
                        </View>
                    ) : (
                        <View className="gap-6">
                            {/* Section Management Header */}
                            {builderState && activeSection && (
                                <View className="gap-4">
                                    <View className="flex-row items-center justify-between">
                                        <Text className="text-sm font-lato-bold text-black">
                                            {RANGE_BASED_SUB_TYPES.has(activeType.subType)
                                                ? 'Range Types & Property Count'
                                                : (activeType.subType === 'apartment' ? 'Towers / Buildings' : 'Sections / Divisions')}
                                        </Text>
                                        <TouchableOpacity 
                                            onPress={handleAddSection}
                                            className="flex-row items-center bg-[#F4F7FF] border border-[#4A43EC]/30 px-3 py-1.5 rounded-full gap-1"
                                        >
                                            <Ionicons name="add-circle-outline" size={16} color="#4A43EC" />
                                            <Text className="text-[#4A43EC] text-xs font-lato-bold">
                                                Add {RANGE_BASED_SUB_TYPES.has(activeType.subType) ? 'Range' : (activeType.subType === 'apartment' ? 'Tower' : 'Section')}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                                        {builderState.sections.map(sec => (
                                            <TouchableOpacity
                                                key={sec.id}
                                                onPress={() => handleSetActiveSection(sec.id)}
                                                className={`px-4 py-2 rounded-xl border flex-row items-center gap-2 mr-2 ${sec.id === builderState.activeSectionId ? 'bg-[#4A43EC] border-[#4A43EC]' : 'bg-white border-gray-200'}`}
                                            >
                                                <Text className={`text-xs font-lato-bold ${sec.id === builderState.activeSectionId ? 'text-white' : 'text-gray-700'}`}>
                                                    {sec.name}
                                                </Text>
                                                {builderState.sections.length > 1 && (
                                                    <TouchableOpacity onPress={() => handleRemoveSection(sec.id)} className="p-0.5">
                                                        <Ionicons name="close-circle" size={16} color={sec.id === builderState.activeSectionId ? "white" : "#9CA3AF"} />
                                                    </TouchableOpacity>
                                                )}
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>

                                    {/* Active Section Settings Card */}
                                    <View className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm gap-4">
                                        <View>
                                            <Text className="text-xs font-lato-bold text-gray-500 mb-2">
                                                {RANGE_BASED_SUB_TYPES.has(activeType.subType)
                                                    ? 'Range Type (A, B, C...)'
                                                    : (activeType.subType === 'apartment' ? 'Tower Name' : 'Section Name')}
                                            </Text>
                                            <View className="bg-white border border-gray-200 rounded-xl px-4 h-12 justify-center">
                                                <TextInput
                                                    className="text-sm text-gray-800 font-lato-medium"
                                                    value={activeSection.name}
                                                    onChangeText={handleUpdateSectionName}
                                                    style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
                                                />
                                            </View>
                                        </View>

                                        {RANGE_BASED_SUB_TYPES.has(activeType.subType) ? (
                                            <View>
                                                <Text className="text-xs font-lato-bold text-gray-500 mb-2">No. of Properties in this Range</Text>
                                                <View className="bg-white border border-gray-200 rounded-xl px-4 h-12 justify-center">
                                                    <TextInput
                                                        className="text-sm text-gray-800 font-lato-medium"
                                                        keyboardType="numeric"
                                                        value={(activeSection.unitsPerFloor ?? activeSection.plotsPerRow ?? activeSection.villasPerLane ?? 0).toString()}
                                                        onChangeText={v => handleUpdateDimensions(activeType.subType === 'plot' ? 'plotsPerRow' : (activeType.subType === 'villa' || activeType.subType === 'rowhouse' ? 'villasPerLane' : 'unitsPerFloor'), v)}
                                                        style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
                                                    />
                                                </View>
                                            </View>
                                        ) : (
                                            <View className="flex-row gap-4">
                                                <View className="flex-1">
                                                    <Text className="text-xs font-lato-bold text-gray-500 mb-2">
                                                        {activeType.subType === 'plot' ? 'Number of Rows' : (activeType.subType === 'villa' || activeType.subType === 'rowhouse' ? 'Number of Lanes' : 'Number of Floors')}
                                                    </Text>
                                                    <View className="bg-white border border-gray-200 rounded-xl px-4 h-12 justify-center">
                                                        <TextInput
                                                            className="text-sm text-gray-800 font-lato-medium"
                                                            keyboardType="numeric"
                                                            value={(activeSection.floors ?? activeSection.rows ?? activeSection.lanes ?? 0).toString()}
                                                            onChangeText={v => handleUpdateDimensions(activeType.subType === 'plot' ? 'rows' : (activeType.subType === 'villa' || activeType.subType === 'rowhouse' ? 'lanes' : 'floors'), v)}
                                                            style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
                                                        />
                                                    </View>
                                                </View>
                                                <View className="flex-1">
                                                    <Text className="text-xs font-lato-bold text-gray-500 mb-2">
                                                        {activeType.subType === 'plot' ? 'Plots per Row' : (activeType.subType === 'villa' || activeType.subType === 'rowhouse' ? 'Villas per Lane' : 'Units per Floor')}
                                                    </Text>
                                                    <View className="bg-white border border-gray-200 rounded-xl px-4 h-12 justify-center">
                                                        <TextInput
                                                            className="text-sm text-gray-800 font-lato-medium"
                                                            keyboardType="numeric"
                                                            value={(activeSection.unitsPerFloor ?? activeSection.plotsPerRow ?? activeSection.villasPerLane ?? 0).toString()}
                                                            onChangeText={v => handleUpdateDimensions(activeType.subType === 'plot' ? 'plotsPerRow' : (activeType.subType === 'villa' || activeType.subType === 'rowhouse' ? 'villasPerLane' : 'unitsPerFloor'), v)}
                                                            style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
                                                        />
                                                    </View>
                                                </View>
                                            </View>
                                        )}
                                    </View>

                                    {/* Variant Configs Section */}
                                    <View className="gap-4 mt-2">
                                        <View className="flex-row items-center justify-between">
                                            <Text className="text-sm font-lato-bold text-black">Define Variant Types & Pricing</Text>
                                            <TouchableOpacity 
                                                onPress={handleAddConfig}
                                                className="flex-row items-center bg-[#F4F7FF] border border-[#4A43EC]/30 px-3 py-1.5 rounded-full gap-1"
                                            >
                                                <Ionicons name="add-circle-outline" size={16} color="#4A43EC" />
                                                <Text className="text-[#4A43EC] text-xs font-lato-bold">Add Variant</Text>
                                            </TouchableOpacity>
                                        </View>

                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-3">
                                            {activeSection.configs?.length === 0 && (
                                                <View className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-4 mr-3 w-48 opacity-60">
                                                    <View className="flex-row items-center gap-1.5 mb-2">
                                                        <View className="w-3 h-3 rounded-full bg-gray-400" />
                                                        <Text className="text-xs font-lato-bold text-gray-500">Example: 2 BHK</Text>
                                                    </View>
                                                    <Text className="text-[11px] text-gray-400 font-lato-medium mb-2">Standard</Text>
                                                    <View className="flex-row items-center justify-between border-t border-gray-200 pt-2 mt-1">
                                                        <Text className="text-[11px] font-lato-bold text-gray-400">1150 {activeType.subType === 'plot' ? 'sqyd' : 'sqft'}</Text>
                                                        <Text className="text-[11px] font-lato-bold text-gray-400">₹65,00,000</Text>
                                                    </View>
                                                </View>
                                            )}

                                            {activeSection.configs?.map(cfg => (
                                                <TouchableOpacity
                                                    key={cfg.id}
                                                    onPress={() => handleSetActiveConfig(cfg.id)}
                                                    className={`bg-white border rounded-xl p-3 mb-1 mr-3 w-40 shadow-xs ${cfg.id === builderState.activeConfigId ? 'border-[#4A43EC] bg-[#F4F7FF]/50' : 'border-gray-200'}`}
                                                >
                                                    <View className="flex-row items-center justify-between mb-1.5">
                                                        <View className="flex-row items-center gap-1.5 flex-1 mr-1">
                                                            <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.color || '#3B82F6' }} />
                                                            <Text className="text-xs font-lato-bold text-gray-800" numberOfLines={1}>
                                                                {cfg.type || (activeType.subType === 'office' ? 'New Office' : (activeType.subType === 'plot' ? 'New Plot' : 'New Variant'))}
                                                            </Text>
                                                        </View>
                                                        <View className="flex-row items-center gap-1">
                                                            {cfg.id === builderState.activeConfigId && (
                                                                <View className="bg-[#4A43EC] rounded-full p-0.5">
                                                                    <Ionicons name="checkmark" size={10} color="white" />
                                                                </View>
                                                            )}
                                                            <TouchableOpacity onPress={() => handleRemoveConfig(cfg.id)} className="p-0.5">
                                                                <Ionicons name="close-circle" size={16} color="#EF4444" />
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                    <Text className="text-[10px] text-gray-500 font-lato-medium mb-1.5" numberOfLines={1}>{cfg.name || 'Unnamed'}</Text>
                                                    <View className="flex-row items-center justify-between border-t border-gray-100 pt-1.5 mt-0.5">
                                                        <Text className="text-[10px] font-lato-bold text-gray-700">{cfg.area ? `${cfg.area} ${activeType.subType === 'plot' ? 'sqyd' : 'sqft'}` : '0 sqft'}</Text>
                                                        <Text className="text-[10px] font-lato-bold text-[#4A43EC]">{cfg.price ? `₹${cfg.price}` : '₹0'}</Text>
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>

                                        {/* Edit Active Config Form */}
                                        {activeConfig && (
                                            <View className="bg-[#F4F7FF]/40 border border-[#4A43EC]/20 rounded-3xl p-5 gap-4">
                                                <Text className="text-xs font-lato-bold text-[#4A43EC]">
                                                    Edit Active Variant: {activeConfig.type || 'New Variant'}
                                                </Text>
                                                <View className="flex-row gap-4">
                                                    <View className="flex-1">
                                                        <Text className="text-[11px] font-lato-bold text-gray-500 mb-1.5">Category / Type</Text>
                                                        <View className="bg-white border border-gray-200 rounded-xl px-3 h-11 justify-center">
                                                            <TextInput
                                                                className="text-xs text-gray-800 font-lato-medium"
                                                                placeholder={activeType.subType === 'office' ? 'eg. Co-working' : (activeType.subType === 'plot' ? 'eg. Standard Plot' : 'eg. 2 BHK')}
                                                                placeholderTextColor="#9CA3AF"
                                                                value={activeConfig.type}
                                                                onChangeText={v => handleUpdateConfigField(activeConfig.id, 'type', v)}
                                                                style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
                                                            />
                                                        </View>
                                                    </View>
                                                    <View className="flex-1">
                                                        <Text className="text-[11px] font-lato-bold text-gray-500 mb-1.5">Variant Name</Text>
                                                        <View className="bg-white border border-gray-200 rounded-xl px-3 h-11 justify-center">
                                                            <TextInput
                                                                className="text-xs text-gray-800 font-lato-medium"
                                                                placeholder="eg. Standard / Premium"
                                                                placeholderTextColor="#9CA3AF"
                                                                value={activeConfig.name}
                                                                onChangeText={v => handleUpdateConfigField(activeConfig.id, 'name', v)}
                                                                style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
                                                            />
                                                        </View>
                                                    </View>
                                                </View>

                                                <View className="gap-3">
                                                    <View className="flex-row items-center justify-between">
                                                        <Text className="text-[11px] font-lato-bold text-gray-500">Variant Images</Text>
                                                        <TouchableOpacity
                                                            onPress={() => handlePickVariantImages(activeConfig.id)}
                                                            className="px-3 py-1.5 rounded-full bg-white border border-[#4A43EC]/20"
                                                        >
                                                            <Text className="text-[10px] font-lato-bold text-[#4A43EC]">Add Images</Text>
                                                        </TouchableOpacity>
                                                    </View>

                                                    <Text className="text-[10px] text-gray-500 font-lato-medium px-1">
                                                        Add up to 5 images for this variant.
                                                    </Text>

                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                                                        {(activeConfig.images || []).map((uri) => (
                                                            <View key={uri} className="mr-2 relative">
                                                                <View className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200">
                                                                    <Image source={{ uri }} className="w-full h-full" resizeMode="cover" />
                                                                </View>
                                                                <TouchableOpacity
                                                                    onPress={() => handleRemoveVariantImage(activeConfig.id, uri)}
                                                                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 items-center justify-center"
                                                                >
                                                                    <Ionicons name="close" size={12} color="white" />
                                                                </TouchableOpacity>
                                                            </View>
                                                        ))}

                                                        {(activeConfig.images || []).length < 5 && (
                                                            <TouchableOpacity
                                                                onPress={() => handlePickVariantImages(activeConfig.id)}
                                                                className="w-20 h-20 rounded-2xl border border-dashed border-[#4A43EC]/40 bg-[#F4F7FF] items-center justify-center mr-2"
                                                            >
                                                                <Ionicons name="add" size={22} color="#4A43EC" />
                                                                <Text className="text-[9px] font-lato-bold text-[#4A43EC] mt-1">Add</Text>
                                                            </TouchableOpacity>
                                                        )}
                                                    </ScrollView>
                                                </View>

                                                <View className="gap-3">
                                                    <View className="flex-row items-center justify-between">
                                                        <Text className="text-[11px] font-lato-bold text-gray-500">Brochure Document</Text>
                                                        <TouchableOpacity
                                                            onPress={() => handlePickVariantBrochure(activeConfig.id)}
                                                            className="px-3 py-1.5 rounded-full bg-white border border-[#4A43EC]/20"
                                                        >
                                                            <Text className="text-[10px] font-lato-bold text-[#4A43EC]">
                                                                {activeConfig.brochure?.uri ? 'Replace Brochure' : 'Upload Brochure'}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    </View>

                                                    {activeConfig.brochure?.uri ? (
                                                        <View className="flex-row items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-3">
                                                            <View className="flex-row items-center flex-1 mr-3">
                                                                <View className="w-8 h-8 rounded-lg bg-[#F4F7FF] items-center justify-center mr-2">
                                                                    <Ionicons name="document-text-outline" size={16} color="#4A43EC" />
                                                                </View>
                                                                <Text className="text-[11px] font-lato-medium text-gray-700 flex-1" numberOfLines={1}>
                                                                    {activeConfig.brochure.name || 'Brochure'}
                                                                </Text>
                                                            </View>
                                                            <TouchableOpacity
                                                                onPress={() => handleRemoveVariantBrochure(activeConfig.id)}
                                                                className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 items-center justify-center"
                                                            >
                                                                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                                                            </TouchableOpacity>
                                                        </View>
                                                    ) : (
                                                        <TouchableOpacity
                                                            onPress={() => handlePickVariantBrochure(activeConfig.id)}
                                                            className="bg-white border border-dashed border-[#4A43EC]/35 rounded-xl px-3 py-3 flex-row items-center"
                                                        >
                                                            <View className="w-8 h-8 rounded-lg bg-[#F4F7FF] items-center justify-center mr-2">
                                                                <Ionicons name="attach-outline" size={16} color="#4A43EC" />
                                                            </View>
                                                            <Text className="text-[11px] font-lato-medium text-gray-600">
                                                                Add brochure (PDF/DOC)
                                                            </Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>

                                                <View className="gap-3">
                                                    <View className="flex-row items-center justify-between">
                                                        <Text className="text-[11px] font-lato-bold text-gray-500">Amenities</Text>
                                                        <TouchableOpacity
                                                            onPress={() => handleAddAmenity(activeConfig.id)}
                                                            className="px-3 py-1.5 rounded-full bg-white border border-[#4A43EC]/20"
                                                        >
                                                            <Text className="text-[10px] font-lato-bold text-[#4A43EC]">Add Amenity</Text>
                                                        </TouchableOpacity>
                                                    </View>

                                                    {(activeConfig.amenities || ['']).map((amenity, index) => (
                                                        <View key={`${activeConfig.id}-amenity-${index}`} className="flex-row items-center gap-2">
                                                            <View className="flex-1 bg-white border border-gray-200 rounded-xl px-3 h-11 justify-center">
                                                                <TextInput
                                                                    className="text-xs text-gray-800 font-lato-medium"
                                                                    placeholder="Add amenity"
                                                                    value={amenity}
                                                                    onChangeText={(v) => handleUpdateAmenity(activeConfig.id, index, v)}
                                                                    style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
                                                                />
                                                            </View>
                                                            {(activeConfig.amenities || ['']).length > 1 && (
                                                                <TouchableOpacity
                                                                    onPress={() => handleRemoveAmenity(activeConfig.id, index)}
                                                                    className="w-10 h-11 rounded-xl bg-red-50 border border-red-100 items-center justify-center"
                                                                >
                                                                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                                                                </TouchableOpacity>
                                                            )}
                                                        </View>
                                                    ))}
                                                </View>

                                                <View className="flex-row gap-4">
                                                    <View className="flex-1">
                                                        <Text className="text-[11px] font-lato-bold text-gray-500 mb-1.5">Area ({activeType.subType === 'plot' ? 'sqyd' : 'sqft'})</Text>
                                                        <View className="bg-white border border-gray-200 rounded-xl px-3 h-11 justify-center">
                                                            <TextInput
                                                                className="text-xs text-gray-800 font-lato-medium"
                                                                placeholder={activeType.subType === 'plot' ? 'eg. 150' : 'eg. 1150'}
                                                                placeholderTextColor="#9CA3AF"
                                                                keyboardType="numeric"
                                                                value={activeConfig.area}
                                                                onChangeText={v => handleUpdateConfigField(activeConfig.id, 'area', v)}
                                                                style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
                                                            />
                                                        </View>
                                                    </View>
                                                    <View className="flex-1">
                                                        <Text className="text-[11px] font-lato-bold text-gray-500 mb-1.5">Selling Price (₹)</Text>
                                                        <View className="bg-white border border-gray-200 rounded-xl px-3 h-11 justify-center">
                                                            <TextInput
                                                                className="text-xs text-gray-800 font-lato-medium"
                                                                placeholder="eg. 6500000"
                                                                placeholderTextColor="#9CA3AF"
                                                                keyboardType="numeric"
                                                                value={activeConfig.price}
                                                                onChangeText={v => handleUpdateConfigField(activeConfig.id, 'price', v)}
                                                                style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
                                                            />
                                                        </View>
                                                    </View>
                                                </View>
                                            </View>
                                        )}
                                    </View>

                                    {/* Grid Mode Switcher & Visual Grid */}
                                    <View className="gap-4 mt-2">
                                        <View className="flex-row items-center justify-between z-40">
                                            <View className="flex-1 mr-4">
                                                <Text className="text-xs font-lato-bold text-gray-700 mb-1">Matrix Interaction Mode</Text>
                                                <Text className="text-[11px] font-lato text-gray-400">Choose whether to paint variants or edit individual unit overrides</Text>
                                            </View>
                                            
                                            <View className="relative w-48">
                                                <TouchableOpacity
                                                    onPress={() => setOpenGridModeDropdown(!openGridModeDropdown)}
                                                    className="flex-row items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-2.5 shadow-sm"
                                                >
                                                    <View className="flex-row items-center gap-2">
                                                        <Ionicons name={builderState.gridMode === 'paint' ? "color-palette-outline" : "create-outline"} size={16} color="#4A43EC" />
                                                        <Text className="text-xs font-lato-bold text-[#4A43EC]">
                                                            {builderState.gridMode === 'paint' ? 'Paint Grid' : 'Edit Overrides'}
                                                        </Text>
                                                    </View>
                                                    <Ionicons name={openGridModeDropdown ? "chevron-up" : "chevron-down"} size={16} color="#4A43EC" />
                                                </TouchableOpacity>

                                                {openGridModeDropdown && (
                                                    <View className="absolute top-12 left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg shadow-gray-200 py-1.5 z-50">
                                                        <TouchableOpacity
                                                            onPress={() => {
                                                                handleUpdateBuilder(prev => ({ ...prev, gridMode: 'paint', selectedUnitKey: null }));
                                                                setOpenGridModeDropdown(false);
                                                            }}
                                                            className="px-4 py-2.5 hover:bg-gray-50 flex-row items-center justify-between"
                                                        >
                                                            <View className="flex-row items-center gap-2">
                                                                <Ionicons name="color-palette-outline" size={16} color="#4A43EC" />
                                                                <Text className="text-xs font-lato-medium text-gray-800">Paint Grid</Text>
                                                            </View>
                                                            {builderState.gridMode === 'paint' && <Ionicons name="checkmark-circle" size={16} color="#4A43EC" />}
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            onPress={() => {
                                                                handleUpdateBuilder(prev => ({ ...prev, gridMode: 'edit' }));
                                                                setOpenGridModeDropdown(false);
                                                            }}
                                                            className="px-4 py-2.5 hover:bg-gray-50 flex-row items-center justify-between border-t border-gray-50"
                                                        >
                                                            <View className="flex-row items-center gap-2">
                                                                <Ionicons name="create-outline" size={16} color="#4A43EC" />
                                                                <Text className="text-xs font-lato-medium text-gray-800">Edit Overrides</Text>
                                                            </View>
                                                            {builderState.gridMode === 'edit' && <Ionicons name="checkmark-circle" size={16} color="#4A43EC" />}
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>
                                        </View>

                                        {builderState.gridMode === 'paint' ? (
                                            <View className="gap-3">
                                                <View className="flex-row items-center justify-between px-1">
                                                    <Text className="text-xs font-lato-bold text-gray-500">
                                                        Click units below to assign: <Text className="text-[#4A43EC]">{activeConfig?.type}</Text>
                                                    </Text>
                                                    <View className="flex-row gap-2">
                                                        <TouchableOpacity onPress={handleSelectAll} className="px-3 py-1 bg-[#F4F7FF] border border-[#4A43EC]/20 rounded-lg">
                                                            <Text className="text-[10px] font-lato-bold text-[#4A43EC]">Select All</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity onPress={handleClearAll} className="px-3 py-1 bg-red-50 border border-red-100 rounded-lg">
                                                            <Text className="text-[10px] font-lato-bold text-red-500">Clear All</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>

                                                <View className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm gap-4 overflow-hidden">
                                                    {sectionsForGrid.map((section) => {
                                                        const rows = section.floors ?? section.rows ?? section.lanes ?? 1;
                                                        const rowsArr = Array.from({ length: rows }, (_, i) => activeType.subType === 'plot' ? i + 1 : rows - i);

                                                        return (
                                                            <View key={`paint-section-${section.id}`} className="gap-3">
                                                                {rowsArr.map(r => (
                                                                    <View key={`${section.id}-${r}`} className="flex-row items-center gap-3">
                                                                        <View className="w-16 h-16 bg-[#F8FAFC] border border-gray-200 rounded-2xl items-center justify-center shadow-xs">
                                                                            <Text className="text-xs font-lato-bold text-gray-700 uppercase tracking-wider">
                                                                                {RANGE_BASED_SUB_TYPES.has(activeType.subType)
                                                                                    ? `RANGE ${section.name}`
                                                                                    : (activeType.subType === 'plot' ? `ROW ${r}` : (activeType.subType === 'villa' || activeType.subType === 'rowhouse' ? `LANE ${r}` : `FL ${r}`))}
                                                                            </Text>
                                                                            <Text className="text-[9px] font-lato-bold text-gray-400 mt-1">
                                                                                {getRowUnitCount(section, r)} units
                                                                            </Text>
                                                                        </View>

                                                                        <View className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
                                                                            <TouchableOpacity
                                                                                onPress={() => handleAdjustRowUnits(r, 1, section.id)}
                                                                                className="w-10 h-8 items-center justify-center border-b border-gray-100"
                                                                            >
                                                                                <Ionicons name="add" size={16} color="#4A43EC" />
                                                                            </TouchableOpacity>
                                                                            <TouchableOpacity
                                                                                onPress={() => handleAdjustRowUnits(r, -1, section.id)}
                                                                                className="w-10 h-8 items-center justify-center"
                                                                            >
                                                                                <Ionicons name="remove" size={16} color="#EF4444" />
                                                                            </TouchableOpacity>
                                                                        </View>

                                                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1 flex-row gap-3">
                                                                            {Array.from({ length: getRowUnitCount(section, r) }, (_, i) => i + 1).map(c => {
                                                                                const key = `${r}_${c}`;
                                                                                const assignedCfgId = section.unitMap?.[key];
                                                                                const assignedCfg = section.configs?.find(cfg => cfg.id === assignedCfgId);
                                                                                const override = section.unitOverrides?.[key] || {};
                                                                                const displayNum = `${r}${c.toString().padStart(2, '0')}`;
                                                                                const rangeLabel = (section.name || '').trim() || 'A';
                                                                                const rangeBasedNumber = `${rangeLabel}-${c}`;
                                                                                const defaultPropertyNumber = RANGE_BASED_SUB_TYPES.has(activeType?.subType)
                                                                                    ? rangeBasedNumber
                                                                                    : displayNum;
                                                                                const label = override.customName || defaultPropertyNumber;
                                                                                const hasOverride = override.customName || override.customArea || override.customPrice;

                                                                                return (
                                                                                    <TouchableOpacity
                                                                                        key={`${section.id}-${key}`}
                                                                                        onPress={() => handleCellClick(key, section.id)}
                                                                                        style={{
                                                                                            backgroundColor: assignedCfg ? assignedCfg.color : '#FFFFFF',
                                                                                            borderColor: assignedCfg ? assignedCfg.color : '#CBD5E1',
                                                                                            borderWidth: assignedCfg ? 0 : 1.5,
                                                                                            borderStyle: assignedCfg ? 'solid' : 'dashed'
                                                                                        }}
                                                                                        className="w-28 h-16 rounded-2xl items-center justify-center mr-3 relative overflow-hidden shadow-xs"
                                                                                    >
                                                                                        <Text className={`text-xs font-lato-bold ${assignedCfg ? 'text-white' : 'text-gray-400'}`} numberOfLines={1}>
                                                                                            {label}
                                                                                        </Text>
                                                                                        {assignedCfg ? (
                                                                                            <>
                                                                                                <Text className="text-[10px] font-lato-bold text-white/95 mt-0.5" numberOfLines={1}>
                                                                                                    {assignedCfg.type}
                                                                                                </Text>
                                                                                                <Text className="text-[9px] font-lato-bold text-white/85 uppercase tracking-wider mt-0.5" numberOfLines={1}>
                                                                                                    {assignedCfg.name}
                                                                                                </Text>
                                                                                            </>
                                                                                        ) : (
                                                                                            <Text className="text-[9px] font-lato text-gray-300 mt-1 uppercase" numberOfLines={1}>
                                                                                                Unassigned
                                                                                            </Text>
                                                                                        )}
                                                                                    </TouchableOpacity>
                                                                                );
                                                                            })}
                                                                        </ScrollView>
                                                                    </View>
                                                                ))}
                                                            </View>
                                                        );
                                                    })}

                                                    {/* Bottom Foundation Bar */}
                                                    <View className="bg-[#E2E8F0] h-6 rounded-xl mt-2 border border-gray-300 shadow-xs" />
                                                </View>
                                            </View>
                                        ) : (
                                            <View className="gap-4">
                                                <Text className="text-xs font-lato-bold text-gray-500 px-1">
                                                    Click any unit on the grid below to customize its specific price, area, or property number.
                                                </Text>

                                                <View className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm gap-4 overflow-hidden">
                                                    {sectionsForGrid.map((section) => {
                                                        const rows = section.floors ?? section.rows ?? section.lanes ?? 1;
                                                        const rowsArr = Array.from({ length: rows }, (_, i) => activeType.subType === 'plot' ? i + 1 : rows - i);

                                                        return (
                                                            <View key={`edit-section-${section.id}`} className="gap-3">
                                                                {rowsArr.map(r => (
                                                                    <View key={`${section.id}-${r}`} className="flex-row items-center gap-3">
                                                                        <View className="w-16 h-16 bg-[#F8FAFC] border border-gray-200 rounded-2xl items-center justify-center shadow-xs">
                                                                            <Text className="text-xs font-lato-bold text-gray-700 uppercase tracking-wider">
                                                                                {RANGE_BASED_SUB_TYPES.has(activeType.subType)
                                                                                    ? `RANGE ${section.name}`
                                                                                    : (activeType.subType === 'plot' ? `ROW ${r}` : (activeType.subType === 'villa' || activeType.subType === 'rowhouse' ? `LANE ${r}` : `FL ${r}`))}
                                                                            </Text>
                                                                            <Text className="text-[9px] font-lato-bold text-gray-400 mt-1">
                                                                                {getRowUnitCount(section, r)} units
                                                                            </Text>
                                                                        </View>

                                                                        <View className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
                                                                            <TouchableOpacity
                                                                                onPress={() => handleAdjustRowUnits(r, 1, section.id)}
                                                                                className="w-10 h-8 items-center justify-center border-b border-gray-100"
                                                                            >
                                                                                <Ionicons name="add" size={16} color="#4A43EC" />
                                                                            </TouchableOpacity>
                                                                            <TouchableOpacity
                                                                                onPress={() => handleAdjustRowUnits(r, -1, section.id)}
                                                                                className="w-10 h-8 items-center justify-center"
                                                                            >
                                                                                <Ionicons name="remove" size={16} color="#EF4444" />
                                                                            </TouchableOpacity>
                                                                        </View>

                                                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1 flex-row gap-3">
                                                                            {Array.from({ length: getRowUnitCount(section, r) }, (_, i) => i + 1).map(c => {
                                                                                const key = `${r}_${c}`;
                                                                                const compositeKey = `${section.id}:${key}`;
                                                                                const isSelected = builderState.selectedUnitKey === compositeKey;
                                                                                const assignedCfgId = section.unitMap?.[key];
                                                                                const assignedCfg = section.configs?.find(cfg => cfg.id === assignedCfgId);
                                                                                const override = section.unitOverrides?.[key] || {};
                                                                                const displayNum = `${r}${c.toString().padStart(2, '0')}`;
                                                                                const rangeLabel = (section.name || '').trim() || 'A';
                                                                                const rangeBasedNumber = `${rangeLabel}-${c}`;
                                                                                const defaultPropertyNumber = RANGE_BASED_SUB_TYPES.has(activeType?.subType)
                                                                                    ? rangeBasedNumber
                                                                                    : displayNum;
                                                                                const label = override.customName || defaultPropertyNumber;
                                                                                const hasOverride = override.customName || override.customArea || override.customPrice;

                                                                                return (
                                                                                    <TouchableOpacity
                                                                                        key={`${section.id}-${key}`}
                                                                                        onPress={() => handleCellClick(key, section.id)}
                                                                                        style={{
                                                                                            backgroundColor: isSelected ? '#4A43EC' : (assignedCfg ? assignedCfg.color : '#FFFFFF'),
                                                                                            borderColor: isSelected ? '#000000' : (assignedCfg ? assignedCfg.color : '#CBD5E1'),
                                                                                            borderWidth: isSelected ? 3 : (assignedCfg ? 0 : 1.5),
                                                                                            borderStyle: assignedCfg || isSelected ? 'solid' : 'dashed'
                                                                                        }}
                                                                                        className="w-28 h-16 rounded-2xl items-center justify-center mr-3 relative overflow-hidden shadow-xs"
                                                                                    >
                                                                                        <Text className={`text-xs font-lato-bold ${assignedCfg || isSelected ? 'text-white' : 'text-gray-400'}`} numberOfLines={1}>
                                                                                            {label}
                                                                                        </Text>
                                                                                        {assignedCfg ? (
                                                                                            <>
                                                                                                <Text className="text-[10px] font-lato-bold text-white/95 mt-0.5" numberOfLines={1}>
                                                                                                    {assignedCfg.type}
                                                                                                </Text>
                                                                                                <Text className="text-[9px] font-lato-bold text-white/90 uppercase tracking-wider mt-0.5" numberOfLines={1}>
                                                                                                    {override.customPrice ? `₹${override.customPrice}` : `₹${assignedCfg.price}`}
                                                                                                </Text>
                                                                                            </>
                                                                                        ) : (
                                                                                            <Text className="text-[9px] font-lato text-gray-300 mt-1 uppercase" numberOfLines={1}>
                                                                                                Unassigned
                                                                                            </Text>
                                                                                        )}
                                                                                    </TouchableOpacity>
                                                                                );
                                                                            })}
                                                                        </ScrollView>
                                                                    </View>
                                                                ))}
                                                            </View>
                                                        );
                                                    })}

                                                    {/* Bottom Foundation Bar */}
                                                    <View className="bg-[#E2E8F0] h-6 rounded-xl mt-2 border border-gray-300 shadow-xs" />
                                                </View>

                                                {/* Selected Unit Override Card */}
                                                {builderState.selectedUnitKey && (() => {
                                                    const [sectionIdRaw, key] = builderState.selectedUnitKey.includes(':')
                                                        ? builderState.selectedUnitKey.split(':')
                                                        : [String(builderState.activeSectionId), builderState.selectedUnitKey];
                                                    const selectedSection = builderState.sections.find(sec => sec.id === parseInt(sectionIdRaw, 10));
                                                    if (!selectedSection) return null;

                                                    const [r, c] = key.split('_');
                                                    const assignedCfgId = selectedSection.unitMap?.[key];
                                                    const assignedCfg = selectedSection.configs?.find(cfg => cfg.id === assignedCfgId) || {};
                                                    const override = selectedSection.unitOverrides?.[key] || {};
                                                    const displayNum = `${r}${c.padStart(2, '0')}`;
                                                    const defaultPropNum = RANGE_BASED_SUB_TYPES.has(activeType.subType)
                                                        ? `${selectedSection.name || 'A'}-${c}`
                                                        : displayNum;
                                                    const selectedCompositeKey = `${selectedSection.id}:${key}`;

                                                    return (
                                                        <View className="bg-white border border-[#4A43EC] rounded-3xl p-6 shadow-md gap-4">
                                                            <View className="flex-row items-center justify-between border-b border-gray-100 pb-3">
                                                                <View>
                                                                    <Text className="text-sm font-lato-bold text-black">Customize Unit: {override.customName || defaultPropNum}</Text>
                                                                    <Text className="text-xs text-gray-500 font-lato mt-0.5">{RANGE_BASED_SUB_TYPES.has(activeType.subType) ? `Range ${selectedSection.name} • ` : ''}Base Variant: {assignedCfg.type || 'Unassigned'}</Text>
                                                                </View>
                                                                <TouchableOpacity onPress={() => handleUpdateBuilder(prev => ({ ...prev, selectedUnitKey: null }))}>
                                                                    <Ionicons name="close-circle" size={24} color="#9CA3AF" />
                                                                </TouchableOpacity>
                                                            </View>

                                                            <View className="gap-4">
                                                                <View>
                                                                    <Text className="text-xs font-lato-bold text-gray-500 mb-1.5">Custom Property Number</Text>
                                                                    <View className="bg-white border border-gray-200 rounded-xl px-4 h-12 justify-center">
                                                                        <TextInput
                                                                            className="text-sm text-gray-800 font-lato-medium"
                                                                            placeholder={defaultPropNum}
                                                                            value={override.customName || ''}
                                                                            onChangeText={v => handleUpdateOverride(selectedCompositeKey, 'customName', v)}
                                                                            style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
                                                                        />
                                                                    </View>
                                                                </View>

                                                                <View className="flex-row gap-4">
                                                                    <View className="flex-1">
                                                                        <Text className="text-xs font-lato-bold text-gray-500 mb-1.5">Custom Area</Text>
                                                                        <View className="bg-white border border-gray-200 rounded-xl px-4 h-12 justify-center">
                                                                            <TextInput
                                                                                className="text-sm text-gray-800 font-lato-medium"
                                                                                placeholder={assignedCfg.area || '0'}
                                                                                keyboardType="numeric"
                                                                                value={override.customArea || ''}
                                                                                onChangeText={v => handleUpdateOverride(selectedCompositeKey, 'customArea', v)}
                                                                                style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
                                                                            />
                                                                        </View>
                                                                    </View>
                                                                    <View className="flex-1">
                                                                        <Text className="text-xs font-lato-bold text-gray-500 mb-1.5">Custom Price (₹)</Text>
                                                                        <View className="bg-white border border-gray-200 rounded-xl px-4 h-12 justify-center">
                                                                            <TextInput
                                                                                className="text-sm text-gray-800 font-lato-medium"
                                                                                placeholder={assignedCfg.price || '0'}
                                                                                keyboardType="numeric"
                                                                                value={override.customPrice || ''}
                                                                                onChangeText={v => handleUpdateOverride(selectedCompositeKey, 'customPrice', v)}
                                                                                style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
                                                                            />
                                                                        </View>
                                                                    </View>
                                                                </View>
                                                            </View>
                                                        </View>
                                                    );
                                                })()}
                                            </View>
                                        )}
                                    </View>

                                    {/* Summary Banner at Bottom */}
                                    <View className="bg-green-50 border border-green-200 rounded-2xl p-4 flex-row items-center gap-3 mt-4">
                                        <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                                        <View className="flex-1">
                                            <Text className="text-xs font-lato-bold text-green-800">
                                                ✓ {configsList.length} units successfully generated & synced.
                                            </Text>
                                            <Text className="text-[10px] text-green-600 font-lato mt-0.5">
                                                Project Engine automatically maintains data structure for Step 4.
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

const FormSection = ({ title, children }) => (
    <View className="bg-white border border-gray-100 rounded-2xl p-4 gap-4">
        <Text className="text-sm font-lato-bold text-black">{title}</Text>
        {children}
    </View>
);

const formatDateDisplay = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const DatePickerField = ({ label, value, fieldKey, pickerVisible, setPickerVisible, onDateChange, minDate, maxDate }) => {
    const isOpen = pickerVisible === fieldKey;
    const dateValue = value ? new Date(value) : new Date();

    const handleChange = (event, selectedDate) => {
        if (Platform.OS === "android") {
            setPickerVisible(null);
            if (event.type === "set" && selectedDate) {
                onDateChange(selectedDate.toISOString().split("T")[0]);
            }
            return;
        }
        if (selectedDate) {
            onDateChange(selectedDate.toISOString().split("T")[0]);
        }
    };

    const openPicker = () => {
        if (Platform.OS === "android") {
            DateTimePickerAndroid.open({
                value: dateValue,
                mode: "date",
                minimumDate: minDate,
                maximumDate: maxDate,
                onChange: handleChange,
            });
        } else {
            setPickerVisible(isOpen ? null : fieldKey);
        }
    };

    return (
        <View>
            <Text className="text-xs font-lato-bold text-black mb-1.5">{label}</Text>
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={openPicker}
                className="bg-white border border-gray-200 rounded-xl px-4 h-12 flex-row items-center justify-between"
            >
                <Text className={`text-[13px] font-lato-medium ${value ? "text-gray-800" : "text-gray-400"}`}>
                    {value ? formatDateDisplay(value) : `Select ${label.toLowerCase()}`}
                </Text>
                <Ionicons name="calendar-outline" size={18} color="#4A43EC" />
            </TouchableOpacity>
            {Platform.OS === "ios" && isOpen && (
                <Modal transparent animationType="fade" onRequestClose={() => setPickerVisible(null)}>
                    <TouchableOpacity
                        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}
                        activeOpacity={1}
                        onPress={() => setPickerVisible(null)}
                    >
                        <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingBottom: 24, paddingTop: 12 }}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                <TouchableOpacity onPress={() => setPickerVisible(null)}>
                                    <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "600" }}>Cancel</Text>
                                </TouchableOpacity>
                                <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>{label}</Text>
                                <TouchableOpacity onPress={() => setPickerVisible(null)}>
                                    <Text style={{ fontSize: 13, color: "#4A43EC", fontWeight: "700" }}>Done</Text>
                                </TouchableOpacity>
                            </View>
                            <DateTimePicker
                                value={dateValue}
                                mode="date"
                                display="spinner"
                                minimumDate={minDate}
                                maximumDate={maxDate}
                                textColor="#111827"
                                themeVariant="light"
                                accentColor="#4A43EC"
                                onChange={handleChange}
                            />
                        </View>
                    </TouchableOpacity>
                </Modal>
            )}
        </View>
    );
};

const OptionGroup = ({ label, options, value, onChange }) => (
    <View>
        {label ? <Text className="text-xs font-lato-bold text-black mb-2">{label}</Text> : null}
        <View className="flex-row flex-wrap gap-2">
            {options.map(option => (
                <TouchableOpacity
                    key={option}
                    onPress={() => onChange(option)}
                    className={`px-3 py-2 rounded-full border ${value === option ? 'bg-[#EBEAFF] border-[#4A43EC]' : 'bg-white border-gray-200'}`}
                >
                    <Text className={`text-[11px] font-lato-bold ${value === option ? 'text-[#4A43EC]' : 'text-gray-500'}`}>{option}</Text>
                </TouchableOpacity>
            ))}
        </View>
    </View>
);

const getInputTypeProps = (label = "", placeholder = "", keyboardType = "default") => {
    if (keyboardType !== "default") return { keyboardType };

    const text = `${label} ${placeholder}`.toLowerCase();
    if (text.includes("date") || text.includes("time")) {
        return {
            keyboardType: Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric",
            inputMode: "numeric",
        };
    }
    if (
        text.includes("amount") ||
        text.includes("price") ||
        text.includes("percentage") ||
        text.includes("number of months") ||
        text.includes("guideline year") ||
        text.includes("year") ||
        text.includes("contact") ||
        text.includes("pincode") ||
        text.includes("value")
    ) {
        return {
            keyboardType: "numeric",
            inputMode: "numeric",
        };
    }

    return { keyboardType: "default" };
};

const FieldInput = ({ label, value, onChangeText, placeholder, keyboardType = "default", multiline = false }) => {
    const inputRef = useRef(null);
    const inputTypeProps = getInputTypeProps(label, placeholder, keyboardType);
    return (
        <View>
            <Text className="text-xs font-lato-bold text-black mb-1.5">{label}</Text>
            <Pressable
                onPress={() => inputRef.current?.focus()}
                className={`bg-white border border-gray-200 rounded-xl px-4 ${multiline ? 'min-h-[88px] py-3' : 'h-12 justify-center'}`}
            >
                <TextInput
                    ref={inputRef}
                    className="text-[13px] text-gray-800 font-lato-medium"
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                    value={value}
                    keyboardType={inputTypeProps.keyboardType}
                    inputMode={inputTypeProps.inputMode}
                    multiline={multiline}
                    scrollEnabled={false}
                    returnKeyType={multiline ? "default" : "done"}
                    blurOnSubmit={!multiline}
                    onChangeText={onChangeText}
                    style={{ paddingVertical: 0, textAlignVertical: multiline ? 'top' : 'center', includeFontPadding: false }}
                />
            </Pressable>
        </View>
    );
};

const MultiCheckboxGroup = ({ label, options, values, onChange }) => {
    const toggle = (option) => {
        const nextValues = values.includes(option)
            ? values.filter(item => item !== option)
            : [...values, option];
        onChange(nextValues);
    };

    return (
        <View>
            <Text className="text-xs font-lato-bold text-black mb-2">{label}</Text>
            <View className="gap-2">
                {options.map(option => {
                    const selected = values.includes(option);
                    return (
                        <TouchableOpacity
                            key={option}
                            onPress={() => toggle(option)}
                            className="flex-row items-center gap-3"
                            activeOpacity={0.7}
                        >
                            <View
                                className="w-5 h-5 rounded border items-center justify-center"
                                style={{
                                    borderColor: selected ? "#4A43EC" : "#D1D5DB",
                                    backgroundColor: selected ? "#4A43EC" : "white"
                                }}
                            >
                                {selected && <Ionicons name="checkmark" size={14} color="white" />}
                            </View>
                            <Text className="text-xs text-gray-600 font-lato-medium flex-1">{option}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const DocumentUploadButton = ({ label, documents, onDocumentsPicked }) => {
    const pickDocuments = async () => {
        const result = await DocumentPicker.getDocumentAsync({
            type: "*/*",
            multiple: true,
        });

        if (!result.canceled) {
            onDocumentsPicked([...(documents || []), ...result.assets]);
        }
    };

    const viewDocument = async (doc) => {
        const url = doc.url || doc.uri;
        if (!url) return;
        try {
            if (url.startsWith('http')) {
                await Linking.openURL(url);
            } else {
                const canShare = await Sharing.isAvailableAsync();
                if (canShare) await Sharing.shareAsync(url);
                else await Linking.openURL(url);
            }
        } catch { /* silent */ }
    };

    const removeDocument = (index) => {
        onDocumentsPicked((documents || []).filter((_, i) => i !== index));
    };

    const docList = documents || [];

    return (
        <View>
            <Text className="text-xs font-lato-bold text-black mb-2">{label}</Text>
            <TouchableOpacity
                onPress={pickDocuments}
                className="bg-[#F4F7FF] border border-dashed border-[#4A43EC]/30 rounded-2xl py-5 items-center justify-center"
            >
                <Ionicons name="document-attach-outline" size={20} color="#4A43EC" />
                <Text className="text-xs font-lato-bold text-[#4A43EC] mt-2">
                    {docList.length > 0 ? `+ Add More Documents` : "Upload Document"}
                </Text>
            </TouchableOpacity>
            {docList.length > 0 && (
                <View className="mt-2 gap-1.5">
                    {docList.map((doc, idx) => (
                        <View key={`${doc.uri || doc.url}-${idx}`} className="flex-row items-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl overflow-hidden">
                            <TouchableOpacity 
                                onPress={() => viewDocument(doc)} 
                                className="flex-1 flex-row items-center px-3 py-2"
                                activeOpacity={0.7}
                            >
                                <Ionicons name="document-text-outline" size={16} color="#4A43EC" />
                                <Text className="flex-1 mx-2 text-[11px] font-lato-bold text-[#111827]" numberOfLines={1}>
                                    {doc.name || doc.label || `Document ${idx + 1}`}
                                </Text>
                                <Ionicons name="eye-outline" size={16} color="#4A43EC" />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => removeDocument(idx)} 
                                className="p-3" 
                                activeOpacity={0.7}
                            >
                                <Ionicons name="trash-outline" size={15} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

const EXPECTED_TIME_OPTIONS = ["3 months", "6 months", "9 months", "12 months", "18 months", "24 months", "24+ months"];

const isDateField = (field) => {
    const text = `${field.key} ${field.label} ${field.placeholder || ""}`.toLowerCase();
    return text.includes("date");
};

function ApprovalBlock({ title, approvalKey, options = APPROVAL_STATUS_OPTIONS, fields, pickerVisible, setPickerVisible }) {
    const dispatch = useDispatch();
    const approval = useSelector((state) => state.project.step4.approvals[approvalKey]);
    const updateApproval = (data) => dispatch(updateStep4Approval({ approvalKey, data }));

    return (
        <View className="gap-4 border-t border-gray-100 pt-4">
            <Text className="text-xs font-lato-bold text-gray-500">{title}</Text>
            <OptionGroup
                label={fields.statusLabel}
                options={options}
                value={approval.status}
                onChange={(value) => updateApproval({ status: value })}
            />

            {approval.status === "Yes" && (
                <View className="gap-4">
                    {fields.yes.map(field =>
                        isDateField(field) ? (
                            <DatePickerField
                                key={field.key}
                                label={field.label}
                                value={approval[field.key]}
                                fieldKey={`${approvalKey}_${field.key}`}
                                pickerVisible={pickerVisible}
                                setPickerVisible={setPickerVisible}
                                onDateChange={(value) => updateApproval({ [field.key]: value })}
                                maxDate={new Date()}
                            />
                        ) : (
                            <FieldInput
                                key={field.key}
                                label={field.label}
                                placeholder={field.placeholder}
                                value={approval[field.key]}
                                keyboardType={field.keyboardType}
                                onChangeText={(value) => updateApproval({ [field.key]: value })}
                            />
                        )
                    )}
                    <DocumentUploadButton
                        label={fields.documentLabel}
                        documents={approval.documents}
                        onDocumentsPicked={(documents) => updateApproval({ documents })}
                    />
                </View>
            )}

            {approval.status === "No" && (
                <View className="gap-4">
                    {fields.no.map(field =>
                        field.key === "expectedTime" ? (
                            <View key={field.key}>
                                <Text className="text-xs font-lato-bold text-black mb-2">{field.label}</Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {EXPECTED_TIME_OPTIONS.map(opt => {
                                        const active = approval.expectedTime === opt;
                                        return (
                                            <TouchableOpacity
                                                key={opt}
                                                activeOpacity={0.75}
                                                onPress={() => updateApproval({ expectedTime: opt })}
                                                className={`px-3 h-8 rounded-lg border items-center justify-center ${active ? "bg-[#4A43EC] border-[#4A43EC]" : "bg-white border-gray-200"}`}
                                            >
                                                <Text className={`text-[12px] font-lato-medium ${active ? "text-white" : "text-gray-700"}`}>{opt}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        ) : (
                            <FieldInput
                                key={field.key}
                                label={field.label}
                                placeholder={field.placeholder}
                                value={approval[field.key]}
                                onChangeText={(value) => updateApproval({ [field.key]: value })}
                            />
                        )
                    )}
                </View>
            )}
        </View>
    );
}

function Step4() {
    const dispatch = useDispatch();
    const { step4 } = useSelector((state) => state.project);
    const updateField = (field, value) => dispatch(updateStep4({ [field]: value }));
    const [pickerVisible, setPickerVisible] = useState(null); // which field is open

    const normalizedApprovalStatuses = [
        step4.approvals.diversion.status,
        step4.approvals.tncp.status,
        step4.approvals.developmentPermission.status,
        step4.approvals.rera.status,
        step4.approvals.buildingPermission.status,
    ].filter(Boolean);
    const allCompleted = normalizedApprovalStatuses.length === 5 && normalizedApprovalStatuses.every(status => status === "Yes" || status === "Not Applicable");
    const somePending = normalizedApprovalStatuses.some(status => status === "No");
    const suggestedStatus = allCompleted ? "All approvals completed" : somePending ? "Some approvals pending" : "Not verified yet";

    useEffect(() => {
        if (step4.overallApprovalStatus === "Not verified yet" && suggestedStatus !== step4.overallApprovalStatus) {
            updateField("overallApprovalStatus", suggestedStatus);
        }
    }, [suggestedStatus, step4.overallApprovalStatus]);

    return (
        <View className="gap-5">
            <Text className="text-base font-lato-bold text-black">Approvals, Permissions & Project Progress</Text>

            <FormSection title="Possession Status">
                <OptionGroup
                    options={["Possession Completed", "Possession Pending"]}
                    value={step4.possessionStatus}
                    onChange={(value) => updateField("possessionStatus", value)}
                />
                {step4.possessionStatus === "Possession Pending" && (
                    <DatePickerField
                        label="Expected Possession Date"
                        value={step4.expectedPossessionDate}
                        fieldKey="expectedPossessionDate"
                        pickerVisible={pickerVisible}
                        setPickerVisible={setPickerVisible}
                        onDateChange={(value) => updateField("expectedPossessionDate", value)}
                    />
                )}
                <FieldInput
                    label="Possession Remarks"
                    placeholder="Example: Possession expected after completion of final development work"
                    value={step4.possessionRemarks}
                    multiline
                    onChangeText={(value) => updateField("possessionRemarks", value)}
                />
            </FormSection>

            <FormSection title="Project Launch Status">
                <OptionGroup
                    options={["Already Launched", "Upcoming Launch"]}
                    value={step4.projectLaunchStatus}
                    onChange={(value) => updateField("projectLaunchStatus", value)}
                />
                {step4.projectLaunchStatus === "Already Launched" && (
                    <DatePickerField
                        label="Project Launch Date"
                        value={step4.projectLaunchDate}
                        fieldKey="projectLaunchDate"
                        pickerVisible={pickerVisible}
                        setPickerVisible={setPickerVisible}
                        onDateChange={(value) => updateField("projectLaunchDate", value)}
                        maxDate={new Date()}
                    />
                )}
                {step4.projectLaunchStatus === "Upcoming Launch" && (
                    <DatePickerField
                        label="Expected Launch Date"
                        value={step4.expectedLaunchDate}
                        fieldKey="expectedLaunchDate"
                        pickerVisible={pickerVisible}
                        setPickerVisible={setPickerVisible}
                        onDateChange={(value) => updateField("expectedLaunchDate", value)}
                        minDate={new Date()}
                    />
                )}
            </FormSection>

            <FormSection title="Development Progress">
                <FieldInput
                    label="Development Completion Percentage"
                    placeholder="Example: 65%"
                    keyboardType="numeric"
                    value={step4.developmentCompletionPercentage}
                    onChangeText={(value) => updateField("developmentCompletionPercentage", value)}
                />
                <MultiCheckboxGroup
                    label="Current Development Stage"
                    options={DEVELOPMENT_STAGE_OPTIONS}
                    values={step4.currentDevelopmentStage}
                    onChange={(value) => updateField("currentDevelopmentStage", value)}
                />
                {step4.currentDevelopmentStage.includes("Other") && (
                    <FieldInput
                        label="Other Development Stage"
                        placeholder="Mention current development stage"
                        value={step4.otherDevelopmentStage}
                        onChangeText={(value) => updateField("otherDevelopmentStage", value)}
                    />
                )}
                <FieldInput
                    label="Development Remarks"
                    placeholder="Add current development status or important remarks"
                    value={step4.developmentRemarks}
                    multiline
                    onChangeText={(value) => updateField("developmentRemarks", value)}
                />
            </FormSection>

            <FormSection title="Approvals & Permissions">
                <ApprovalBlock
                    title="A. Diversion Approval"
                    approvalKey="diversion"
                    pickerVisible={pickerVisible}
                    setPickerVisible={setPickerVisible}
                    fields={{
                        statusLabel: "Is Diversion Approved?",
                        yes: [
                            { key: "referenceNumber", label: "Diversion Order Number / Reference Number", placeholder: "Enter reference number" },
                            { key: "approvalDate", label: "Diversion Approval Date", placeholder: "Select approval date" },
                        ],
                        no: [{ key: "expectedTime", label: "Expected Time to Receive Diversion Approval", placeholder: "Number of months / expected date" }],
                        documentLabel: "Upload Diversion Document",
                    }}
                />
                <ApprovalBlock
                    title="B. TNCP Approval"
                    approvalKey="tncp"
                    pickerVisible={pickerVisible}
                    setPickerVisible={setPickerVisible}
                    fields={{
                        statusLabel: "Is TNCP Approved?",
                        yes: [
                            { key: "approvalNumber", label: "TNCP Approval Number", placeholder: "Enter approval number" },
                            { key: "approvalDate", label: "TNCP Approval Date", placeholder: "Select approval date" },
                        ],
                        no: [{ key: "expectedTime", label: "Expected Time to Receive TNCP Approval", placeholder: "Number of months / expected date" }],
                        documentLabel: "Upload TNCP Document",
                    }}
                />
                <ApprovalBlock
                    title="C. Development Permission"
                    approvalKey="developmentPermission"
                    pickerVisible={pickerVisible}
                    setPickerVisible={setPickerVisible}
                    fields={{
                        statusLabel: "Is Development Permission Approved?",
                        yes: [
                            { key: "permissionNumber", label: "Development Permission Number", placeholder: "Enter permission number" },
                            { key: "permissionDate", label: "Development Permission Date", placeholder: "Select permission date" },
                        ],
                        no: [{ key: "expectedTime", label: "Expected Time to Receive Development Permission", placeholder: "Number of months / expected date" }],
                        documentLabel: "Upload Development Permission Document",
                    }}
                />
                <ApprovalBlock
                    title="D. RERA Approval"
                    approvalKey="rera"
                    options={OPTIONAL_APPROVAL_STATUS_OPTIONS}
                    pickerVisible={pickerVisible}
                    setPickerVisible={setPickerVisible}
                    fields={{
                        statusLabel: "Is the Project RERA Approved?",
                        yes: [
                            { key: "registrationNumber", label: "RERA Registration Number", placeholder: "Enter RERA registration number" },
                            { key: "registrationDate", label: "RERA Registration Date", placeholder: "Select registration date" },
                        ],
                        no: [
                            { key: "reasonNotAvailable", label: "Reason for RERA Not Available", placeholder: "Mention reason" },
                            { key: "expectedTime", label: "Expected Time to Receive RERA Approval, if applicable", placeholder: "Number of months / expected date" },
                        ],
                        documentLabel: "Upload RERA Certificate",
                    }}
                />
                <ApprovalBlock
                    title="E. Building Permission"
                    approvalKey="buildingPermission"
                    options={OPTIONAL_APPROVAL_STATUS_OPTIONS}
                    pickerVisible={pickerVisible}
                    setPickerVisible={setPickerVisible}
                    fields={{
                        statusLabel: "Is Building Permission Approved?",
                        yes: [
                            { key: "permissionNumber", label: "Building Permission Number", placeholder: "Enter permission number" },
                            { key: "permissionDate", label: "Building Permission Date", placeholder: "Select permission date" },
                        ],
                        no: [{ key: "expectedTime", label: "Expected Time to Receive Building Permission", placeholder: "Example: 3 months" }],
                        documentLabel: "Upload Building Permission Document",
                    }}
                />
            </FormSection>

            <FormSection title="Approval Summary Status">
                <OptionGroup
                    label="Overall Approval Status"
                    options={OVERALL_APPROVAL_STATUS_OPTIONS}
                    value={step4.overallApprovalStatus}
                    onChange={(value) => updateField("overallApprovalStatus", value)}
                />
            </FormSection>
        </View>
    );
}

function Step5() {
    const dispatch = useDispatch();
    const { step5 } = useSelector((state) => state.project);
    const updateField = (field, value) => dispatch(updateStep5({ [field]: value }));
    const [pickerVisible, setPickerVisible] = useState(null);

    return (
        <View className="gap-5">
            <Text className="text-base font-lato-bold text-black">Financial, Guideline & Ownership Verification</Text>

            <FormSection title="Government Guideline Value">
                <FieldInput label="Guideline Value Amount" placeholder="Example: Rs. 3,500 per sq. ft." keyboardType="numeric" value={step5.guidelineValueAmount} onChangeText={(value) => updateField("guidelineValueAmount", value)} />
                <OptionGroup label="Guideline Value Unit" options={GUIDELINE_VALUE_UNITS} value={step5.guidelineValueUnit} onChange={(value) => updateField("guidelineValueUnit", value)} />
                <FieldInput label="Property Jurisdiction / Area" placeholder="Enter jurisdiction / area" value={step5.propertyJurisdictionArea} onChangeText={(value) => updateField("propertyJurisdictionArea", value)} />
                <FieldInput label="Guideline Year" placeholder="Enter guideline year, if required" keyboardType="numeric" value={step5.guidelineYear} onChangeText={(value) => updateField("guidelineYear", value)} />
                <DocumentUploadButton label="Upload Guideline Reference Document" documents={step5.guidelineReferenceDocuments} onDocumentsPicked={(documents) => updateField("guidelineReferenceDocuments", documents)} />
            </FormSection>

            <FormSection title="Registry & Stamp Duty Details">
                <OptionGroup label="Registry Charges Available?" options={["Yes", "No"]} value={step5.registryChargesAvailable} onChange={(value) => updateField("registryChargesAvailable", value)} />
                {step5.registryChargesAvailable === "Yes" && (
                    <View className="gap-4">
                        <FieldInput label="Registry Charges for Male Buyer" placeholder="Percentage / amount" value={step5.registryChargesMaleBuyer} onChangeText={(value) => updateField("registryChargesMaleBuyer", value)} />
                        <FieldInput label="Registry Charges for Female Buyer" placeholder="Percentage / amount" value={step5.registryChargesFemaleBuyer} onChangeText={(value) => updateField("registryChargesFemaleBuyer", value)} />
                        <FieldInput label="Other Government Charges, if applicable" placeholder="Percentage / amount" value={step5.otherGovernmentCharges} onChangeText={(value) => updateField("otherGovernmentCharges", value)} />
                    </View>
                )}
            </FormSection>

            <FormSection title="Loan Availability">
                <OptionGroup label="Is Loan Available on this Project?" options={["Yes", "No"]} value={step5.loanAvailable} onChange={(value) => updateField("loanAvailable", value)} />
                {step5.loanAvailable === "Yes" && (
                    <View className="gap-4">
                        <OptionGroup label="Bank Tie-up Available?" options={["Yes", "No"]} value={step5.bankTieUpAvailable} onChange={(value) => updateField("bankTieUpAvailable", value)} />
                        <FieldInput label="Tie-up Bank Name" placeholder="Enter bank name" value={step5.tieUpBankName} onChangeText={(value) => updateField("tieUpBankName", value)} />
                        <FieldInput label="Loan Approval Status" placeholder="Enter loan approval status" value={step5.loanApprovalStatus} onChangeText={(value) => updateField("loanApprovalStatus", value)} />
                        <FieldInput label="Maximum Loan Percentage, if known" placeholder="Example: 80%" keyboardType="numeric" value={step5.maximumLoanPercentage} onChangeText={(value) => updateField("maximumLoanPercentage", value)} />
                        <FieldInput label="Required Documents for Loan, if any" placeholder="Mention required documents" multiline value={step5.requiredLoanDocuments} onChangeText={(value) => updateField("requiredLoanDocuments", value)} />
                        {step5.bankTieUpAvailable === "Yes" && (
                            <FieldInput label="Bank Name / Bank List" placeholder="Enter bank name / bank list" value={step5.bankNameList} onChangeText={(value) => updateField("bankNameList", value)} />
                        )}
                    </View>
                )}
            </FormSection>

            <FormSection title="Project Ownership Type">
                <OptionGroup label="Project Ownership Type" options={OWNERSHIP_TYPES} value={step5.ownershipType} onChange={(value) => updateField("ownershipType", value)} />
                {step5.ownershipType === "Owned Project" && (
                    <View className="gap-4">
                        <FieldInput label="Owner / Company Name" placeholder="Enter owner or company name" value={step5.ownedOwnerCompanyName} onChangeText={(value) => updateField("ownedOwnerCompanyName", value)} />
                        <DocumentUploadButton label="Ownership Document Upload" documents={step5.ownedDocuments} onDocumentsPicked={(documents) => updateField("ownedDocuments", documents)} />
                    </View>
                )}
                {step5.ownershipType === "Joint Venture Project" && (
                    <View className="gap-4">
                        <FieldInput label="Land Owner Name" placeholder="Enter land owner name" value={step5.jvLandOwnerName} onChangeText={(value) => updateField("jvLandOwnerName", value)} />
                        <FieldInput label="Developer / Builder Name" placeholder="Enter developer / builder name" value={step5.jvDeveloperBuilderName} onChangeText={(value) => updateField("jvDeveloperBuilderName", value)} />
                        <OptionGroup label="JV Agreement Available?" options={["Yes", "No"]} value={step5.jvAgreementAvailable} onChange={(value) => updateField("jvAgreementAvailable", value)} />
                        <DocumentUploadButton label="Upload JV Agreement, if available" documents={step5.jvAgreementDocuments} onDocumentsPicked={(documents) => updateField("jvAgreementDocuments", documents)} />
                        <FieldInput label="Revenue / Area Sharing Details" placeholder="Optional" multiline value={step5.jvRevenueAreaSharingDetails} onChangeText={(value) => updateField("jvRevenueAreaSharingDetails", value)} />
                    </View>
                )}
                {step5.ownershipType === "Development Agreement Project" && (
                    <View className="gap-4">
                        <FieldInput label="Land Owner Name" placeholder="Enter land owner name" value={step5.developmentLandOwnerName} onChangeText={(value) => updateField("developmentLandOwnerName", value)} />
                        <FieldInput label="Developer Name" placeholder="Enter developer name" value={step5.developmentDeveloperName} onChangeText={(value) => updateField("developmentDeveloperName", value)} />
                        <OptionGroup label="Development Agreement Available?" options={["Yes", "No"]} value={step5.developmentAgreementAvailable} onChange={(value) => updateField("developmentAgreementAvailable", value)} />
                        <DocumentUploadButton label="Upload Development Agreement" documents={step5.developmentAgreementDocuments} onDocumentsPicked={(documents) => updateField("developmentAgreementDocuments", documents)} />
                    </View>
                )}
                {step5.ownershipType === "Other" && (
                    <View className="gap-4">
                        <FieldInput label="Mention Ownership Type" placeholder="Enter ownership type" value={step5.otherOwnershipType} onChangeText={(value) => updateField("otherOwnershipType", value)} />
                        <DocumentUploadButton label="Upload Supporting Document" documents={step5.ownershipSupportingDocuments} onDocumentsPicked={(documents) => updateField("ownershipSupportingDocuments", documents)} />
                    </View>
                )}
            </FormSection>

            <FormSection title="Land / Project Title Verification">
                <OptionGroup label="Is Title Verification Completed?" options={["Yes", "No", "Under Process"]} value={step5.titleVerificationStatus} onChange={(value) => updateField("titleVerificationStatus", value)} />
                {step5.titleVerificationStatus === "Yes" && (
                    <View className="gap-4">
                        <FieldInput label="Title Verification Done By" placeholder="Enter verifier name / company" value={step5.titleVerificationDoneBy} onChangeText={(value) => updateField("titleVerificationDoneBy", value)} />
                        <DatePickerField
                            label="Title Verification Date"
                            value={step5.titleVerificationDate}
                            fieldKey="titleVerificationDate"
                            pickerVisible={pickerVisible}
                            setPickerVisible={setPickerVisible}
                            onDateChange={(value) => updateField("titleVerificationDate", value)}
                            maxDate={new Date()}
                        />
                        <DocumentUploadButton label="Upload Title Report" documents={step5.titleReportDocuments} onDocumentsPicked={(documents) => updateField("titleReportDocuments", documents)} />
                    </View>
                )}
                {step5.titleVerificationStatus === "Under Process" && (
                    <DatePickerField
                        label="Expected Completion Date"
                        value={step5.titleExpectedCompletionDate}
                        fieldKey="titleExpectedCompletionDate"
                        pickerVisible={pickerVisible}
                        setPickerVisible={setPickerVisible}
                        onDateChange={(value) => updateField("titleExpectedCompletionDate", value)}
                        minDate={new Date()}
                    />
                )}
            </FormSection>

            <FormSection title="Financial Remarks">
                <FieldInput
                    label="Financial / Ownership Remarks"
                    placeholder="Add any important financial, guideline, loan, or ownership-related remarks"
                    multiline
                    value={step5.financialOwnershipRemarks}
                    onChangeText={(value) => updateField("financialOwnershipRemarks", value)}
                />
            </FormSection>
        </View>
    );
}

// --- Step 6 Component ---
function Step6() {
    const dispatch = useDispatch();
    const { step6 } = useSelector((state) => state.project);

    const updateField = (field, value) => {
        dispatch(updateStep6({ [field]: value }));
    };

    const pickImages = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            updateField('images', [...step6.images, ...result.assets]);
        }
    };

    const removeImage = (imageIndex) => {
        updateField('images', step6.images.filter((_, index) => index !== imageIndex));
    };

    const pickDocuments = async () => {
        const result = await DocumentPicker.getDocumentAsync({
            type: "*/*",
            multiple: true,
        });

        if (!result.canceled) {
            updateField('documents', [...step6.documents, ...result.assets]);
        }
    };

    const Checkbox = ({ label, value, onValueChange }) => (
        <TouchableOpacity
            className="flex-row items-center gap-3 mb-4"
            onPress={() => onValueChange(!value)}
            activeOpacity={0.7}
        >
            <View
                className="w-5 h-5 rounded border items-center justify-center"
                style={{
                    borderColor: value ? "#4A43EC" : "#D1D5DB",
                    backgroundColor: value ? "#4A43EC" : "white"
                }}
            >
                {value && <Ionicons name="checkmark" size={14} color="white" />}
            </View>
            <Text className="text-xs text-gray-600 font-lato-medium flex-1">{label}</Text>
        </TouchableOpacity>
    );

    return (
        <View className="gap-5">
            <Text className="text-base font-lato-bold text-black">Project Images & Submission</Text>

            {/* Image Upload */}
            <View className="mt-1">
                <Text className="text-xs font-lato-bold text-black mb-2.5">Upload Images for this project</Text>
                <TouchableOpacity
                    className="bg-[#F4F7FF] border border-dashed border-[#4A43EC]/30 rounded-2xl py-8 items-center justify-center"
                    onPress={pickImages}
                >
                    <View className="w-10 h-10 bg-[#EBEAFF] rounded-full items-center justify-center mb-2.5">
                        <Ionicons name="cloud-upload-outline" size={20} color="#4A43EC" />
                    </View>
                    <Text className="text-xs font-lato-bold text-[#4A43EC]">
                        {step6.images.length > 0 ? `${step6.images.length} Photos Added` : "Add at least 3 Photos"}
                    </Text>
                    <Text className="text-[9px] text-gray-400 font-lato mt-0.5">click from camera or browse to upload</Text>
                </TouchableOpacity>
                {step6.images.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
                        {step6.images.map((img, idx) => (
                            <View key={`${img.uri}-${idx}`} className="mr-2 relative">
                                <Image source={{ uri: img.uri }} className="w-16 h-16 rounded-lg" />
                                <TouchableOpacity
                                    onPress={() => removeImage(idx)}
                                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 items-center justify-center"
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="close" size={11} color="white" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>

            {/* Document Upload */}
            <View>
                <View className="flex-row items-center gap-1 mb-2.5">
                    <Text className="text-xs font-lato-bold text-black">Upload Project Documents</Text>
                    <Text className="text-[9px] text-gray-400 font-lato">(Optional)</Text>
                </View>
                <TouchableOpacity
                    className="bg-[#F4F7FF] border border-dashed border-[#4A43EC]/30 rounded-2xl py-8 items-center justify-center"
                    onPress={pickDocuments}
                >
                    <View className="w-10 h-10 bg-[#EBEAFF] rounded-full items-center justify-center mb-2.5">
                        <Ionicons name="document-text-outline" size={20} color="#4A43EC" />
                    </View>
                    <Text className="text-xs font-lato-bold text-[#4A43EC]">
                        {step6.documents.length > 0 ? `${step6.documents.length} Documents Added` : "Upload Documents"}
                    </Text>
                    <Text className="text-[9px] text-gray-400 font-lato mt-0.5">click from camera or browse to upload</Text>
                </TouchableOpacity>
            </View>

            {/* Agreement */}
            <View className="mt-2">
                <Text className="text-xs font-lato-bold text-black mb-3">Agreement & Submission</Text>
                <Checkbox
                    label="I confirm that the provided details are accurate and that I am the legal owner or have the right to list this property for sale."
                    value={step6.agreed}
                    onValueChange={(v) => updateField('agreed', v)}
                />
            </View>
        </View>
    );
}
