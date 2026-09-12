import React, { useState, useMemo } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const FAQS_DATA = [
  {
    id: "1",
    question: "What is the Field Officer App used for?",
    answer: "It is used for on-ground Developer and project acquisition, recording builder meetings, scheduling follow-ups, initiating shared project onboarding drafts, capturing site evidence, nearby project mapping, and submitting daily activity reports."
  },
  {
    id: "2",
    question: "How do I add a new Developer or project lead?",
    answer: "Use the Home quick action to add a lead. Enter the organization and contact name, verified mobile number, project/site location, lead source, interest level, and initial discussion notes."
  },
  {
    id: "3",
    question: "What if the Developer already exists in the system?",
    answer: "Search and select the existing organization profile, then attach the new project opportunity to it rather than creating a duplicate organization entry."
  },
  {
    id: "4",
    question: "Why does the app require continuous location access?",
    answer: "Location is used for high-precision project map pin placement, discovering nearby projects during field travel, and verifying authentic on-ground site attendance."
  },
  {
    id: "5",
    question: "Why does the app need camera and photo permissions?",
    answer: "Camera access is strictly required to capture genuine on-site project photographs, land boundaries, RERA approval documents, and field visit evidence."
  },
  {
    id: "6",
    question: "Does creating a project draft make it live for buyers?",
    answer: "No. The shared onboarding draft is submitted to the Admin verification team. Only after Admin legal, title, and data verification does the project become published and live."
  },
  {
    id: "7",
    question: "Where do I see my scheduled meetings and follow-ups?",
    answer: "Your scheduled builder meetings, follow-up calls, and assigned tasks appear directly on your Home screen dashboard and Tasks tab."
  },
  {
    id: "8",
    question: "How are my field performance numbers calculated?",
    answer: "Metrics derive automatically from authoritative system records (verified leads created, completed meetings, and approved onboardings). Daily reports supplement but do not overwrite domain records."
  },
  {
    id: "9",
    question: "What must be included in the Daily Report?",
    answer: "Your daily submission must detail calls completed, in-person meetings held, site visits conducted, new leads initiated, documents collected, operational bottlenecks encountered, and your next-day action plan."
  },
  {
    id: "10",
    question: "What if I uploaded incorrect project or builder details?",
    answer: "Use the permitted edit flow while the lead is in draft status. If the record has already been locked or submitted for Admin review, raise a support ticket with the corrections needed."
  },
  {
    id: "11",
    question: "Can I access records from another branch or territory?",
    answer: "No. Access is restricted strictly to your assigned branch and operational zone. Cross-branch access attempts are restricted and logged for audit compliance."
  },
  {
    id: "12",
    question: "How do I contact support or report field app issues?",
    answer: "Open Profile > Help & Support and raise a contextual support ticket, selecting the relevant lead ID or location context."
  }
];

export default function FieldOfficerFAQsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState({ "1": true });

  const toggleExpand = (id) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return FAQS_DATA;
    const q = searchQuery.toLowerCase();
    return FAQS_DATA.filter(
      (item) =>
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-[#F8F9FE]">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center border border-gray-200"
        >
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </Pressable>
        <Text className="text-lg font-lato-bold text-gray-900">
          Field Officer FAQs
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Search Bar */}
        <View className="px-5 pt-5 pb-2">
          <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 shadow-sm">
            <Ionicons name="search-outline" size={20} color="#9CA3AF" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search field operations questions..."
              placeholderTextColor="#9CA3AF"
              className="flex-1 ml-2.5 text-sm font-lato text-gray-900"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Subtitle */}
        <View className="px-5 pt-3 pb-4">
          <Text className="text-xs font-lato text-gray-500 uppercase tracking-wider">
            Field Operations Guide ({filteredFaqs.length} Questions)
          </Text>
        </View>

        {/* Accordion List */}
        <View className="px-5">
          {filteredFaqs.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center justify-center border border-gray-200 mt-2">
              <Ionicons name="help-circle-outline" size={44} color="#D1D5DB" />
              <Text className="text-base font-lato-bold text-gray-800 mt-3">
                No matching answers
              </Text>
              <Text className="text-xs font-lato text-gray-500 text-center mt-1">
                Try searching with different keywords or raise a field support ticket.
              </Text>
              <Pressable
                onPress={() => setSearchQuery("")}
                className="mt-4 px-4 py-2 bg-gray-100 rounded-lg"
              >
                <Text className="text-xs font-lato-bold text-gray-700">Clear Search</Text>
              </Pressable>
            </View>
          ) : (
            filteredFaqs.map((item, index) => {
              const isExpanded = !!expandedIds[item.id];
              return (
                <View
                  key={item.id}
                  className="bg-white rounded-xl mb-3 border border-gray-200 overflow-hidden shadow-xs"
                >
                  <Pressable
                    onPress={() => toggleExpand(item.id)}
                    className="p-4 flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center flex-1 pr-3">
                      <View className="w-6 h-6 rounded-full bg-[#EEECFF] items-center justify-center mr-3">
                        <Text className="text-xs font-lato-bold text-[#4A43EC]">
                          {index + 1}
                        </Text>
                      </View>
                      <Text className="flex-1 text-sm font-lato-bold text-gray-900 leading-snug">
                        {item.question}
                      </Text>
                    </View>
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color="#6B7280"
                    />
                  </Pressable>

                  {isExpanded && (
                    <View className="px-4 pb-4 pt-1 border-t border-gray-100 bg-[#FAFAFF]">
                      <Text className="text-xs font-lato text-gray-600 leading-relaxed">
                        {item.answer}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Contact Support Card */}
        <View className="mx-5 mt-6 p-5 bg-[#EEECFF]/80 rounded-2xl border border-[#D9D6FE]">
          <View className="flex-row items-start">
            <View className="w-10 h-10 rounded-full bg-[#4A43EC]/15 items-center justify-center mr-3.5">
              <Ionicons name="navigate-outline" size={20} color="#4A43EC" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-lato-bold text-gray-900">
                Field Operations Help Desk
              </Text>
              <Text className="text-xs font-lato text-gray-600 mt-1 leading-relaxed">
                Reach operations management for territory reassignments, onboarding draft issues, or GPS verification assistance.
              </Text>
              <Pressable
                onPress={() => router.push("/(screens)/contact-us")}
                className="mt-3.5 bg-[#4A43EC] self-start px-4 py-2 rounded-lg active:opacity-80 flex-row items-center"
              >
                <Text className="text-xs font-lato-bold text-white mr-1.5">
                  Contact Field Desk
                </Text>
                <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
