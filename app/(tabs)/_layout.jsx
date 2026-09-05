import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

const TAB_COLOR = "#4A43EC";
const MUTED_TAB_COLOR = "#94A3B8";

const icons = {
    home: ["home", "home-outline"],
    projects: ["business", "business-outline"],
    requests: ["mail-open", "mail-outline"],
    tasks: ["checkbox", "checkbox-outline"],
    profile: ["person-circle", "person-circle-outline"],
};

function TabIcon({ name, focused }) {
    const [activeIcon, inactiveIcon] = icons[name];
    const iconName = focused ? activeIcon : inactiveIcon;
    const scale = useRef(new Animated.Value(focused ? 1 : 0.94)).current;
    const translateY = useRef(new Animated.Value(focused ? -2 : 0)).current;

    useEffect(() => {
        if (focused) {
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(scale, { toValue: 1.18, duration: 120, useNativeDriver: true }),
                    Animated.spring(scale, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }),
                ]),
                Animated.sequence([
                    Animated.timing(translateY, { toValue: -5, duration: 120, useNativeDriver: true }),
                    Animated.spring(translateY, { toValue: -2, friction: 5, tension: 120, useNativeDriver: true }),
                ]),
            ]).start();
            return;
        }

        Animated.parallel([
            Animated.timing(scale, { toValue: 0.94, duration: 120, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: 120, useNativeDriver: true }),
        ]).start();
    }, [focused, scale, translateY]);

    return (
        <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
            <Ionicons name={iconName} size={24} color={focused ? TAB_COLOR : MUTED_TAB_COLOR} />
        </Animated.View>
    );
}

export default function TabsLayout() {
    const searchActive = useSelector((state) => state.app.searchActive);
    const insets = useSafeAreaInsets();
    const iosBottomPadding = Platform.OS === "ios" ? Math.max(insets.bottom - 8, 6) : 8;
    const androidBottomPadding = Math.max(insets.bottom, 8);

    return (
        <Tabs
            screenOptions={{
                tabBarShowLabel: true,
                tabBarActiveTintColor: TAB_COLOR,
                tabBarInactiveTintColor: MUTED_TAB_COLOR,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontFamily: "Lato_700Bold",
                    marginTop: 2,
                },
                tabBarItemStyle: {
                    paddingTop: 3,
                },
                tabBarStyle: searchActive
                    ? { display: "none" }
                    : {
                          position: "absolute",
                          left: 0,
                          right: 0,
                          bottom: 0,
                          borderTopRightRadius: 45,
                          borderTopLeftRadius: 45,
                          borderTopColor: "transparent",
                          backgroundColor: "#fff",
                          paddingTop: 12,
                          paddingHorizontal: 15,
                          paddingBottom: Platform.OS === "ios" ? iosBottomPadding : androidBottomPadding,
                          height: Platform.OS === "ios" ? 88 : 74 + androidBottomPadding,
                          ...Platform.select({
                              ios: {
                                  shadowColor: "#000",
                                  shadowOffset: { width: 0, height: 2 },
                                  shadowOpacity: 0.25,
                                  shadowRadius: 4,
                              },
                              android: {
                                  elevation: 10,
                              },
                          }),
                      },
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    headerShown: false,
                    tabBarLabel: "Home",
                    tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="projects"
                options={{
                    headerShown: false,
                    tabBarLabel: "Projects",
                    tabBarIcon: ({ focused }) => <TabIcon name="projects" focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="requests"
                options={{
                    headerShown: false,
                    tabBarLabel: "Requests",
                    tabBarIcon: ({ focused }) => <TabIcon name="requests" focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="tasks"
                options={{
                    headerShown: false,
                    tabBarLabel: "Tasks",
                    tabBarIcon: ({ focused }) => <TabIcon name="tasks" focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    headerShown: false,
                    tabBarLabel: "Profile",
                    tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
                }}
            />
            <Tabs.Screen name="favourite" options={{ href: null }} />
            <Tabs.Screen name="book" options={{ href: null }} />
            <Tabs.Screen name="discount" options={{ href: null }} />
            <Tabs.Screen name="settings" options={{ href: null }} />
        </Tabs>
    );
}
