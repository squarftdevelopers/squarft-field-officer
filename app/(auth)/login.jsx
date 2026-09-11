import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Link, router } from "expo-router";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    clearOtp,
    setMobile,
    setOtpFlow,
    setOtpToken,
} from "../../store/slices/authSlice";
import { authAPI } from "../../services/api";

const logo = require("../../assets/icons/app-icon.png");
const COUNTRY_CODE = "+91";

export default function Login() {
    const dispatch = useDispatch();
    const { mobile } = useSelector((state) => state.auth);
    const [loading, setLoading] = useState(false);

    const handleSendOtp = async () => {
        if (mobile.length !== 10) {
            Alert.alert("Invalid Phone Number", "Please enter a valid 10-digit phone number");
            return;
        }

        setLoading(true);
        try {
            const response = await authAPI.sendOtp(`${COUNTRY_CODE}${mobile}`, "login");
            dispatch(setOtpFlow("login"));
            dispatch(setOtpToken(response.otp_token));
            dispatch(clearOtp());
            router.push("/otp-verification");
        } catch (error) {
            const message = error.response?.data?.message || error.message || "Failed to send OTP";
            const accountMissing = error.response?.status === 404
                || message.toLowerCase().includes("no field officer account")
                || message.toLowerCase().includes("no account found");

            if (accountMissing) {
                Alert.alert(
                    "Account Not Found",
                    "No field officer account was found with this phone number. Would you like to register?",
                    [
                        { text: "Register", onPress: () => router.replace("/register") },
                        { text: "Cancel", style: "cancel" },
                    ],
                );
            } else {
                Alert.alert("Could Not Send OTP", message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
            <StatusBar style="light" />
            <KeyboardAwareScrollView
                className="flex-1 bg-white"
                contentContainerStyle={{
                    flexGrow: 1,
                    paddingBottom: Platform.OS === "android" ? 40 : 24,
                }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                enableOnAndroid
                enableAutomaticScroll
                extraScrollHeight={Platform.OS === "android" ? 24 : 20}
                extraHeight={Platform.OS === "android" ? 120 : 75}
                keyboardOpeningTime={Platform.OS === "android" ? 0 : 250}
            >
                <View className="bg-[#4A43EC] pt-16 pb-10 px-6">
                    <View style={{ width: 60, height: 60, overflow: "hidden" }} className="mb-6">
                        <Image
                            source={logo}
                            style={{ width: 110, height: 110, margin: -20 }}
                            resizeMode="contain"
                        />
                    </View>
                    <Text className="text-white text-[36px] font-bold mb-1">Login</Text>
                    <View className="flex-row items-center">
                        <Text className="text-white/80 text-[14px]">Don&apos;t have an account? </Text>
                        <Link href="/register">
                            <Text className="text-white text-[14px] font-semibold underline">Register</Text>
                        </Link>
                    </View>
                </View>

                <View className="flex-1 bg-white px-6 pt-8">
                    <Text className="text-gray-500 text-[13px] mb-1.5">Mobile Number</Text>
                    <View className="border border-gray-200 rounded-xl px-4 py-3 mb-5 flex-row items-center">
                        <Text className="text-[15px] text-black font-semibold mr-2">{COUNTRY_CODE}</Text>
                        <View className="w-[1px] h-5 bg-gray-200 mr-3" />
                        <TextInput
                            value={mobile}
                            onChangeText={(value) => dispatch(setMobile(value.replace(/[^0-9]/g, "").slice(0, 10)))}
                            placeholder="Phone Number"
                            placeholderTextColor="#aaa"
                            keyboardType="phone-pad"
                            textContentType="telephoneNumber"
                            autoComplete="tel"
                            maxLength={10}
                            editable={!loading}
                            className="flex-1 text-[15px] text-black"
                        />
                    </View>

                    <TouchableOpacity
                        onPress={handleSendOtp}
                        disabled={loading}
                        className={`bg-[#4A43EC] rounded-2xl py-4 items-center mb-8 ${loading ? "opacity-70" : ""}`}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text className="text-white text-[16px] font-semibold">Send OTP</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAwareScrollView>
        </SafeAreaView>
    );
}
