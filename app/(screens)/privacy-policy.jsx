import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function FieldOfficerPrivacyScreen() {
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
          Privacy Policy
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
                OFFICER PRIVACY
              </Text>
            </View>
            <Text className="text-xs font-lato text-gray-500">
              Effective: September 2026
            </Text>
          </View>
          <Text className="text-base font-lato-bold text-gray-900 leading-snug">
            Field Officer Data Handling & Privacy Policy
          </Text>
          <Text className="text-xs font-lato text-gray-500 mt-1">
            squarFT by Paxtrade Global Pvt. Ltd.
          </Text>
        </View>

        {/* Data Scope Callout */}
        <View className="bg-[#EEECFF]/80 rounded-2xl p-4 border border-[#D9D6FE] mb-5">
          <View className="flex-row items-center mb-2">
            <Ionicons name="compass" size={18} color="#4A43EC" />
            <Text className="text-xs font-lato-bold text-[#4A43EC] ml-1.5 uppercase tracking-wide">
              Field Officer Data Scope & Location Telemetry
            </Text>
          </View>
          <Text className="text-xs font-lato text-gray-900 leading-relaxed">
            The Field Officer App processes:
          </Text>
          <View className="mt-2 space-y-1">
            <Text className="text-xs font-lato text-gray-800">
              • Officer profile, assigned branch, and operational zone context
            </Text>
            <Text className="text-xs font-lato text-gray-800">
              • Developer/Agency lead profiles, contacts, and discussion notes
            </Text>
            <Text className="text-xs font-lato text-gray-800">
              • Project site coordinates, map pin locations, and nearby project scans
            </Text>
            <Text className="text-xs font-lato text-gray-800">
              • Meeting records, follow-up logs, tasks, and site onboarding media
            </Text>
            <Text className="text-xs font-lato text-gray-800">
              • Daily reports (calls, meetings, visits, leads, and next-day plans)
            </Text>
            <Text className="text-xs font-lato text-gray-800">
              • Performance metrics and contextual support tickets
            </Text>
          </View>
        </View>

        {/* Section 1 */}
        <View className="bg-white rounded-xl p-4 border border-gray-200 mb-3 shadow-xs">
          <Text className="text-sm font-lato-bold text-gray-900 mb-1.5">
            1. What this Policy Covers
          </Text>
          <Text className="text-xs font-lato text-gray-600 leading-relaxed">
            This Policy covers operational, location, telemetry, and reporting data collected during assigned real estate business activities via the Squar FT Field Officer application.
          </Text>
        </View>

        {/* Section 2 */}
        <View className="bg-white rounded-xl p-4 border border-gray-200 mb-3 shadow-xs">
          <Text className="text-sm font-lato-bold text-gray-900 mb-1.5">
            2. Common Data Processed
          </Text>
          <Text className="text-xs font-lato text-gray-600 leading-relaxed">
            Includes mobile phone number, OTP session authentication, officer name and branch ID, device hardware telemetry, battery and network status, GPS coordinates during duty hours, and operational audit logs.
          </Text>
        </View>

        {/* Section 3 */}
        <View className="bg-white rounded-xl p-4 border border-gray-200 mb-3 shadow-xs">
          <Text className="text-sm font-lato-bold text-gray-900 mb-1.5">
            3. Operational Purpose of Data
          </Text>
          <Text className="text-xs font-lato text-gray-600 leading-relaxed">
            We use information to authenticate field personnel, assign territory and tasks, verify on-site visits and builder meetings, track onboarding draft progression, calculate transparent performance KPIs, and maintain an authoritative daily report audit trail.
          </Text>
        </View>

        {/* Section 4 */}
        <View className="bg-white rounded-xl p-4 border border-gray-200 mb-3 shadow-xs">
          <Text className="text-sm font-lato-bold text-gray-900 mb-1.5">
            4. Access Control & Branch Isolation
          </Text>
          <Text className="text-xs font-lato text-gray-600 leading-relaxed">
            Lead and project data collected by Field Officers is strictly compartmentalized. Records are accessible to regional managers, compliance auditors, and central administrators strictly on a need-to-know basis.
          </Text>
        </View>

        {/* Section 5 */}
        <View className="bg-white rounded-xl p-4 border border-gray-200 mb-3 shadow-xs">
          <Text className="text-sm font-lato-bold text-gray-900 mb-1.5">
            5. Location & Media Evidence Security
          </Text>
          <Text className="text-xs font-lato text-gray-600 leading-relaxed">
            GPS location coordinates and captured site photos are timestamped, encrypted during transit, and verified against geofences to prevent fabrication or data tampering.
          </Text>
        </View>

        {/* Section 6 */}
        <View className="bg-white rounded-xl p-4 border border-gray-200 mb-3 shadow-xs">
          <Text className="text-sm font-lato-bold text-gray-900 mb-1.5">
            6. Retention of Operational Data
          </Text>
          <Text className="text-xs font-lato text-gray-600 leading-relaxed">
            Field reports, developer lead submissions, and attendance logs are retained as part of official corporate records for compliance, dispute management, and performance audits.
          </Text>
        </View>

        {/* Section 7 */}
        <View className="bg-white rounded-xl p-4 border border-gray-200 mb-3 shadow-xs">
          <Text className="text-sm font-lato-bold text-gray-900 mb-1.5">
            7. Officer Rights & Inquiries
          </Text>
          <Text className="text-xs font-lato text-gray-600 leading-relaxed">
            Officers may view their performance logs and submitted reports. Inquiries regarding data corrections or branch profile updates can be submitted to privacy@squarft.com.
          </Text>
        </View>

        {/* Section 8 */}
        <View className="bg-white rounded-xl p-4 border border-gray-200 mb-3 shadow-xs">
          <Text className="text-sm font-lato-bold text-gray-900 mb-1.5">
            8. Device Permissions
          </Text>
          <View className="space-y-1.5 mt-1">
            <Text className="text-xs font-lato text-gray-600">
              • <Text className="font-lato-bold text-gray-800">Location:</Text> Required for project map pin placement, nearby lead exploration, and on-ground meeting verification.
            </Text>
            <Text className="text-xs font-lato text-gray-600">
              • <Text className="font-lato-bold text-gray-800">Camera / Media:</Text> Required to capture on-site project evidence, layout plans, and onboarding documents.
            </Text>
            <Text className="text-xs font-lato text-gray-600">
              • <Text className="font-lato-bold text-gray-800">Notifications:</Text> Task assignments, meeting reminders, and daily report submission prompts.
            </Text>
          </View>
        </View>

        {/* Section 9 */}
        <View className="bg-white rounded-xl p-4 border border-gray-200 mb-4 shadow-xs">
          <Text className="text-sm font-lato-bold text-gray-900 mb-1.5">
            9. Grievance Officer & Contact
          </Text>
          <Text className="text-xs font-lato text-gray-600 leading-relaxed">
            For questions regarding operational telemetry, privacy policies, or record corrections, contact:
          </Text>
          <Text className="text-xs font-lato-bold text-gray-800 mt-2">
            Grievance Officer: Squar FT Operations Desk
          </Text>
          <Text className="text-xs font-lato text-gray-600">
            Email: privacy@squarft.com
          </Text>
          <Text className="text-xs font-lato text-gray-600">
            Address: 214/Sadhguru Pariyan , Vijay nagar, Indore
          </Text>
        </View>

        {/* Footer Links */}
        <View className="flex-row items-center justify-between p-4 bg-gray-100 rounded-xl mt-2">
          <Pressable
            onPress={() => router.push("/(screens)/terms-and-conditions")}
            className="flex-row items-center"
          >
            <Text className="text-xs font-lato-bold text-[#4A43EC] mr-1">
              Terms & Conditions
            </Text>
            <Ionicons name="arrow-forward" size={14} color="#4A43EC" />
          </Pressable>
          <Pressable
            onPress={() => router.push("/(screens)/faqs")}
            className="flex-row items-center"
          >
            <Text className="text-xs font-lato-bold text-gray-700 mr-1">
              View FAQs
            </Text>
            <Ionicons name="chevron-forward" size={14} color="#4B5563" />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
