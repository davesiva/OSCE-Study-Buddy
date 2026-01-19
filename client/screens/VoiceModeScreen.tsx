import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
} from "react-native";
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
import { getApiUrl } from "@/lib/query-client";

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
  singlish_level: string;
  expected_diagnosis: string;
}

type VoiceModeScreenProps = NativeStackScreenProps<RootStackParamList, "VoiceMode">;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function AudioVisualizer({ isActive, isSpeaking }: { isActive: boolean; isSpeaking: boolean }) {
  const { theme } = useTheme();
  const bars = [
    useSharedValue(0.3),
    useSharedValue(0.5),
    useSharedValue(0.4),
    useSharedValue(0.6),
    useSharedValue(0.3),
  ];

  useEffect(() => {
    if (isActive || isSpeaking) {
      bars.forEach((bar, index) => {
        bar.value = withRepeat(
          withSequence(
            withTiming(0.2 + Math.random() * 0.8, {
              duration: 150 + index * 50,
              easing: Easing.inOut(Easing.ease),
            }),
            withTiming(0.1 + Math.random() * 0.5, {
              duration: 150 + index * 50,
              easing: Easing.inOut(Easing.ease),
            })
          ),
          -1,
          true
        );
      });
    } else {
      bars.forEach((bar) => {
        cancelAnimation(bar);
        bar.value = withTiming(0.15, { duration: 300 });
      });
    }
  }, [isActive, isSpeaking]);

  const barStyles = bars.map((bar, index) =>
    useAnimatedStyle(() => ({
      height: interpolate(bar.value, [0, 1], [8, 60]),
      backgroundColor: isSpeaking ? theme.link : (isActive ? "#22C55E" : theme.tabIconDefault),
    }))
  );

  return (
    <View style={styles.visualizerContainer}>
      {barStyles.map((style, index) => (
        <Animated.View
          key={index}
          style={[styles.visualizerBar, style]}
        />
      ))}
    </View>
  );
}

