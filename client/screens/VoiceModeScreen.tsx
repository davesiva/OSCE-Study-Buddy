import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";

interface VoiceMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  cancelAnimation,
  interpolate,
  Easing,
} from "react-native-reanimated";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
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

type VoiceModeScreenProps = NativeStackScreenProps<RootStackParamList, "VoiceMode">;

// ... (previous code)

const processUserMessage = async (text: string) => {
  // Stop listening while thinking/speaking
  setIsListening(false);

  // 1. Get AI Response
  try {
    // Combine existing messages with the new user input
    const conversationHistory = messages.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.text
    }));
    conversationHistory.push({ role: "user", content: text });

    const responseText = await getChatCompletion(
      conversationHistory,
      caseData!
    );

    setMessages(prev => [...prev, { id: Date.now() + "-ai", role: "assistant", text: responseText }]);
    setAssistantTranscript(responseText);

    // 2. Speak Response
    speakResponse(responseText);

  } catch (e) {
    console.error(e);
    setError("Failed to get response");
  }
};

// ... (previous code)

const handleGetAssessment = async () => {
  if (!caseData || messages.length === 0 || isAssessing) return;

  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  setIsAssessing(true);

  try {
    // Use client-side assessment service
    const assessmentText = await getAssessment(
      messages.map((m) => ({ role: m.role, content: m.text })),
      caseData
    );

    // Parse or simply display the text? The previous API returned JSON object { assessment, hasCustomCriteria }.
    // The new getAssessment returns a STRING markdown.
    // We need to adapt the Assessment screen or just show it.
    // Assuming Assessment screen can take raw text or we wrap it.

    // Let's assume we pass the raw string as 'assessment'
    navigation.navigate("Assessment", {
      assessment: assessmentText,
      hasCustomCriteria: false, // The new prompt handles it in text
      patientName: caseData.patient_name,
      chiefComplaint: caseData.chief_complaint,
    });

  } catch (error) {
    console.error("Error getting assessment:", error);
    setError("Failed to get assessment. Please try again.");
  } finally {
    setIsAssessing(false);
  }
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);


function PatientAvatar({
  caseData,
  isSpeaking,
}: {
  caseData: CaseData | null;
  isSpeaking: boolean;
}) {
  const { theme } = useTheme();
  // Animation for the avatar glow
  const glowStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isSpeaking ? 0.5 : 0, { duration: 300 }),
      transform: [{ scale: withTiming(isSpeaking ? 1.2 : 1, { duration: 300 }) }],
    };
  });

  return (
    <View style={styles.avatarContainer}>
      <Animated.View
        style={[
          styles.avatar,
          { backgroundColor: theme.backgroundDefault },
          glowStyle,
        ]}
      >
        <Feather name="user" size={20} color={theme.link} />
      </Animated.View>
      {caseData ? (
        <View style={styles.patientInfo}>
          <View style={styles.patientHeaderRow}>
            <ThemedText style={styles.patientName}>{caseData.patient_name}</ThemedText>
            <ThemedText style={styles.patientDetails}>
              • {caseData.age} {caseData.gender === "Male" ? "M" : "F"}
            </ThemedText>
          </View>
          <ThemedText style={styles.complaint} numberOfLines={1}>
            {caseData.chief_complaint}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}


function TranscriptDisplay({
  messages,
  currentUserTranscript,
  currentAssistantTranscript,
  isListening,
}: {
  messages: VoiceMessage[];
  currentUserTranscript: string;
  currentAssistantTranscript: string;
  isListening: boolean;
}) {
  const { theme } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, currentUserTranscript, currentAssistantTranscript]);

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.transcriptContainer}
      contentContainerStyle={styles.transcriptContent}
      showsVerticalScrollIndicator={false}
    >
      {messages.map((message) => (
        <View
          key={message.id}
          style={[
            styles.transcriptBubble,
            message.role === "user" ? styles.userTranscript : styles.assistantTranscript,
            { backgroundColor: message.role === "user" ? theme.link : theme.backgroundDefault }
          ]}
        >
          <ThemedText style={[
            styles.transcriptLabel,
            message.role === "user" ? { color: "rgba(255,255,255,0.7)" } : { opacity: 0.7 }
          ]}>
            {message.role === "user" ? "You:" : "Patient:"}
          </ThemedText>
          <ThemedText style={[
            styles.transcriptText,
            message.role === "user" ? { color: "#FFFFFF" } : {}
          ]}>
            {message.text}
          </ThemedText>
        </View>
      ))}
      {currentUserTranscript ? (
        <View style={[styles.transcriptBubble, styles.userTranscript, { backgroundColor: theme.link }]}>
          <ThemedText style={[styles.transcriptLabel, { color: "rgba(255,255,255,0.7)" }]}>
            You:
          </ThemedText>
          <ThemedText style={[styles.transcriptText, { color: "#FFFFFF" }]}>
            {currentUserTranscript}
          </ThemedText>
        </View>
      ) : null}
      {currentAssistantTranscript ? (
        <View style={[styles.transcriptBubble, styles.assistantTranscript, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={[styles.transcriptLabel, { opacity: 0.7 }]}>
            Patient:
          </ThemedText>
          <ThemedText style={styles.transcriptText}>
            {currentAssistantTranscript}
          </ThemedText>
        </View>
      ) : null}
      {isListening && !currentUserTranscript ? (
        <View style={[styles.listeningIndicator, { backgroundColor: theme.backgroundDefault }]}>
          <View style={[styles.listeningDot, { backgroundColor: "#22C55E" }]} />
          <ThemedText style={styles.listeningText}>Listening...</ThemedText>
        </View>
      ) : null}
    </ScrollView>
  );
}

