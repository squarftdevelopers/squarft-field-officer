import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function FieldOfficerTermsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-[#F8F9FE]">
      {/* Top Header */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center border border-gray-200"
        >
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </Pressable>
        <Text className="text-lg font-lato-bold text-gray-900">
          Terms & Conditions
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 50 }}
        className="px-5"
      >
        {/* Header Card */}
        <View className="bg-white rounded-2xl p-5 border border-gray-200 mt-4 mb-4 shadow-xs">
          <View className="flex-row items-center mb-2">
            <View className="px-2.5 py-1 rounded-full bg-[#EEECFF] border border-[#D9D6FE] mr-2">
              <Text className="text-[11px] font-lato-bold text-[#4A43EC]">
                FIELD OFFICER
              </Text>
            </View>
            <Text className="text-xs font-lato text-gray-500">
              Effective: September 2026
            </Text>
          </View>
          <Text className="text-base font-lato-bold text-gray-900 leading-snug">
            Field Officer Operational Terms & Code of Conduct
          </Text>
          <Text className="text-xs font-lato text-gray-500 mt-1">
            squarFT by Paxtrade Global Pvt. Ltd.
          </Text>
        </View>

        {/* Operational Mandate Callout */}
        <View className="bg-amber-50 rounded-2xl p-4 border border-amber-200 mb-5">
          <View className="flex-row items-center mb-2">
            <Ionicons name="warning" size={18} color="#B45309" />
            <Text className="text-xs font-lato-bold text-amber-900 ml-1.5 uppercase tracking-wide">
              Mandatory Operational Standards
            </Text>
          </View>
          <Text className="text-xs font-lato text-amber-950 leading-relaxed">
            Use the app strictly for assigned and authorized business activity. Location tracking, photographs, documents, and on-ground evidence must reflect actual activity and must never be fabricated.
          </Text>
          <Text className="text-xs font-lato text-amber-950 leading-relaxed mt-2 font-lato-bold">
            Approval Authority & Confidentiality: Creating a lead or shared project draft does not constitute final approval; Admin remains the sole approval authority. All developer, property, and contact information is strictly confidential.
          </Text>
        </View>

        {/* Section 1 */}
        <View className="bg-white rounded-xl p-4 border border-gray-200 mb-3 shadow-xs">
          <Text className="text-sm font-lato-bold text-gray-900 mb-1.5">
            1. Acceptance and Scope
          </Text>
          <Text className="text-xs font-lato text-gray-600 leading-relaxed">
            These Terms govern access to and use of this Squar FT Field Officer application. By registering, logging in or using the app, you agree to these Terms and the Privacy Policy. Permitted records synchronize with Admin, developer panel, visit, and performance monitoring modules.
          </Text>
        </View>

        {/* Section 2 */}
        <View className="bg-white rounded-xl p-4 border border-gray-200 mb-3 shadow-xs">
          <Text className="text-sm font-lato-bold text-gray-900 mb-1.5">
            2. Eligibility and Account Security
          </Text>
          <Text className="text-xs font-lato text-gray-600 leading-relaxed">
            Use only your authorized corporate mobile number, keep OTPs confidential, and promptly report suspected unauthorized access. OTP verification confirms control of a phone number; it does not grant authorization to act outside designated territory.
          </Text>
        </View>

        {/* Section 3 */}
        <View className="bg-white rounded-xl p-4 border border-gray-200 mb-3 shadow-xs">
          <Text className="text-sm font-lato-bold text-gray-900 mb-1.5">
            3. Accurate Information and On-Ground Evidence
          </Text>
          <Text className="text-xs font-lato text-gray-600 leading-relaxed">
            Developer information, project boundaries, GPS coordinates, meeting summaries, photos, and next-day action plans must be 100% genuine and lawfully submitted. Mock locations, fabricated photos, or fraudulent check-ins constitute gross misconduct.
          </Text>
        </View>

        {/* Section 4 */}
        <View className="bg-white rounded-xl p-4 border border-gray-200 mb-3 shadow-xs">
          <Text className="text-sm font-lato-bold text-gray-900 mb-1.5">
            4. Platform Records and Approvals
          </Text>
          <Text className="text-xs font-lato text-gray-600 leading-relaxed">
            All leads and onboarding drafts undergo administrative audit. Creating an onboarding submission does not replace official title, legal, RERA, or financial due diligence performed by the compliance team.
          </Text>
        </View>

        {/* Section 5 */}
        <View className="bg-white rounded-xl p-4 border border-gray-200 mb-3 shadow-xs">
          <Text className="text-sm font-lato-bold text-gray-900 mb-1.5">
            5. Acceptable Use and Territory Boundaries
          </Text>
          <Text className="text-xs font-lato text-gray-600 leading-relaxed">
            Do not attempt unauthorized access, bypass assigned branch or zone boundaries, interfere with tracking controls, scrape contact records, or disclose proprietary real estate intelligence to third parties.
          </Text>
        </View>

        {/* Section 6 */}
        <View className="bg-white rounded-xl p-4 border border-gray-200 mb-3 shadow-xs">
          <Text className="text-sm font-lato-bold text-gray-900 mb-1.5">
            6. Third-Party Services
          </Text>
          <Text className="text-xs font-lato text-gray-600 leading-relaxed">
            The app utilizes Google Maps, GPS location providers, push notifications, and cloud media storage. Third-party terms and signal availability apply.
          </Text>
        </View>

        {/* Section 7 */}
        <View className="bg-white rounded-xl p-4 border border-gray-200 mb-3 shadow-xs">
          <Text className="text-sm font-lato-bold text-gray-900 mb-1.5">
            7. Availability and Changes
          </Text>
          <Text className="text-xs font-lato text-gray-600 leading-relaxed">
            Operational features and workflows may be updated or reconfigured for performance, security, or regulatory alignment. Current policies are accessible in-app and on the company portal.
          </Text>
        </View>

        {/* Section 8 */}
        <View className="bg-white rounded-xl p-4 border border-gray-200 mb-3 shadow-xs">
          <Text className="text-sm font-lato-bold text-gray-900 mb-1.5">
            8. Suspension and De-Authorization
          </Text>
          <Text className="text-xs font-lato text-gray-600 leading-relaxed">
            Account access may be revoked immediately for location tampering, evidence fabrication, policy violation, territory infringement, or employment cessation.
          </Text>
        </View>

        {/* Section 9 */}
        <View className="bg-white rounded-xl p-4 border border-gray-200 mb-3 shadow-xs">
          <Text className="text-sm font-lato-bold text-gray-900 mb-1.5">
            9. Intellectual Property
          </Text>
          <Text className="text-xs font-lato text-gray-600 leading-relaxed">
            All leads, project data, photos, documents, and reporting records collected through the application are the proprietary work product and property of squarFT by Paxtrade Global Pvt. Ltd..
          </Text>
        </View>

        {/* Section 10 */}
        <View className="bg-white rounded-xl p-4 border border-gray-200 mb-4 shadow-xs">
          <Text className="text-sm font-lato-bold text-gray-900 mb-1.5">
            10. Governing Law
          </Text>
          <Text className="text-xs font-lato text-gray-600 leading-relaxed">
            These Terms are governed by the laws of India, and any disputes shall be resolved in the competent courts in Indore, Madhya Pradesh, India.
          </Text>
        </View>

        {/* Footer Links */}
        <View className="flex-row items-center justify-between p-4 bg-gray-100 rounded-xl mt-2">
          <Pressable
            onPress={() => router.push("/(screens)/privacy-policy")}
            className="flex-row items-center"
          >
            <Text className="text-xs font-lato-bold text-[#4A43EC] mr-1">
              Privacy Policy
            </Text>
            <Ionicons name="arrow-forward" size={14} color="#4A43EC" />
          </Pressable>
          <Pressable
            onPress={() => router.push("/(screens)/contact-us")}
            className="flex-row items-center"
          >
            <Text className="text-xs font-lato-bold text-gray-700 mr-1">
              Field Desk
            </Text>
            <Ionicons name="chevron-forward" size={14} color="#4B5563" />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
