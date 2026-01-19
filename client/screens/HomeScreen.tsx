import React from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface NavButtonProps {
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  color: string;
}

function NavButton({ title, subtitle, icon, onPress, color }: NavButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.navButton, { backgroundColor: color }, animatedStyle]}
    >
      <View style={styles.navButtonIcon}>
        <Feather name={icon} size={28} color="#FFFFFF" />
      </View>
      <View style={styles.navButtonContent}>
        <ThemedText style={styles.navButtonTitle}>{title}</ThemedText>
        <ThemedText style={styles.navButtonSubtitle}>{subtitle}</ThemedText>
      </View>
      <Feather name="chevron-right" size={24} color="rgba(255,255,255,0.7)" />
    </AnimatedPressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing["2xl"],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.welcomeCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h3" style={styles.welcomeTitle}>
            Welcome, Future Doctor!
          </ThemedText>
          <ThemedText style={styles.welcomeText}>
            Practice your clinical skills with AI-powered patient simulations.
            Perfect for OSCE preparation and history-taking practice.
          </ThemedText>
        </View>

        <ThemedText type="h4" style={styles.sectionTitle}>
          Quick Actions
        </ThemedText>

        <View style={styles.navButtons}>
          <NavButton
            title="Start OSCE Practice"
            subtitle="Chat with AI patients"
            icon="activity"
            color="#0066CC"
            onPress={() => navigation.navigate("OSCESimulator")}
          />

          <NavButton
            title="Create Custom Case"
            subtitle="Add your own patient scenarios"
            icon="plus-circle"
            color="#8B5CF6"
            onPress={() => navigation.navigate("CreateCase")}
          />

          <NavButton
            title="Submit Feedback"
            subtitle="Help us improve"
            icon="message-circle"
            color="#10B981"
            onPress={() => navigation.navigate("Feedback")}
          />
        </View>

        <ThemedText type="h4" style={styles.sectionTitle}>
          About This App
        </ThemedText>

        <View style={[styles.infoCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: "#0066CC20" }]}>
              <Feather name="users" size={20} color="#0066CC" />
            </View>
            <View style={styles.infoContent}>
              <ThemedText style={styles.infoTitle}>OSCE Simulator</ThemedText>
              <ThemedText style={styles.infoText}>
                Practice taking patient histories with AI patients
              </ThemedText>
            </View>
          </View>

          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: "#F59E0B20" }]}>
              <Feather name="zap" size={20} color="#F59E0B" />
            </View>
            <View style={styles.infoContent}>
              <ThemedText style={styles.infoTitle}>Instant Feedback</ThemedText>
              <ThemedText style={styles.infoText}>
                Chat with patients in real-time
              </ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  welcomeCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing["2xl"],
  },
  welcomeTitle: {
    marginBottom: Spacing.sm,
  },
  welcomeText: {
    opacity: 0.7,
    lineHeight: 22,
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  navButtons: {
    gap: Spacing.md,
    marginBottom: Spacing["2xl"],
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    minHeight: 80,
  },
  navButtonIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.lg,
  },
  navButtonContent: {
    flex: 1,
  },
  navButtonTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  navButtonSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },
  infoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.lg,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontWeight: "600",
    marginBottom: 2,
  },
  infoText: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
  },
});