function PatientAvatar({ caseData, isSpeaking }: { caseData: CaseData | null; isSpeaking: boolean }) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (isSpeaking) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 500 }),
          withTiming(0.2, { duration: 500 })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(scale);
      cancelAnimation(glowOpacity);
      scale.value = withTiming(1, { duration: 200 });
      glowOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isSpeaking]);

  const avatarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={styles.avatarContainer}>
      <Animated.View style={[styles.avatarGlow, { backgroundColor: theme.link }, glowStyle]} />
      <Animated.View
        style={[
          styles.avatar,
          { backgroundColor: theme.backgroundDefault },
          avatarStyle,
        ]}
      >
        <Feather name="user" size={64} color={theme.link} />
      </Animated.View>
      {caseData ? (
        <View style={styles.patientInfo}>
          <ThemedText type="h4" style={styles.patientName}>
            {caseData.patient_name}
          </ThemedText>
          <ThemedText style={styles.patientDetails}>
            {caseData.age} years old, {caseData.gender}
          </ThemedText>
          <ThemedText style={styles.complaint} numberOfLines={2}>
            {caseData.chief_complaint}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

function TranscriptDisplay({ 
  userTranscript, 
  assistantTranscript,
  isListening,
}: { 
  userTranscript: string; 
  assistantTranscript: string;
  isListening: boolean;
}) {
  const { theme } = useTheme();

  return (
    <View style={styles.transcriptContainer}>
      {userTranscript ? (
        <View style={[styles.transcriptBubble, styles.userTranscript, { backgroundColor: theme.link }]}>
          <ThemedText style={[styles.transcriptLabel, { color: "rgba(255,255,255,0.7)" }]}>
            You said:
          </ThemedText>
          <ThemedText style={[styles.transcriptText, { color: "#FFFFFF" }]}>
            {userTranscript}
          </ThemedText>
        </View>
      ) : null}
      {assistantTranscript ? (
        <View style={[styles.transcriptBubble, styles.assistantTranscript, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={[styles.transcriptLabel, { opacity: 0.7 }]}>
            Patient:
          </ThemedText>
          <ThemedText style={styles.transcriptText}>
            {assistantTranscript}
          </ThemedText>
        </View>
      ) : null}
      {isListening && !userTranscript ? (
        <View style={[styles.listeningIndicator, { backgroundColor: theme.backgroundDefault }]}>
          <View style={[styles.listeningDot, { backgroundColor: "#22C55E" }]} />
          <ThemedText style={styles.listeningText}>Listening...</ThemedText>
        </View>
      ) : null}
    </View>
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
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);

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
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 24000 });
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
              processor.connect(audioContext.destination);

              processor.onaudioprocess = (e) => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  const inputData = e.inputBuffer.getChannelData(0);
                  const pcm16 = floatTo16BitPCM(inputData);
                  const base64 = arrayBufferToBase64(pcm16.buffer);
                  wsRef.current.send(JSON.stringify({
                    type: "audio.append",
                    audio: base64,
                  }));
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
              if (message.role === "user") {
                setUserTranscript(message.transcript || "");
              } else {
                setAssistantTranscript(message.transcript || "");
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
      console.error("Error connecting:", err);
      setError("Failed to access microphone. Please grant permission and try again.");
      setIsConnecting(false);
    }
  }, [caseData, navigation]);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const playAudioChunk = useCallback((base64Audio: string) => {
    if (!audioContextRef.current) return;

    try {
      const audioData = base64ToArrayBuffer(base64Audio);
      const float32 = pcm16ToFloat32(new Int16Array(audioData));

      const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32 as unknown as Float32Array<ArrayBuffer>, 0);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();
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

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.content, { paddingTop: headerHeight + Spacing.xl }]}>
        <PatientAvatar caseData={caseData || null} isSpeaking={isSpeaking} />

        <AudioVisualizer isActive={isListening} isSpeaking={isSpeaking} />

        <TranscriptDisplay
          userTranscript={userTranscript}
          assistantTranscript={assistantTranscript}
          isListening={isListening}
        />

        {error ? (
          <View style={[styles.errorContainer, { backgroundColor: "rgba(239,68,68,0.1)" }]}>
            <Feather name="alert-circle" size={20} color="#EF4444" />
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        ) : null}

        <View style={[styles.controlsContainer, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <View style={styles.micButtonContainer}>
            <Animated.View
              style={[
                styles.pulse,
                { backgroundColor: isConnected ? "#22C55E" : theme.link },
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
                    : isConnected
                    ? "#22C55E"
                    : theme.link,
                },
                micButtonStyle,
              ]}
            >
              <Feather
                name={isConnected ? "mic" : "mic-off"}
                size={40}
                color="#FFFFFF"
              />
            </AnimatedPressable>
          </View>

          <ThemedText style={styles.statusText}>
            {isConnecting
              ? "Connecting..."
              : isConnected
              ? isListening
                ? "Listening to you..."
                : isSpeaking
                ? "Patient is speaking..."
                : "Tap to end call"
              : "Tap to start voice call"}
          </ThemedText>

          {isConnected ? (
            <Pressable
              onPress={disconnectVoiceSession}
              style={[styles.endCallButton, { backgroundColor: "#EF4444" }]}
            >
              <Feather name="phone-off" size={24} color="#FFFFFF" />
              <ThemedText style={styles.endCallText}>End Call</ThemedText>
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
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  avatarContainer: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  avatarGlow: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  patientInfo: {
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  patientName: {
    textAlign: "center",
  },
  patientDetails: {
    opacity: 0.7,
    marginTop: Spacing.xs,
  },
  complaint: {
    opacity: 0.6,
    marginTop: Spacing.sm,
    textAlign: "center",
    fontSize: 14,
  },
  visualizerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 80,
    gap: 8,
    marginBottom: Spacing.xl,
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
  },
  errorText: {
    marginLeft: Spacing.sm,
    color: "#EF4444",
    flex: 1,
  },
  controlsContainer: {
    alignItems: "center",
    paddingTop: Spacing.xl,
  },
  micButtonContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  micButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
});
