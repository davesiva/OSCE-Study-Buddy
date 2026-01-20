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
import { getApiUrl, apiRequest } from "@/lib/query-client";

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

  const connectToVoiceSession = useCallback(async () => {
    if (!caseData) {
      setError("No case data available");
      return;
    }

    if (Platform.OS !== "web") {
      Alert.alert(
        "Voice Mode",
        "Voice mode is currently only available on web. Please use the web version of the app for voice conversations.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
      return;
    }

    setIsConnecting(true);
    setSessionDuration(0); // Reset timer on new session
    setError(null);

    try {
      // Smart Permission Check
      if (Platform.OS === 'web' && navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          if (permissionStatus.state === 'denied') {
            setError("Browser blocked microphone. Please click the lock icon in your address bar to Allow.");
            setIsConnecting(false);
            return;
          }
        } catch (e) {
          // Ignore if browser doesn't support query name 'microphone'
          console.log("Permission query skipped:", e);
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 24000 });
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const baseUrl = getApiUrl().replace(/\/$/, "");
      const wsUrl = baseUrl.replace(/^http/, "ws") + "/api/realtime";
      console.log("Connecting to WebSocket:", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected, configuring session...");
        ws.send(JSON.stringify({
          type: "session.configure",
          caseData: caseData,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case "session.ready":
              console.log("Session ready");
              setIsConnected(true);
              setIsConnecting(false);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

              source.connect(processor);
              const mutedGain = audioContext.createGain();
              mutedGain.gain.value = 0;
              mutedGain.connect(audioContext.destination);
              processor.connect(mutedGain);

              processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);

                // Calculate volume (RMS) for pulse animation
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  let sum = 0;
                  for (let i = 0; i < inputData.length; i++) {
                    sum += inputData[i] * inputData[i];
                  }
                  const rms = Math.sqrt(sum / inputData.length);
                  // Map RMS (0-1 usually small) to scale factor (1.0 - 1.5)
                  // Adjust sensitivity factor (e.g. 5) as needed
                  const sensitivity = 5;
                  audioVolume.value = 1 + Math.min(rms * sensitivity, 0.5);
                } else {
                  audioVolume.value = withSpring(1);
                }

                const pcmData = floatTo16BitPCM(inputData);
                const base64Audio = arrayBufferToBase64(pcmData.buffer);

                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(
                    JSON.stringify({
                      type: "audio.append",
                      audio: base64Audio,
                    })
                  );
                }
              };
              break;

            case "speech.started":
              setIsListening(true);
              setUserTranscript("");
              break;

            case "speech.stopped":
              setIsListening(false);
              break;

            case "transcript.done":
              if (message.role === "user" && message.transcript) {
                setMessages(prev => [...prev, {
                  id: Date.now().toString() + "-user",
                  role: "user",
                  text: message.transcript,
                }]);
                setUserTranscript("");
              } else if (message.role === "assistant" && message.transcript) {
                setMessages(prev => [...prev, {
                  id: Date.now().toString() + "-assistant",
                  role: "assistant",
                  text: message.transcript,
                }]);
                setAssistantTranscript("");
              }
              break;

            case "transcript.delta":
              if (message.role === "assistant") {
                setAssistantTranscript((prev) => prev + (message.delta || ""));
              }
              break;

            case "audio.delta":
              setIsSpeaking(true);
              playAudioChunk(message.delta);
              break;

            case "audio.done":
              setIsSpeaking(false);
              break;

            case "response.done":
              setIsSpeaking(false);
              break;

            case "error":
              console.error("Voice error:", message.message);
              setError(message.message);
              break;

            case "session.closed":
              setIsConnected(false);
              break;
          }
        } catch (e) {
          console.error("Error parsing message:", e);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setError("Connection error. Please try again.");
        setIsConnecting(false);
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
        setIsConnected(false);
        setIsConnecting(false);
      };

    } catch (err) {
      if (err instanceof Error) {
        console.error("Microphone access error details:", err.name, err.message);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError("Microphone permission denied. Please allow access in settings.");
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError("No microphone found. Please check your device.");
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError("Microphone is busy or not readable. Close other apps using it.");
        } else {
          setError(`Microphone error: ${err.message}`);
        }
      } else {
        setError("Failed to access microphone. Please check permissions.");
      }
      setIsConnecting(false);
    }
  }, [caseData, navigation, audioVolume]);

  const disconnectVoiceSession = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    nextPlayTimeRef.current = 0;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
    } catch (e) {
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

  const handleGetAssessment = async () => {
    if (!caseData || messages.length === 0 || isAssessing) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsAssessing(true);

    try {
      const response = await apiRequest("POST", "/api/assess", {
        messages: messages.map((m) => ({ role: m.role, content: m.text })),
        caseData: caseData,
      });

      const data = await response.json();

      if (data.success) {
        navigation.navigate("Assessment", {
          assessment: data.assessment,
          hasCustomCriteria: data.hasCustomCriteria,
          patientName: caseData.patient_name,
          chiefComplaint: caseData.chief_complaint,
        });
      }
    } catch (error) {
      console.error("Error getting assessment:", error);
      setError("Failed to get assessment. Please try again.");
    } finally {
      setIsAssessing(false);
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
