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
import { getChatCompletion, getAssessment, transcribeAudio } from "@/lib/gemini-service";

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
      {currentAssistantTranscript && (!messages.length || messages[messages.length - 1].text !== currentAssistantTranscript) ? (
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

  const [isProcessing, setIsProcessing] = useState(false);

  // Audio Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Synthesis Ref (Restored)
  const synthesisRef = useRef<SpeechSynthesis | null>(null);

  // Setup Synthesis on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthesisRef.current = window.speechSynthesis;
    }
  }, []);

  // Constants for VAD (Voice Activity Detection)
  const SILENCE_THRESHOLD = 0.02; // Volume threshold
  const SILENCE_DURATION = 1500; // ms of silence to trigger stop

  // Visualizer Only
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);
  const micScale = useSharedValue(1); // Restored

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

  // --- WHISPER RECORDING LOGIC ---

  const startRecording = async () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Setup Audio Analysis (for silence detection + visuals)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Start MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Cancel silence timer
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) audioContextRef.current.close();

        setIsListening(false);

        // Process Audio
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size > 1000) { // arbitrary small size check
          await processUserAudio(audioBlob);
        } else {
          // Audio too short/empty
          if (isConnected) startRecording(); // Auto-restart if just a glitch? 
          // Or just wait for user. Let's wait.
        }
      };

      mediaRecorder.start();
      setIsListening(true);
      setIsSpeaking(false);

      // Start Silence Detection Loop
      checkSilence();

    } catch (e: any) {
      console.error("Error starting recording:", e);
      setError("Could not access microphone: " + e.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const checkSilence = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    const volume = average / 255; // 0 to 1

    // Visuals
    pulseScale.value = withTiming(1 + volume, { duration: 100 });
    pulseOpacity.value = withTiming(volume > 0.01 ? 0.5 : 0, { duration: 100 });

    // Silence Logic
    if (volume < SILENCE_THRESHOLD) {
      if (!silenceTimerRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          stopRecording();
        }, SILENCE_DURATION);
      }
    } else {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    }

    animationFrameRef.current = requestAnimationFrame(checkSilence);
  };

  const connectToVoiceSession = useCallback(async () => {
    if (!caseData) return;
    setIsConnecting(true);
    setSessionDuration(0);
    setError(null);
    setIsConnected(true);
    setIsConnecting(false);

    // Auto-start recording
    startRecording();

  }, [caseData]);

  const processUserAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      // 1. Transcribe (Whisper)
      const transcript = await transcribeAudio(audioBlob);

      if (!transcript || !transcript.trim()) {
        setIsProcessing(false);
        if (isConnected) startRecording(); // Restart if nothing heard
        return;
      }

      setUserTranscript(""); // Clear old live text if any

      // Add User Message
      const newMessage: VoiceMessage = { id: Date.now() + "-user", role: "user", text: transcript };
      setMessages(prev => [...prev, newMessage]);

      // 2. Chat Completion
      await processUserMessageText(transcript);

    } catch (e: any) {
      console.error("Processing error:", e);
      setError("Error processing speech: " + e.message);
      setIsProcessing(false);
      // If error is transient, maybe don't restart? Or manual restart required.
    }
  };

  // Renamed to clarify it takes text
  const processUserMessageText = async (text: string) => {
    // 1. Get AI Response
    try {
      const currentHistory = messagesRef.current;
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

      setIsProcessing(false);
      speakResponse(responseText);

    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to get response");
      setIsProcessing(false);
    }
  };

  // Keep track of active utterance
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speakResponse = (text: string) => {
    if (!synthesisRef.current) {
      setIsProcessing(false); // Release lock if no speech synth
      return;
    }

    if (synthesisRef.current.speaking) {
      synthesisRef.current.cancel();
    }

    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    activeUtteranceRef.current = utterance;

    const voices = synthesisRef.current.getVoices();
    if (caseData?.gender === "Female") {
      const femaleVoice = voices.find(v => v.name.includes("Female") || v.name.includes("Samantha"));
      if (femaleVoice) utterance.voice = femaleVoice;
    } else {
      const maleVoice = voices.find(v => v.name.includes("Male") || v.name.includes("Daniel"));
      if (maleVoice) utterance.voice = maleVoice;
    }

    utterance.onend = () => {
      setIsSpeaking(false);
      activeUtteranceRef.current = null;
      // Auto-listen again after speaking
      if (isConnected && !isProcessing) { // don't restart if weird state
        startRecording();
      }
    };

    utterance.onerror = (e) => {
      console.error("Speech synthesis error", e);
      // Auto-listen again after speaking
      if (isConnected && !isProcessing) { // don't restart if weird state
        startRecording();
      }
    };

    synthesisRef.current.speak(utterance);
  };

  const disconnectVoiceSession = useCallback(() => {
    stopRecording();
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
      synthesisRef.current = null;
    }
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
  }, []);



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

      navigation.navigate("Assessment", {
        assessment: assessmentText,
        hasCustomCriteria: false,
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
              {/* Pulse using the actual volume now */}
              <Animated.View
                style={[
                  styles.pulse,
                  {
                    backgroundColor: theme.link,
                    opacity: 0.3,
                  },
                  isListening ? {
                    transform: [{ scale: pulseScale }],
                    opacity: pulseOpacity
                  } : {}
                ]}
              />

              <AnimatedPressable
                onPress={() => {
                  // Manual Stop / Tap to talk toggle logic?
                  // For now, tap to disconnect or maybe tap to FORCE Stop recording?
                  // Let's make it toggle record/stop manually if VAD is annoying?
                  // Current logic: handleMicPress calls disconnect.
                  handleMicPress();
                }}
                disabled={isConnecting || isProcessing}
                style={[
                  styles.micButton,
                  {
                    backgroundColor: isConnecting || isProcessing
                      ? theme.tabIconDefault
                      : theme.link,
                  },
                  micButtonStyle,
                ]}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Feather
                    name="mic"
                    size={24}
                    color="#FFFFFF"
                  />
                )}
              </AnimatedPressable>
            </View>
          )}

          <ThemedText style={styles.statusText}>
            {isConnecting
              ? "Connecting..."
              : isConnected
                ? isProcessing
                  ? "Thinking..."
                  : isListening
                    ? "Listening..."
                    : isSpeaking
                      ? "Patient Speaking..."
                      : "Paused"
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
