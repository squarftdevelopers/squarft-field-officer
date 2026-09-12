import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Linking, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supportApi } from "../../services/supportApi";

const FIELD_CATEGORIES = [
  "Lead Assignment & Acquisition",
  "Onboarding & Project Drafts",
  "Location & GPS Issues",
  "Daily Report Submission",
  "Attendance & Builder Meetings",
  "Account & Branch Permissions",
  "App Bug / Technical Issue",
  "Other"
];

export default function FieldOfficerContactScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState(FIELD_CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleOpenEmail = () => {
    Linking.openURL("mailto:support@squarft.com?subject=Squar%20FT%20Field%20Officer%20Support");
  };

  const handleCall = () => {
    Linking.openURL("tel:+918225000092");
  };

  const handleWhatsApp = () => {
    Linking.openURL("https://wa.me/918225000092?text=Hello%20Squar%20FT%20Field%20Desk");
  };

  const handleSubmitTicket = async () => {
    if (!subject.trim()) {
      Alert.alert("Required Field", "Please enter a subject for your request.");
      return;
    }
    if (!message.trim()) {
      Alert.alert("Required Field", "Please describe your field issue.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await supportApi.createTicket({
        category: selectedCategory,
        subject: subject.trim(),
        referenceId: referenceId.trim(),
        message: message.trim(),
      });

      const ticketCode = res?.data?.ticketCode || res?.data?.ticket_code || 'Recorded';
      Alert.alert(
        "Field Ticket Logged",
        `Your request under category "${selectedCategory}" has been submitted successfully.\n\nTicket Code: ${ticketCode}\n\nYour territory coordinator will respond shortly.`,
        [
          {
            text: "OK",
            onPress: () => {
              setSubject("");
              setReferenceId("");
              setMessage("");
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert(
        "Submission Failed",
        error.message || "Failed to submit your field ticket. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

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
          Field Operations Desk
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 50 }}
        className="px-5"
      >
        {/* Security Warning Notice */}
        <View className="bg-amber-50 rounded-2xl p-4 border border-amber-200 mt-4 mb-4">
          <View className="flex-row items-center mb-1.5">
            <Ionicons name="warning-outline" size={18} color="#D97706" />
            <Text className="text-xs font-lato-bold text-amber-900 ml-1.5 uppercase tracking-wide">
              Field Security Notice
            </Text>
          </View>
          <Text className="text-xs font-lato text-amber-900 leading-relaxed">
            Never share OTPs, passwords, or employee credentials through support messages. Maintain strict confidentiality regarding developer leads and contact records.
          </Text>
        </View>

        {/* Quick Contact Options */}
        <Text className="text-xs font-lato-bold text-gray-500 uppercase tracking-wider mb-2.5">
          Field Coordinator Channels
        </Text>

        <View className="flex-row space-x-3 mb-5">
          {/* Email */}
          <Pressable
            onPress={handleOpenEmail}
            className="flex-1 bg-white p-3.5 rounded-2xl border border-gray-200 items-center shadow-xs active:bg-gray-50"
          >
            <View className="w-10 h-10 rounded-full bg-[#EEECFF] items-center justify-center mb-2">
              <Ionicons name="mail" size={20} color="#4A43EC" />
            </View>
            <Text className="text-xs font-lato-bold text-gray-900">Operations Email</Text>
            <Text className="text-[11px] font-lato text-gray-500 mt-0.5">support@squarft.com</Text>
          </Pressable>

          {/* Call */}
          <Pressable
            onPress={handleCall}
            className="flex-1 bg-white p-3.5 rounded-2xl border border-gray-200 items-center shadow-xs active:bg-gray-50"
          >
            <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mb-2">
              <Ionicons name="call" size={20} color="#2563EB" />
            </View>
            <Text className="text-xs font-lato-bold text-gray-900">Helpline</Text>
            <Text className="text-[11px] font-lato text-gray-500 mt-0.5">+91 8225000092</Text>
          </Pressable>

          {/* WhatsApp */}
          <Pressable
            onPress={handleWhatsApp}
            className="flex-1 bg-white p-3.5 rounded-2xl border border-gray-200 items-center shadow-xs active:bg-gray-50"
          >
            <View className="w-10 h-10 rounded-full bg-green-50 items-center justify-center mb-2">
              <Ionicons name="logo-whatsapp" size={20} color="#16A34A" />
            </View>
            <Text className="text-xs font-lato-bold text-gray-900">WhatsApp</Text>
            <Text className="text-[11px] font-lato text-gray-500 mt-0.5">Field Chat</Text>
          </Pressable>
        </View>

        {/* Operating Hours & Office Location */}
        <View className="bg-white rounded-2xl p-4 border border-gray-200 mb-6 shadow-xs">
          <View className="flex-row items-center mb-2">
            <Ionicons name="time-outline" size={16} color="#4B5563" />
            <Text className="text-xs font-lato-bold text-gray-800 ml-2">
              Coordinator Hours:
            </Text>
            <Text className="text-xs font-lato text-gray-600 ml-1">
              Monday – Saturday, 10:00 AM – 8:00 PM IST
            </Text>
          </View>
          <View className="flex-row items-start mt-1">
            <Ionicons name="location-outline" size={16} color="#4B5563" className="mt-0.5" />
            <View className="ml-2 flex-1">
              <Text className="text-xs font-lato-bold text-gray-800">
                Operations HQ:
              </Text>
              <Text className="text-xs font-lato text-gray-600 mt-0.5 leading-relaxed">
                214/Sadhguru Pariyan , Vijay nagar, Indore
              </Text>
            </View>
          </View>
        </View>

        {/* Raise Field Ticket Form */}
        <Text className="text-xs font-lato-bold text-gray-500 uppercase tracking-wider mb-2.5">
          Submit Contextual Field Ticket
        </Text>

        <View className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs">
          {/* Category Picker Chips */}
          <Text className="text-xs font-lato-bold text-gray-800 mb-2">
            Select Category *
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-row mb-4"
          >
            {FIELD_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full mr-2 border ${
                    active
                      ? "bg-[#4A43EC] border-[#4A43EC]"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <Text
                    className={`text-xs ${
                      active ? "text-white font-lato-bold" : "text-gray-700 font-lato"
                    }`}
                  >
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Subject Field */}
          <Text className="text-xs font-lato-bold text-gray-800 mb-1.5">
            Subject *
          </Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="e.g. GPS check-in failed at Green Valley project"
            placeholderTextColor="#9CA3AF"
            className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-lato text-gray-900 mb-3"
          />

          {/* Reference ID */}
          <Text className="text-xs font-lato-bold text-gray-800 mb-1.5">
            Lead or Task ID (Optional)
          </Text>
          <TextInput
            value={referenceId}
            onChangeText={setReferenceId}
            placeholder="Lead ID, Project Onboarding ID, or Date"
            placeholderTextColor="#9CA3AF"
            className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-lato text-gray-900 mb-3"
          />

          {/* Description */}
          <Text className="text-xs font-lato-bold text-gray-800 mb-1.5">
            Description *
          </Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Explain the field issue, location coordinates, or builder update."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-lato text-gray-900 mb-4 h-24"
          />

          {/* Submit Button */}
          <Pressable
            onPress={handleSubmitTicket}
            disabled={submitting}
            className={`rounded-xl py-3 items-center justify-center flex-row active:opacity-90 ${
              submitting ? "bg-[#3832bd]" : "bg-[#4A43EC]"
            }`}
          >
            {submitting && (
              <ActivityIndicator size="small" color="#FFFFFF" className="mr-2" />
            )}
            <Text className="text-sm font-lato-bold text-white">
              {submitting ? "Submitting..." : "Submit Field Ticket"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
