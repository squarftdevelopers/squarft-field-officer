import { forwardRef, useImperativeHandle } from "react";
import { View } from "react-native";

const MapView = forwardRef(function MapView({ children, ...props }, ref) {
    useImperativeHandle(ref, () => ({
        animateCamera: () => {},
        animateToRegion: () => {},
        fitToCoordinates: () => {},
    }));

    return <View {...props}>{children}</View>;
});

export function Marker() {
    return null;
}

export function Polyline() {
    return null;
}

export const PROVIDER_GOOGLE = undefined;
export default MapView;
