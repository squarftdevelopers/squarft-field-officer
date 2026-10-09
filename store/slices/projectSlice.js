import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    currentStep: 1,
    projectId: null, // set after API creates the draft
    step1: {
        projectName: '',
        location: '',
        city: '',
        state: '',
        pincode: '',
        latitude: null,
        longitude: null,
        salesOfficerName: '',
        salesOfficerContact: '',
        responsiblePersonName: '',
        responsiblePersonContact: '',
        // OTP fields removed: verification is no longer required for contacts
    },
    step2: {
        selectedTypes: [], // Array of objects matching the hierarchy
    },
    step3: {
        unitConfigs: {}, // Keyed by typeId, value is array of unit detail objects
        builderData: {}, // Keyed by typeId, value is visual builder state
        uploadModes: {}, // Keyed by typeId: 'manual' | 'bulk'
    },
    step4: {
        possessionStatus: '',
        expectedPossessionDate: '',
        possessionRemarks: '',
        projectLaunchStatus: '',
        projectLaunchDate: '',
        expectedLaunchDate: '',
        developmentCompletionPercentage: '',
        currentDevelopmentStage: [],
        otherDevelopmentStage: '',
        developmentRemarks: '',
        approvals: {
            diversion: { status: '', referenceNumber: '', approvalDate: '', documents: [], expectedTime: '' },
            tncp: { status: '', approvalNumber: '', approvalDate: '', documents: [], expectedTime: '' },
            developmentPermission: { status: '', permissionNumber: '', permissionDate: '', documents: [], expectedTime: '' },
            rera: { status: '', registrationNumber: '', registrationDate: '', documents: [], reasonNotAvailable: '', expectedTime: '' },
            buildingPermission: { status: '', permissionNumber: '', permissionDate: '', documents: [], expectedTime: '' },
        },
        overallApprovalStatus: 'Not verified yet',
    },
    step5: {
        guidelineValueAmount: '',
        guidelineValueUnit: '',
        propertyJurisdictionArea: '',
        guidelineYear: '',
        guidelineReferenceDocuments: [],
        registryChargesAvailable: '',
        registryChargesMaleBuyer: '',
        registryChargesFemaleBuyer: '',
        otherGovernmentCharges: '',
        loanAvailable: '',
        bankTieUpAvailable: '',
        tieUpBankName: '',
        loanApprovalStatus: '',
        maximumLoanPercentage: '',
        requiredLoanDocuments: '',
        bankNameList: '',
        ownershipType: '',
        ownedOwnerCompanyName: '',
        ownedDocuments: [],
        jvLandOwnerName: '',
        jvDeveloperBuilderName: '',
        jvAgreementAvailable: '',
        jvAgreementDocuments: [],
        jvRevenueAreaSharingDetails: '',
        developmentLandOwnerName: '',
        developmentDeveloperName: '',
        developmentAgreementAvailable: '',
        developmentAgreementDocuments: [],
        otherOwnershipType: '',
        ownershipSupportingDocuments: [],
        titleVerificationStatus: '',
        titleVerificationDoneBy: '',
        titleVerificationDate: '',
        titleReportDocuments: [],
        titleExpectedCompletionDate: '',
        financialOwnershipRemarks: '',
        // Step 5 extra fields
        brokerageAvailable: '',
        brokeragePercentage: '',
        brokerageTerms: '',
        customerIncentives: '',
        brokerIncentives: '',
        videoUrl: '',
        visibility: 'public',
        salesOfficerId: null,
        branchManagerId: null,
    },
    step6: {
        images: [],
        videos: [],
        documents: [],
        agreed: false,
    },
};

