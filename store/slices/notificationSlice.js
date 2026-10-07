import { createSlice } from '@reduxjs/toolkit';

const notificationSlice = createSlice({
    name: 'notifications',
    initialState: {
        list: [],
    },
    reducers: {
        markAsWatched: (state, action) => {
            const notification = state.list.find(item => item.id === action.payload);
            if (notification) {
                notification.watched = true;
            }
        },
        markAllAsWatched: (state) => {
            state.list.forEach(item => {
                item.watched = true;
            });
        },
        addNotification: (state, action) => {
            state.list.unshift({
                id: Date.now(),
                watched: false,
                time: 'Just now',
                type: 'default',
                ...action.payload,
            });
        },
        setNotifications: (state, action) => {
            state.list = Array.isArray(action.payload) ? action.payload : [];
        },
        clearNotifications: (state) => {
            state.list = [];
        },
    },
});

export const { markAsWatched, markAllAsWatched, addNotification, setNotifications, clearNotifications } = notificationSlice.actions;
export default notificationSlice.reducer;
