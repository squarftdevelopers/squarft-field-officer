import { Text, View, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Link, router } from "expo-router";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setFirstName, setLastName, setMobile, setOtpFlow, setOtpToken, clearOtp } from "../../store/slices/authSlice";
import { authAPI } from "../../services/api";

const logo = require("../../assets/icons/app-icon.png");
const COUNTRY_CODE = "+91";

export default function Register() {
    const dispatch = useDispatch();
    const { firstName, lastName, mobile } = useSelector((state) => state.auth);
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (!firstName.trim() || !lastName.trim()) {
            Alert.alert("Missing Information", "Please enter your first and last name");
            return;
        }

        if (!mobile.trim()) {
            Alert.alert("Missing Information", "Please enter your mobile number");
            return;
        }

        if (mobile.length !== 10) {
            Alert.alert("Error", "Please enter a valid 10-digit mobile number");
            return;
        }

        setLoading(true);
        try {
            const response = await authAPI.sendOtp(`${COUNTRY_CODE}${mobile}`, "register");
            dispatch(setOtpFlow("register"));
            dispatch(setOtpToken(response.otp_token));
            dispatch(clearOtp());
            router.push("/otp-verification");
        } catch (error) {
            console.log("Registration failed", {
                response: error.response?.data,
                status: error.response?.status,
                message: error.message,
            });
            Alert.alert(
                "Registration Failed",
                error.response?.data?.message || error.message || "Unable to register"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1">
            <StatusBar style="light" />

            <View className="bg-[#4A43EC] pt-16 pb-10 px-7">
                <View style={{ width: 60, height: 60, overflow: 'hidden' }} className="mb-5 mt-4" >
                    <Image source={logo} style={{ width: 110, height: 110, margin: -30 }} resizeMode="contain" />
                </View>
                <Text className="text-white text-[36px] font-bold mb-1">Register</Text>
                <Link href="/login">
                    <Text className="text-white text-[14px] underline ">Log in</Text>
                </Link>
            </View>

            <View className="flex-1 bg-white px-6 pt-8">

                <Text className="text-gray-500 text-[13px] mb-1.5">First Name</Text>
                <View className="border border-gray-200 rounded-xl px-4 py-2 mb-5">
                    <TextInput
                        value={firstName}
                        onChangeText={(val) => dispatch(setFirstName(val))}
                        placeholder="First Name"
                        placeholderTextColor="#aaa"
                        autoCapitalize="words"
                        className="text-[15px] text-black"
                    />
                </View>

                <Text className="text-gray-500 text-[13px] mb-1.5">Last Name</Text>
                <View className="border border-gray-200 rounded-xl px-4 py-2 mb-5">
                    <TextInput
                        value={lastName}
                        onChangeText={(val) => dispatch(setLastName(val))}
                        placeholder="Last Name"
                        placeholderTextColor="#aaa"
                        autoCapitalize="words"
                        className="text-[15px] text-black"
                    />
                </View>

                {/* Mobile */}
                <Text className="text-gray-500 text-[13px] mb-1.5">Phone Number</Text>
                <View className="border border-gray-200 rounded-xl px-4 py-2 mb-5 flex-row items-center">
                    <Text className="text-[15px] text-black font-semibold mr-2">{COUNTRY_CODE}</Text>
                    <View className="w-[1px] h-5 bg-gray-200 mr-3" />
                    <TextInput
                        value={mobile}
                        onChangeText={(val) => dispatch(setMobile(val.replace(/[^0-9]/g, '').slice(0, 10)))}
                        placeholder="Phone Number"
                        placeholderTextColor="#aaa"
                        keyboardType="phone-pad"
                        maxLength={10}
                        className="flex-1 text-[15px] text-black"
                    />
                </View>

                <TouchableOpacity
                    onPress={handleRegister}
                    disabled={loading}
                    className="bg-[#4A43EC] rounded-2xl py-4 items-center"
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text className="text-white text-[16px] font-semibold">Send OTP</Text>
                    )}
                </TouchableOpacity>

            </View>
        </View>
    );
}