export default function VoiceModeScreen({ route, navigation }: VoiceModeScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  const caseData = route.params?.caseData as CaseData | undefined;

  const [isConnecting, setIsConnecting] = useState(false);
  const audioVolume = useSharedValue(1); // 1 = 100% scale (base)
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userTranscript, setUserTranscript] = useState("");
  const [assistantTranscript, setAssistantTranscript] = useState("");
  const [sessionDuration, setSessionDuration] = useState(0);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isConnected) {
      interval = setInterval(() => {
        setSessionDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isConnected]);

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSystemMessage = (text: string, type: "error" | "info" = "info") => ({
    id: Date.now().toString() + "-system-" + type,
    role: "assistant", // System messages appear as assistant messages
    text: text,
    isSystem: true,
    type: type,
  });

  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAssessing, setIsAssessing] = useState(false);

  const messagesRef = useRef<VoiceMessage[]>([]);

  // Update ref whenever messages change
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);

  const micScale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);

  const micButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  useEffect(() => {
    if (isListening) {
      pulseScale.value = withRepeat(
        withTiming(1.5, { duration: 1000 }),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 0 }),
          withTiming(0, { duration: 1000 })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseScale.value = 1;
      pulseOpacity.value = 0;
    }
  }, [isListening]);

  // --- CLIENT-SIDE VOICE LOGIC (Web Speech API) ---
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);

  const connectToVoiceSession = useCallback(async () => {
    if (!caseData) return;

    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Your browser does not support Voice Recognition. Try Chrome or Edge.");
      return;
    }

    setIsConnecting(true);
    setSessionDuration(0);
    setError(null);

    try {
      // Setup Recognition
      const recognition = new SpeechRecognition();
      recognition.continuous = false; // We want turn-based
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setIsSpeaking(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        // If we are still connected and not speaking, maybe listen again? 
        // For a simple prototype, we wait for user to press mic again or auto-restart?
        // Let's keep it manual push-to-talk style for stability, or auto for flow.
        // Let's do: if "isConnected" is true, wait a bit then start listening again 
        // UNLESS we are processing a response.
      };

      recognition.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          // Clear the "live" transcript since we are about to add it to the committed messages
          setUserTranscript("");

          const newMessage: VoiceMessage = { id: Date.now() + "-user", role: "user", text: transcript };
          setMessages(prev => [...prev, newMessage]);

          // Use the internal function which now uses the ref, OR pas the new list manually?
          // To be safe, let's call a version of processUserMessage that takes the text
          await processUserMessage(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech error", event.error);
        if (event.error !== 'no-speech') {
          // setError(event.error);
        }
      };

      recognitionRef.current = recognition;

      // Setup Synthesis
      synthesisRef.current = window.speechSynthesis;

      // "Connect" just means ready state here
      setIsConnected(true);
      setIsConnecting(false);
      recognition.start(); // Start listening immediately

    } catch (e: any) {
      setError(e.message);
      setIsConnecting(false);
    }
  }, [caseData]);

  const processUserMessage = async (text: string) => {
    // Stop listening while thinking/speaking
    setIsListening(false);

    // 1. Get AI Response
    try {
      // Use the ref to ensure we have the latest messages, including the one we just added (or about to add? state update might be async)
      // Actually, since we just called setMessages in onresult, the Ref might NOT be updated yet!
      // SAFE BET: Append the new user message to the CURRENT ref value manually for the API call.
      const currentHistory = messagesRef.current;
      // We also need to include the NEW message 'text' which might not be in the ref yet if setMessages hasn't flushed.

      const fullHistory = [
        ...currentHistory,
        { role: "user", text: text } as VoiceMessage
      ].map(m => ({ role: m.role as "user" | "assistant", content: m.text }));

      const responseText = await getChatCompletion(
        fullHistory,
        caseData!
      );

      setMessages(prev => [...prev, { id: Date.now() + "-ai", role: "assistant", text: responseText }]);
      setAssistantTranscript(responseText);

      // 2. Speak Response
      speakResponse(responseText);

    } catch (e: any) {
      console.error(e);
      // Show exact error from OpenAI
      setError(e.message || "Failed to get response");
    }
  };

  const speakResponse = (text: string) => {
    if (!synthesisRef.current) return;

    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);

    // Pick a voice if possible (Female for female patients, etc)
    const voices = synthesisRef.current.getVoices();
    // Simple heuristic
    if (caseData?.gender === "Female") {
      const femaleVoice = voices.find(v => v.name.includes("Female") || v.name.includes("Samantha"));
      if (femaleVoice) utterance.voice = femaleVoice;
    } else {
      const maleVoice = voices.find(v => v.name.includes("Male") || v.name.includes("Daniel"));
      if (maleVoice) utterance.voice = maleVoice;
    }

    utterance.onend = () => {
      setIsSpeaking(false);
      // Auto-listen again after speaking
      if (isConnected && recognitionRef.current) {
        try { recognitionRef.current.start(); } catch { }
      }
    };

    synthesisRef.current.speak(utterance);
  };

  const disconnectVoiceSession = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
      synthesisRef.current = null;
    }
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
  }, []);

  const playAudioChunk = useCallback((base64Audio: string) => {
    if (!audioContextRef.current) return;

    try {
      const audioData = base64ToArrayBuffer(base64Audio);
      const float32 = pcm16ToFloat32(new Int16Array(audioData));

      const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32 as any, 0);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      const currentTime = audioContextRef.current.currentTime;
      const startTime = Math.max(currentTime, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;
    } catch (e: any) {
      console.error("Error playing audio:", e);
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnectVoiceSession();
    };
  }, [disconnectVoiceSession]);

  const handleMicPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    micScale.value = withSpring(0.9);
    setTimeout(() => {
      micScale.value = withSpring(1);
    }, 100);

    if (isConnected) {
      disconnectVoiceSession();
    } else {
      connectToVoiceSession();
    }
  };


  const audioPulseStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: withSpring(audioVolume.value) }],
    };
  });

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.content, { paddingTop: headerHeight + Spacing.sm }]}>
        <View style={styles.headerBar}>
          <PatientAvatar caseData={caseData || null} isSpeaking={isSpeaking} />
          <View style={styles.timerContainer}>
            <Feather name="clock" size={14} color={isConnected ? theme.link : theme.tabIconDefault} style={{ marginRight: 4 }} />
            <ThemedText style={[styles.timerText, { color: isConnected ? theme.link : theme.tabIconDefault }]}>
              {formatTime(sessionDuration)}
            </ThemedText>
          </View>
        </View>

        <View style={{ flex: 1, width: "100%" }}>
          <TranscriptDisplay
            messages={messages}
            currentUserTranscript={userTranscript}
            currentAssistantTranscript={assistantTranscript}
            isListening={isListening}
          />
        </View>

        {error ? (
          <View style={[styles.errorContainer, { backgroundColor: "rgba(239,68,68,0.1)" }]}>
            <Feather name="alert-circle" size={20} color="#EF4444" />
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        ) : null}

        <View style={[styles.controlsContainer, { paddingBottom: insets.bottom + Spacing.xl }]}>
          {!isConnected ? (
            <View style={styles.micButtonContainer}>
              <Animated.View
                style={[
                  styles.pulse,
                  { backgroundColor: theme.link },
                  pulseStyle,
                ]}
              />
              <AnimatedPressable
                onPress={handleMicPress}
                disabled={isConnecting}
                style={[
                  styles.micButton,
                  {
                    backgroundColor: isConnecting
                      ? theme.tabIconDefault
                      : theme.link,
                  },
                  micButtonStyle,
                ]}
              >
                <Feather
                  name="mic-off"
                  size={24}
                  color="#FFFFFF"
                />
              </AnimatedPressable>
            </View>
          ) : (
            <View style={styles.micButtonContainer}>
              {isListening && !isConnecting && (
                <Animated.View
                  style={[
                    styles.pulse,
                    {
                      backgroundColor: isSpeaking ? theme.link : theme.link,
                      opacity: 0.3,
                    },
                    audioPulseStyle,
                  ]}
                />
              )}
              <AnimatedPressable
                onPress={handleMicPress}
                disabled={isConnecting}
                style={[
                  styles.micButton,
                  {
                    backgroundColor: isConnecting
                      ? theme.tabIconDefault
                      : theme.link,
                  },
                  micButtonStyle,
                ]}
              >
                <Feather
                  name="mic"
                  size={24}
                  color="#FFFFFF"
                />
              </AnimatedPressable>
            </View>
          )}

          <ThemedText style={styles.statusText}>
            {isConnecting
              ? "Connecting..."
              : isConnected
                ? isListening
                  ? "Listening to you..."
                  : isSpeaking
                    ? "Patient is speaking..."
                    : "Session active"
                : "Tap to Start"}
          </ThemedText>

          {isConnected ? (
            <Pressable
              onPress={disconnectVoiceSession}
              style={[styles.endCallButton, { backgroundColor: "#EF4444" }]}
            >
              <Feather name="x" size={24} color="#FFFFFF" />
              <ThemedText style={styles.endCallText}>End</ThemedText>
            </Pressable>
          ) : null}

          {!isConnected && messages.length > 0 ? (
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
                <Feather name="clipboard" size={20} color="#FFFFFF" />
              )}
              <ThemedText style={styles.assessButtonText}>
                {isAssessing ? "Assessing..." : "Get Assessment"}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </ThemedView>
  );
}

