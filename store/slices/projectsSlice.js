import { createSelector, createSlice } from "@reduxjs/toolkit";
const onboardingStages = [
    "New Lead Added",
    "First Contact",
    "Follow-up",
    "Meeting Scheduled",
    "Interested",
    "In-Review",
    "Project live",
    "Rejected",
];

function ensureStage(project, stage, note) {
    if (!project.stageHistory) project.stageHistory = [];
    if (!project.stageHistory.some((item) => item.stage === stage)) {
        project.stageHistory.push({
            stage,
            note,
            at: new Date().toISOString(),
        });
    }
    if (getStageIndex(stage) >= getStageIndex(project.journeyStage)) {
        project.journeyStage = stage;
    }
}

function getStageIndex(stage) {
    const index = onboardingStages.indexOf(stage);
    return index >= 0 ? index : 0;
}

function getProgress(stage) {
    if (stage === "Project live" || stage === "Rejected") return 100;

    const index = getStageIndex(stage);

    return Math.round(((index + 1) / onboardingStages.length) * 100);
}

const projectsSlice = createSlice({
    name: "projects",
    initialState: {
        items: [],
    },
    reducers: {
        addProject: (state, action) => {
            const incomingProject = action.payload;
            const existingIndex = state.items.findIndex((item) => item.id === incomingProject.id);
            const project = {
                followUps: [],
                meetings: [],
                stageHistory: [],
                onboardingData: null,
                ...incomingProject,
            };

            ensureStage(project, project.journeyStage || "New Lead Added", project.nextAction || "Lead added");
            project.onboardingProgress = getProgress(project.journeyStage);

            if (existingIndex >= 0) {
                state.items[existingIndex] = {
                    ...state.items[existingIndex],
                    ...project,
                    followUps: state.items[existingIndex].followUps || project.followUps,
                    meetings: state.items[existingIndex].meetings || project.meetings,
                    stageHistory: project.stageHistory,
                };
            } else {
                state.items.unshift(project);
            }
        },
        markProjectContacted: (state, action) => {
            const project = state.items.find((item) => item.id === action.payload);

            if (project) {
                project.status = "First contacted";
                project.statusType = "contacted";
                project.nextAction = "Add a follow-up or schedule a meeting";
                project.lastContact = "Today";
                ensureStage(project, "First Contact", "Phone call started");
                project.onboardingProgress = getProgress(project.journeyStage);
            }
        },
        addProjectFollowUp: (state, action) => {
            const { projectId, followUp } = action.payload;
            const project = state.items.find((item) => item.id === projectId);

            if (project) {
                if (!project.followUps) project.followUps = [];
                project.followUps.unshift(followUp);
                project.status = "Follow up";
                project.statusType = "followUp";
                project.nextAction = followUp.note;
                project.lastContact = "Today";
                ensureStage(project, "Follow-up", followUp.note);
                project.onboardingProgress = getProgress(project.journeyStage);
            }
        },
        addProjectMeeting: (state, action) => {
            const { projectId, meeting } = action.payload;
            const project = state.items.find((item) => item.id === projectId);

            if (project) {
                if (!project.meetings) project.meetings = [];
                project.meetings.unshift(meeting);
                project.status = "Meeting Set";
                project.statusType = "meeting";
                project.nextAction = `Meet at ${meeting.location} for ${meeting.type.toLowerCase()}`;
                project.lastContact = "Today";
                ensureStage(project, "Meeting Scheduled", project.nextAction);
                project.onboardingProgress = getProgress(project.journeyStage);
            }
        },
        markProjectActivityDone: (state, action) => {
            const { projectId, activityType, activityId } = action.payload;
            const collectionName = activityType === "meeting" ? "meetings" : "followUps";
            const project =
                state.items.find((item) => item.id === projectId) ||
                state.items.find((item) => (item[collectionName] || []).some((activity) => activity.id === activityId));

            if (project) {
                const activity = (project[collectionName] || []).find((item) => item.id === activityId);

                if (activity) {
                    activity.isDone = true;
                    activity.status = "Done";
                    activity.completedAt = new Date().toISOString();
                }

                project.lastContact = "Today";
                if (activityType === "meeting") {
                    project.status = "Interested";
                    project.statusType = "interested";
                    project.nextAction = "Continue onboarding";
                    ensureStage(project, "Interested", "Meeting marked done");
                } else {
                    if (getStageIndex(project.journeyStage) < getStageIndex("Meeting Scheduled")) {
                        project.status = "Follow up";
                        project.statusType = "followUp";
                        project.nextAction = "Schedule or complete a meeting";
                    }
                    ensureStage(project, "Follow-up", "Follow-up marked done");
                }
                project.onboardingProgress = getProgress(project.journeyStage);
            }
        },
        completeProjectOnboarding: (state, action) => {
            const { projectId, onboardingData } = action.payload;
            const project = state.items.find((item) => item.id === projectId);

            if (project) {
                project.status = "Project Live";
                project.statusType = "live";
                project.nextAction = "Project is live";
                project.lastContact = "Today";
                project.onboardingData = onboardingData;
                project.onboardingDraft = null;
                ensureStage(project, "Project live", "Onboarding completed");
                project.onboardingProgress = 100;
            }
        },
        rejectProjectLead: (state, action) => {
            const project = state.items.find((item) => item.id === action.payload);

            if (project) {
                project.status = "Rejected";
                project.statusType = "rejected";
                project.nextAction = "Lead rejected";
                project.lastContact = "Today";
                project.onboardingDraft = null;
                ensureStage(project, "Rejected", "Lead rejected");
                project.onboardingProgress = 100;
            }
        },
        saveProjectOnboardingDraft: (state, action) => {
            const { projectId, draft } = action.payload;
            const project = state.items.find((item) => item.id === projectId);

            if (project) {
                project.onboardingDraft = {
                    ...draft,
                    projectId: draft.projectId || project.onboardingDraft?.projectId || null,
                    updatedAt: new Date().toISOString(),
                };
            }
        },
    },
});

export const {
    addProject,
    markProjectContacted,
    addProjectFollowUp,
    addProjectMeeting,
    markProjectActivityDone,
    completeProjectOnboarding,
    rejectProjectLead,
    saveProjectOnboardingDraft,
} = projectsSlice.actions;
export const selectProjects = (state) => state.projects.items;
export const selectProjectById = (state, projectId) => state.projects.items.find((project) => project.id === projectId);
export const selectAllProjectFollowUps = createSelector(
    selectProjects,
    (items) => items.flatMap((project) => (project.followUps || []).map((item) => ({ ...item, projectId: project.id })))
);
export const selectAllProjectMeetings = createSelector(
    selectProjects,
    (items) => items.flatMap((project) => (project.meetings || []).map((item) => ({ ...item, projectId: project.id })))
);
export default projectsSlice.reducer;