const projectSlice = createSlice({
    name: 'project',
    initialState,
    reducers: {
        setStep: (state, action) => {
            state.currentStep = action.payload;
        },
        updateStep1: (state, action) => {
            state.step1 = { ...state.step1, ...action.payload };
        },
        addPropertyType: (state, action) => {
            state.step2.selectedTypes.push(action.payload);
        },
        removePropertyType: (state, action) => {
            state.step2.selectedTypes = state.step2.selectedTypes.filter(t => t.id !== action.payload);
            delete state.step3.unitConfigs[action.payload];
            if (state.step3.builderData) delete state.step3.builderData[action.payload];
        },
        updatePropertyType: (state, action) => {
            const index = state.step2.selectedTypes.findIndex(t => t.id === action.payload.id);
            if (index !== -1) {
                state.step2.selectedTypes[index] = action.payload;
            }
        },
        updateStep3: (state, action) => {
            const { typeId, unitIndex, data, quantity } = action.payload;
            if (quantity !== undefined) {
                // Initialize or resize the array of unit configs
                const currentConfigs = state.step3.unitConfigs[typeId] || [];
                if (quantity > currentConfigs.length) {
                    const diff = quantity - currentConfigs.length;
                    const newConfigs = Array(diff).fill(null).map(() => ({
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
                    }));
                    state.step3.unitConfigs[typeId] = [...currentConfigs, ...newConfigs];
                } else if (quantity < currentConfigs.length) {
                    state.step3.unitConfigs[typeId] = currentConfigs.slice(0, quantity);
                } else if (quantity === 0) {
                    delete state.step3.unitConfigs[typeId];
                }
            } else if (typeId && unitIndex !== undefined) {
                if (!state.step3.unitConfigs[typeId]) state.step3.unitConfigs[typeId] = [];
                state.step3.unitConfigs[typeId][unitIndex] = {
                    ...state.step3.unitConfigs[typeId][unitIndex],
                    ...data
                };
            } else {
                state.step3 = { ...state.step3, ...action.payload };
            }
        },
        updateBuilderData: (state, action) => {
            const { typeId, subType, builderState } = action.payload;
            if (!state.step3.builderData) state.step3.builderData = {};
            state.step3.builderData[typeId] = builderState;

            const newUnitConfigs = [];
            const sections = builderState.sections || [];
            sections.forEach(section => {
                const rows = section.floors ?? section.rows ?? section.lanes ?? 1;
                const cols = section.unitsPerFloor ?? section.plotsPerRow ?? section.villasPerLane ?? 1;

                for (let r = 1; r <= rows; r++) {
                    // Determine columns in this row (respecting row-based count adjustments)
                    const rowCols = section.rowUnitCounts?.[r] ?? cols;
                    for (let c = 1; c <= rowCols; c++) {
                        const key = `${r}_${c}`;
                        
                        // Process only cells that have an assigned variant
                        if (section.unitMap && section.unitMap[key]) {
                            const configId = section.unitMap[key];
                            const config = section.configs?.find(cfg => cfg.id === configId) || {};
                            const override = section.unitOverrides?.[key] || {};

                            // Generate default property number based on subtype rules
                            const displayNum = `${r}${c.toString().padStart(2, '0')}`;
                            const rangeLabel = (section.name || '').trim() || 'A';
                            const rangeBasedNumber = `${rangeLabel}-${c}`;
                            const defaultPropertyNumber = (subType === 'plot' || subType === 'villa' || subType === 'rowhouse')
                                ? rangeBasedNumber
                                : displayNum;

                            const propertyNumber = override.customName || defaultPropertyNumber;
                            const unitId = `${typeId}-${section.id}-${key}`;

                            // Build standardized unit config object
                            const unitConfig = {
                                unitId,
                                sectionId: section.id,
                                gridKey: key,
                                row: r,
                                column: c,
                                tower: section.name,
                                floor: r.toString(),
                                bhk: subType === 'office' ? (config.type || 'Co-working') : (config.type || '2 BHK'),
                                officeType: subType === 'office' ? (config.type || 'Co-working') : '',
                                variantName: config.name || '',
                                area: (override.customArea || config.area || '0').toString(),
                                areaUnit: subType === 'plot' ? 'Sq-yrd' : 'Sq-ft',
                                price: (override.customPrice || config.price || '').toString().replace(/,/g, ''),
                                images: config.images || [],
                                brochure: config.brochure || null,
                                amenities: (config.amenities || []).filter(Boolean).length > 0 ? (config.amenities || []).filter(Boolean) : [''],
                                propertyNumber: propertyNumber,
                                hasShop: false,
                                extraCharges: (config.extra_charges || []).filter(e => e && e.title).length > 0 ? config.extra_charges : [{ title: '', amount: '' }]
                            };

                            newUnitConfigs.push(unitConfig);
                        }
                    }
                }
            });

            state.step3.unitConfigs[typeId] = newUnitConfigs;
        },
        updateStep4: (state, action) => {
            state.step4 = { ...state.step4, ...action.payload };
        },
        updateStep4Approval: (state, action) => {
            const { approvalKey, data } = action.payload;
            state.step4.approvals[approvalKey] = {
                ...state.step4.approvals[approvalKey],
                ...data,
            };
        },
        updateStep5: (state, action) => {
            state.step5 = { ...state.step5, ...action.payload };
        },
        updateStep6: (state, action) => {
            state.step6 = { ...state.step6, ...action.payload };
        },
        bulkUploadProject: (state, action) => {
            const { step1, step2, step3, step4, step5, step6 } = action.payload;
            if (step1) state.step1 = { ...state.step1, ...step1 };
            if (step2) state.step2 = { ...state.step2, ...step2 };
            if (step3) state.step3 = { ...state.step3, ...step3 };
            if (step4) state.step4 = { ...state.step4, ...step4 };
            if (step5) state.step5 = { ...state.step5, ...step5 };
            if (step6) state.step6 = { ...state.step6, ...step6 };
        },
        bulkUploadSubtype: (state, action) => {
            const { typeId, unitConfigs } = action.payload;
            state.step3.unitConfigs[typeId] = unitConfigs;
        },
        resetForm: () => initialState,
        setProjectId: (state, action) => {
            state.projectId = action.payload;
        },
        setUploadMode: (state, action) => {
            const { typeId, mode } = action.payload;
            state.step3.uploadModes[typeId] = mode;
        },
    },
});

export const {
    setStep,
    updateStep1,
    addPropertyType,
    removePropertyType,
    updatePropertyType,
    updateStep3,
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
} = projectSlice.actions;

export default projectSlice.reducer;
