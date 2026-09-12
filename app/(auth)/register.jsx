import { Text, View, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setFirstName, setLastName, setBranch, setMobile, setOtpFlow, setOtpToken, clearOtp } from "../../store/slices/authSlice";
import { authAPI } from "../../services/api";
import { branchService } from "../../services/branchService";
import { Ionicons } from "@expo/vector-icons";

const logo = require("../../assets/icons/app-icon.png");
const COUNTRY_CODE = "+91";

export default function Register() {
    const dispatch = useDispatch();
    const { firstName, lastName, branchId, branchName, mobile } = useSelector((state) => state.auth);
    const [loading, setLoading] = useState(false);
    const [branches, setBranches] = useState([]);
    const [branchesLoading, setBranchesLoading] = useState(true);
    const [branchesError, setBranchesError] = useState('');
    const [showBranchDropdown, setShowBranchDropdown] = useState(false);

    useEffect(() => {
        const loadBranches = async () => {
            try {
                setBranchesError('');
                setBranches(await branchService.getBranches());
            } catch (error) {
                setBranchesError(error.message);
            } finally {
                setBranchesLoading(false);
            }
        };
        loadBranches();
    }, []);

    const handleRegister = async () => {
        if (!firstName.trim() || !lastName.trim()) {
            Alert.alert("Missing Information", "Please enter your first and last name");
            return;
        }

        if (!mobile.trim()) {
            Alert.alert("Missing Information", "Please enter your mobile number");
            return;
        }

        if (!branchId) {
            Alert.alert("Missing Information", "Please select your branch");
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

            <ScrollView
                className="flex-1 bg-white"
                contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >

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

                <View className="z-10">
                    <Text className="text-gray-500 text-[13px] mb-1.5">Branch</Text>
                    <TouchableOpacity
                        onPress={() => setShowBranchDropdown((visible) => !visible)}
                        disabled={branchesLoading}
                        className="border border-gray-200 rounded-xl px-4 h-12 mb-5 flex-row items-center justify-between"
                    >
                        <Text className={branchName ? "text-[15px] text-black" : "text-[15px] text-gray-400"}>
                            {branchesLoading ? "Loading branches..." : (branchName || "Select Branch")}
                        </Text>
                        <Ionicons name={showBranchDropdown ? "chevron-up" : "chevron-down"} size={19} color="#666" />
                    </TouchableOpacity>

                    {branchesError ? <Text className="text-red-500 text-[12px] mb-4 -mt-3">{branchesError}</Text> : null}

                    {showBranchDropdown && (
                        <View className="absolute top-[55px] left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-56 overflow-hidden">
                            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                {branches.length ? branches.map((branch) => {
                                    const label = branch.city ? `${branch.name} — ${branch.city}` : branch.name;
                                    return (
                                        <TouchableOpacity
                                            key={branch.id}
                                            onPress={() => {
                                                dispatch(setBranch({ id: branch.id, name: label }));
                                                setShowBranchDropdown(false);
                                            }}
                                            className="px-4 py-3 border-b border-gray-100"
                                        >
                                            <Text className={branchId === branch.id ? "text-[#4A43EC]" : "text-gray-800"}>{label}</Text>
                                        </TouchableOpacity>
                                    );
                                }) : (
                                    <Text className="px-4 py-3 text-gray-400">No branches available</Text>
                                )}
                            </ScrollView>
                        </View>
                    )}
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

                <View className="items-center justify-center pt-5 pb-4">
                    <Text className="text-center text-xs text-gray-400 font-lato leading-5">
                        By registering, you agree to our{"\n"}
                        <Text
                            onPress={() => router.push("/(screens)/terms-and-conditions")}
                            className="font-bold text-[#4A43EC]"
                        >
                            Terms & Conditions
                        </Text>
                        {" "}and{" "}
                        <Text
                            onPress={() => router.push("/(screens)/privacy-policy")}
                            className="font-bold text-[#4A43EC]"
                        >
                            Privacy Policy
                        </Text>
                    </Text>
                </View>

            </ScrollView>
        </View>
    );
}
