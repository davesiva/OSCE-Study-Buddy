import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { CASES } from "@/data/cases";
import { apiRequest } from "@/lib/query-client";
import { getChatCompletion, getAssessment } from "@/lib/openai-service";

interface CaseData {
  case_id: string;
  patient_name: string;
  age: number;
  gender: string;
  chief_complaint: string;
  presenting_history: string;
  vitals: Record<string, string>;
  past_medical_history: string[];
  social_history: string;
  allergies: string;
  script_instructions: string;
  secret_info: string;
  expected_diagnosis: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const LOCAL_CASES_KEY = "custom_cases_local";

function CaseSelector({
  cases,
  selectedCase,
  onSelect,
  isOpen,
  onOpenChange,
}: {
  cases: CaseData[];
  selectedCase: CaseData | null;
  onSelect: (caseData: CaseData) => void;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={styles.caseSelectorContainer}>
      <Pressable
        onPress={() => onOpenChange(!isOpen)}
        style={[
          styles.caseSelector,
          { backgroundColor: theme.backgroundDefault },
        ]}
      >
        <View style={styles.caseSelectorContent}>
          <Feather name="folder" size={20} color={theme.link} />
          <ThemedText style={styles.caseSelectorText} numberOfLines={1}>
            {selectedCase
              ? `${selectedCase.patient_name} - ${selectedCase.chief_complaint}`
              : "Select a case"}
          </ThemedText>
        </View>
        <Feather
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={20}
          color={theme.text}
        />
      </Pressable>

      {isOpen ? (
        <View
          style={[
            styles.caseDropdown,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <ScrollView
            style={styles.caseDropdownScroll}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {cases.map((caseData) => (
              <Pressable
                key={caseData.case_id}
                onPress={() => {
                  onSelect(caseData);
                  onOpenChange(false);
                }}
                style={[
                  styles.caseOption,
                  selectedCase?.case_id === caseData.case_id && {
                    backgroundColor: theme.backgroundSecondary,
                  },
                ]}
              >
                <ThemedText style={styles.caseOptionName}>
                  {caseData.patient_name}
                </ThemedText>
                <ThemedText style={styles.caseOptionComplaint}>
                  {caseData.chief_complaint}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function PatientDetails({ caseData }: { caseData: CaseData }) {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const vitalsArray = Object.entries(caseData.vitals || {});

  return (
    <View style={styles.detailsContainer}>
      <Pressable
        onPress={() => setIsExpanded(!isExpanded)}
        style={[
          styles.detailsHeader,
          { backgroundColor: theme.backgroundDefault },
        ]}
      >
        <View style={styles.detailsHeaderContent}>
          <Feather name="user" size={18} color={theme.link} />
          <ThemedText style={styles.detailsHeaderText}>
            Show Patient Details
          </ThemedText>
        </View>
        <Feather
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={theme.text}
        />
      </Pressable>

      {isExpanded ? (
        <View
          style={[
            styles.detailsContent,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Patient:</ThemedText>
            <ThemedText style={styles.detailValue}>
              {caseData.patient_name}
            </ThemedText>
          </View>

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Age/Gender:</ThemedText>
            <ThemedText style={styles.detailValue}>
              {caseData.age} years old, {caseData.gender}
            </ThemedText>
          </View>

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Chief Complaint:</ThemedText>
            <ThemedText style={styles.detailValue}>
              {caseData.chief_complaint}
            </ThemedText>
          </View>

          <View style={styles.vitalsSection}>
            <ThemedText style={styles.vitalsTitle}>Vital Signs</ThemedText>
            <View style={styles.vitalsGrid}>
              {vitalsArray.map(([key, value]) => (
                <View
                  key={key}
                  style={[
                    styles.vitalItem,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <ThemedText style={styles.vitalLabel}>
                    {key.replace(/_/g, " ").toUpperCase()}
                  </ThemedText>
                  <ThemedText style={styles.vitalValue}>{value}</ThemedText>
                </View>
              ))}
            </View>
          </View>

          {caseData.allergies ? (
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Allergies:</ThemedText>
              <ThemedText style={styles.detailValue}>
                {caseData.allergies}
              </ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const { theme } = useTheme();
  const isUser = message.role === "user";

  return (
    <Animated.View
      entering={FadeInUp.duration(300)}
      style={[
        styles.messageBubble,
        isUser ? styles.userBubble : styles.assistantBubble,
        {
          backgroundColor: isUser ? theme.link : theme.backgroundDefault,
        },
      ]}
    >
      <View style={styles.messageHeader}>
        <Feather
          name={isUser ? "user" : "heart"}
          size={14}
          color={isUser ? "#FFFFFF" : theme.text}
          style={styles.messageIcon}
        />
        <ThemedText
          style={[
            styles.messageRole,
            { color: isUser ? "rgba(255,255,255,0.8)" : theme.text },
          ]}
        >
          {isUser ? "You (Doctor)" : "Patient"}
        </ThemedText>
      </View>
      <ThemedText
        style={[styles.messageText, { color: isUser ? "#FFFFFF" : theme.text }]}
      >
        {message.content}
      </ThemedText>
    </Animated.View>
  );
}

function EmptyState() {
  const { theme } = useTheme();

  return (
    <View style={styles.emptyState}>
      <View
        style={[styles.emptyIcon, { backgroundColor: theme.backgroundDefault }]}
      >
        <Feather name="message-circle" size={48} color={theme.link} />
      </View>
      <ThemedText type="h4" style={styles.emptyTitle}>
        Start the Consultation
      </ThemedText>
      <ThemedText style={styles.emptyText}>
        Greet the patient or ask about their complaint.{"\n\n"}Try: "Hello, I'm
        the medical student. What brings you in today?"
      </ThemedText>
    </View>
  );
}

export default function OSCESimulatorScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [cases, setCases] = useState<CaseData[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isAssessing, setIsAssessing] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const sendScale = useSharedValue(1);

  const sendButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  useEffect(() => {
    loadCases();
  }, []);

  useEffect(() => {
    if (selectedCase) {
      loadChatHistory(selectedCase.case_id);
    }
  }, [selectedCase]);

  const loadCases = async () => {
    try {
      setIsLoading(true);
      let serverCases: CaseData[] = [];
      try {
        if (Platform.OS === 'web') {
          const res = await apiRequest("GET", "/api/cases");
          serverCases = await res.json();
        } else {
          // Fallback to bundled for native if not using a tunnel/IP
          serverCases = CASES as unknown as CaseData[];
        }
      } catch (e) {
        console.warn("Failed to fetch cases from server, using bundled:", e);
        serverCases = CASES as unknown as CaseData[];
      }

      let localCases: CaseData[] = [];
      try {
        const localCasesJson = await AsyncStorage.getItem(LOCAL_CASES_KEY);
        if (localCasesJson) {
          localCases = JSON.parse(localCasesJson);
        }
      } catch (e) {
        console.error("Error loading local cases:", e);
      }

      const allCases = [...serverCases, ...localCases];
      setCases(allCases);
      if (allCases.length > 0) {
        setSelectedCase(allCases[0]);
      }
    } catch (error) {
      console.error("Error loading cases:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadChatHistory = async (caseId: string) => {
    try {
      const stored = await AsyncStorage.getItem(`chat_${caseId}`);
      if (stored) {
        setMessages(JSON.parse(stored));
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
      setMessages([]);
    }
  };

  const saveChatHistory = async (caseId: string, msgs: ChatMessage[]) => {
    try {
      await AsyncStorage.setItem(`chat_${caseId}`, JSON.stringify(msgs));
    } catch (error) {
      console.error("Error saving chat history:", error);
    }
  };

  const handleCaseSelect = (caseData: CaseData) => {
    setSelectedCase(caseData);
  };

  const handleSend = async () => {
    if (!inputText.trim() || !selectedCase || isSending) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputText.trim(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText("");
    setIsSending(true);

    try {
      // Use client-side OpenAI service
      const responseContent = await getChatCompletion(
        newMessages.map((m) => ({ role: m.role, content: m.content })),
        selectedCase
      );

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responseContent,
      };

      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);
      saveChatHistory(selectedCase.case_id, updatedMessages);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm sorry, I'm having trouble responding right now. Please check your internet connection.",
      };
      const updatedMessages = [...newMessages, errorMessage];
      setMessages(updatedMessages);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearChat = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setMessages([]);
    if (selectedCase) {
      await AsyncStorage.removeItem(`chat_${selectedCase.case_id}`);
    }
  };

  const handleGetAssessment = async () => {
    if (!selectedCase || messages.length === 0 || isAssessing) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsAssessing(true);

    try {
      // Use client-side OpenAI service
      const assessment = await getAssessment(
        messages.map((m) => ({ role: m.role, content: m.content })),
        selectedCase
      );

      navigation.navigate("Assessment", {
        assessment: assessment,
        hasCustomCriteria: false, // bundled cases don't have custom criteria currently
        patientName: selectedCase.patient_name,
        chiefComplaint: selectedCase.chief_complaint,
      });
    } catch (error) {
      console.error("Error getting assessment:", error);
    } finally {
      setIsAssessing(false);
    }
  };

  const handleSendPressIn = () => {
    sendScale.value = withSpring(0.9);
  };

  const handleSendPressOut = () => {
    sendScale.value = withSpring(1);
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.link} />
        <ThemedText style={styles.loadingText}>Loading cases...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {isDropdownOpen ? (
          <Pressable
            style={styles.backdrop}
            onPress={() => setIsDropdownOpen(false)}
          />
        ) : null}

        <View
          style={[styles.header, { paddingTop: headerHeight + Spacing.sm }]}
        >
          <CaseSelector
            cases={cases}
            selectedCase={selectedCase}
            onSelect={handleCaseSelect}
            isOpen={isDropdownOpen}
            onOpenChange={setIsDropdownOpen}
          />

          {selectedCase ? <PatientDetails caseData={selectedCase} /> : null}

          <View style={styles.actionButtons}>
            {selectedCase ? (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  navigation.navigate("VoiceMode", { caseData: selectedCase });
                }}
                style={[
                  styles.voiceModeButton,
                  { backgroundColor: theme.link },
                ]}
              >
                <Feather name="mic" size={16} color="#FFFFFF" />
                <ThemedText style={styles.voiceModeButtonText}>Voice Mode</ThemedText>
              </Pressable>
            ) : null}

            {messages.length > 0 ? (
              <Pressable
                onPress={handleGetAssessment}
                disabled={isAssessing}
                style={[
                  styles.assessButton,
                  { backgroundColor: "#10B981" },
                  isAssessing && { opacity: 0.6 },
                ]}
              >
                {isAssessing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Feather name="clipboard" size={16} color="#FFFFFF" />
                )}
                <ThemedText style={styles.assessButtonText}>
                  {isAssessing ? "Assessing..." : "Get Assessment"}
                </ThemedText>
              </Pressable>
            ) : null}

            {messages.length > 0 ? (
              <Pressable
                onPress={handleClearChat}
                style={[
                  styles.clearButton,
                  { backgroundColor: theme.backgroundDefault },
                ]}
              >
                <Feather name="trash-2" size={16} color="#EF4444" />
                <ThemedText style={styles.clearButtonText}>Clear Chat</ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages.length > 0 ? [...messages].reverse() : []}
          inverted={messages.length > 0}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          ListEmptyComponent={<EmptyState />}
          contentContainerStyle={[
            styles.messageList,
            messages.length === 0 && styles.emptyList,
          ]}
          showsVerticalScrollIndicator={false}
        />

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.backgroundRoot,
              paddingBottom: insets.bottom + Spacing.sm,
            },
          ]}
        >
          <View
            style={[
              styles.inputWrapper,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <TextInput
              style={[
                styles.input,
                { color: theme.text },
                Platform.select({ web: { outlineStyle: "none" } as any }),
              ]}
              placeholder="Type your question..."
              placeholderTextColor={theme.tabIconDefault}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              editable={!isSending && !!selectedCase}
              onKeyPress={(e) => {
                if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !(e as any).shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <AnimatedPressable
              onPress={handleSend}
              onPressIn={handleSendPressIn}
              onPressOut={handleSendPressOut}
              disabled={!inputText.trim() || isSending || !selectedCase}
              style={[
                styles.sendButton,
                {
                  backgroundColor:
                    inputText.trim() && !isSending ? theme.link : theme.tabIconDefault,
                },
                sendButtonStyle,
              ]}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="send" size={20} color="#FFFFFF" />
              )}
            </AnimatedPressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: Spacing.md,
    opacity: 0.7,
  },
  keyboardView: {
    flex: 1,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    zIndex: 1000,
  },
  caseSelectorContainer: {
    marginBottom: Spacing.sm,
    zIndex: 1000,
    position: "relative",
  },
  caseSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  caseSelectorContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: Spacing.sm,
  },
  caseSelectorText: {
    marginLeft: Spacing.sm,
    fontSize: 15,
    flex: 1,
  },
  caseDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    borderRadius: BorderRadius.md,
    zIndex: 1000,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      },
    }),
  },
  caseDropdownScroll: {
    maxHeight: 400,
  },
  caseOption: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    minHeight: 56,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  caseOptionName: {
    fontWeight: "600",
    marginBottom: 2,
  },
  caseOptionComplaint: {
    fontSize: 13,
    opacity: 0.7,
  },
  detailsContainer: {
    marginBottom: Spacing.sm,
    zIndex: 1,
  },
  detailsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  detailsHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailsHeaderText: {
    marginLeft: Spacing.sm,
    fontWeight: "500",
  },
  detailsContent: {
    padding: Spacing.md,
    marginTop: 4,
    borderRadius: BorderRadius.md,
  },
  detailRow: {
    marginBottom: Spacing.sm,
  },
  detailLabel: {
    fontSize: 13,
    opacity: 0.6,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
  },
  vitalsSection: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  vitalsTitle: {
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  vitalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  vitalItem: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    width: "48%",
  },
  vitalLabel: {
    fontSize: 10,
    opacity: 0.6,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  vitalValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  actionButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    zIndex: 1,
  },
  voiceModeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  voiceModeButtonText: {
    marginLeft: Spacing.xs,
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  assessButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  assessButtonText: {
    marginLeft: Spacing.xs,
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  clearButtonText: {
    marginLeft: Spacing.xs,
    fontSize: 13,
    color: "#EF4444",
  },
  messageList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  emptyList: {
    flex: 1,
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing["3xl"],
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  emptyText: {
    textAlign: "center",
    opacity: 0.7,
    lineHeight: 22,
  },
  messageBubble: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    maxWidth: "85%",
  },
  userBubble: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  messageIcon: {
    marginRight: 4,
  },
  messageRole: {
    fontSize: 12,
    opacity: 0.8,
    fontWeight: "500",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  inputContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.xl,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.sm,
    paddingVertical: Spacing.xs,
    minHeight: 52,
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 36,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    paddingRight: Spacing.sm,
    lineHeight: 22,
    textAlignVertical: "center",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm,
    marginBottom: 2,
  },
});