function floatTo16BitPCM(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16Array;
}

function pcm16ToFloat32(int16Array: Int16Array): Float32Array {
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 0x8000;
  }
  return float32Array;
}

function arrayBufferToBase64(buffer: ArrayBuffer | SharedArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.03)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  timerText: {
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    fontWeight: "500",
  },
  avatarContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  patientInfo: {
    justifyContent: "center",
    flex: 1,
  },
  patientHeaderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
  },
  patientName: {
    fontSize: 15,
    fontWeight: "600",
    marginRight: 6,
  },
  patientDetails: {
    fontSize: 13,
    opacity: 0.7,
  },
  complaint: {
    opacity: 0.6,
    fontSize: 12,
    marginTop: 0,
  },
  visualizerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    gap: 4,
    marginBottom: Spacing.md,
    alignSelf: "center",
  },
  visualizerBar: {
    width: 8,
    borderRadius: 4,
  },
  transcriptContainer: {
    flex: 1,
    width: "100%",
    paddingHorizontal: Spacing.md,
  },
  transcriptContent: {
    flexGrow: 1,
    paddingBottom: Spacing.md,
  },
  transcriptBubble: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    maxWidth: "90%",
  },
  userTranscript: {
    alignSelf: "flex-end",
  },
  assistantTranscript: {
    alignSelf: "flex-start",
  },
  transcriptLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  transcriptText: {
    fontSize: 15,
    lineHeight: 22,
  },
  listeningIndicator: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  listeningText: {
    fontSize: 14,
    opacity: 0.7,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    alignSelf: "center",
    width: "100%",
  },
  errorText: {
    marginLeft: Spacing.sm,
    color: "#EF4444",
    flex: 1,
  },
  controlsContainer: {
    alignItems: "center",
    paddingTop: Spacing.md,
    width: "100%",
  },
  micButtonContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  micButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    marginTop: Spacing.lg,
    fontSize: 16,
    opacity: 0.8,
  },
  endCallButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  endCallText: {
    color: "#FFFFFF",
    marginLeft: Spacing.sm,
    fontWeight: "600",
  },
  assessButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  assessButtonText: {
    color: "#FFFFFF",
    marginLeft: Spacing.sm,
    fontWeight: "600",
  },
});
