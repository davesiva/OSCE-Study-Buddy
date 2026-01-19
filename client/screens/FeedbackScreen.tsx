import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const RATINGS = ["Very Poor", "Poor", "Average", "Good", "Excellent"];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function RatingSelector({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (rating: string) => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={styles.ratingContainer}>
      {RATINGS.map((rating) => {
        const isSelected = selected === rating;
        return (
          <Pressable
            key={rating}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(rating);
            }}
            style={[
              styles.ratingButton,
              {
                backgroundColor: isSelected
                  ? theme.link
                  : theme.backgroundDefault,
                borderColor: isSelected ? theme.link : "transparent",
              },
            ]}
          >
            <ThemedText
              style={[
                styles.ratingText,
                { color: isSelected ? "#FFFFFF" : theme.text },
              ]}
            >
              {rating}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function SuccessView({ onReset }: { onReset: () => void }) {
  const { theme } = useTheme();
  const navigation = useNavigation();

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.successView}>
      <View
        style={[styles.successIcon, { backgroundColor: theme.backgroundDefault }]}
      >
        <Feather name="check-circle" size={64} color="#10B981" />
      </View>

      <ThemedText type="h3" style={styles.successTitle}>
        Thank You!
      </ThemedText>

      <ThemedText style={styles.successText}>
        Your feedback has been submitted successfully. We appreciate your input
        and will use it to improve the app.
      </ThemedText>

      <View style={styles.successButtons}>
        <Button onPress={onReset} style={styles.successButton}>
          Submit Another Response
        </Button>

        <Pressable
          onPress={() => navigation.goBack()}
          style={[
            styles.backButton,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <ThemedText style={styles.backButtonText}>Back to Home</ThemedText>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default function FeedbackScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  const [rating, setRating] = useState("Good");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");

  const buttonScale = useSharedValue(1);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleSubmit = async () => {
    if (!feedback.trim()) {
      setError("Please enter your feedback before submitting.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await apiRequest("POST", "/api/feedback", {
        feedback: feedback.trim(),
        rating,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsSubmitted(true);
    } catch (err) {
      console.error("Error submitting feedback:", err);
      setError("Failed to submit feedback. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFeedback("");
    setRating("Good");
    setIsSubmitted(false);
    setError("");
  };

  const handleButtonPressIn = () => {
    buttonScale.value = withSpring(0.97);
  };

  const handleButtonPressOut = () => {
    buttonScale.value = withSpring(1);
  };

  if (isSubmitted) {
    return (
      <ThemedView style={styles.container}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: headerHeight + Spacing.xl,
              paddingBottom: insets.bottom + Spacing.xl,
            },
          ]}
        >
          <SuccessView onReset={handleReset} />
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[styles.formCard, { backgroundColor: theme.backgroundDefault }]}
        >
          <View style={styles.formSection}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              How would you rate your experience?
            </ThemedText>
            <RatingSelector selected={rating} onSelect={setRating} />
          </View>

          <View style={styles.formSection}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Share your thoughts
            </ThemedText>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                },
              ]}
              placeholder="What did you like? What could be improved? Any suggestions for new cases?"
              placeholderTextColor={theme.tabIconDefault}
              value={feedback}
              onChangeText={(text) => {
                setFeedback(text);
                if (error) setError("");
              }}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={16} color="#EF4444" />
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          ) : null}

          <AnimatedPressable
            onPress={handleSubmit}
            onPressIn={handleButtonPressIn}
            onPressOut={handleButtonPressOut}
            disabled={isSubmitting}
            style={[
              styles.submitButton,
              { backgroundColor: theme.link, opacity: isSubmitting ? 0.7 : 1 },
              buttonStyle,
            ]}
          >
            {isSubmitting ? (
              <ThemedText style={styles.submitButtonText}>
                Submitting...
              </ThemedText>
            ) : (
              <>
                <Feather
                  name="send"
                  size={18}
                  color="#FFFFFF"
                  style={styles.submitIcon}
                />
                <ThemedText style={styles.submitButtonText}>
                  Submit Feedback
                </ThemedText>
              </>
            )}
          </AnimatedPressable>
        </View>

        <View style={styles.infoSection}>
          <Feather
            name="info"
            size={16}
            color={theme.tabIconDefault}
            style={styles.infoIcon}
          />
          <ThemedText style={styles.infoText}>
            Your feedback helps us create better learning experiences for
            medical students. All responses are anonymous.
          </ThemedText>
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
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  formCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  formSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  ratingContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  ratingButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "500",
  },
  textArea: {
    minHeight: 150,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    fontSize: 16,
    lineHeight: 24,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    marginLeft: Spacing.sm,
    color: "#EF4444",
    fontSize: 14,
    flex: 1,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  submitIcon: {
    marginRight: Spacing.sm,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  infoSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  infoIcon: {
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    opacity: 0.6,
    lineHeight: 20,
  },
  successView: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  successTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  successText: {
    textAlign: "center",
    opacity: 0.7,
    lineHeight: 22,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  successButtons: {
    width: "100%",
    gap: Spacing.md,
  },
  successButton: {
    marginBottom: 0,
  },
  backButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
