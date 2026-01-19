import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type AssessmentScreenRouteProp = RouteProp<RootStackParamList, "Assessment">;

export default function AssessmentScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<AssessmentScreenRouteProp>();
  const { assessment, hasCustomCriteria, patientName, chiefComplaint } = route.params;

  const getGradeColor = (grade: string) => {
    const lowerGrade = grade.toLowerCase();
    if (lowerGrade.includes("distinction") || lowerGrade.includes("excellent")) {
      return "#10B981";
    } else if (lowerGrade.includes("pass") || lowerGrade.includes("good")) {
      return "#3B82F6";
    } else if (lowerGrade.includes("borderline")) {
      return "#F59E0B";
    } else if (lowerGrade.includes("fail")) {
      return "#EF4444";
    }
    return theme.text;
  };

  const extractGrade = (text: string): string | null => {
    const gradeMatch = text.match(/OVERALL GRADE:\s*\[?([^\]\n]+)\]?/i);
    return gradeMatch ? gradeMatch[1].trim() : null;
  };

  const overallGrade = extractGrade(assessment);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.header,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <View style={styles.headerIcon}>
            <Feather name="clipboard" size={28} color={theme.link} />
          </View>
          <ThemedText style={styles.headerTitle}>
            Performance Assessment
          </ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            {patientName} - {chiefComplaint}
          </ThemedText>
          
          {hasCustomCriteria ? (
            <View style={[styles.criteriaTag, { backgroundColor: "#10B98120" }]}>
              <Feather name="check-circle" size={14} color="#10B981" />
              <ThemedText style={[styles.criteriaTagText, { color: "#10B981" }]}>
                Using Uploaded Calibration Guidelines
              </ThemedText>
            </View>
          ) : (
            <View style={[styles.criteriaTag, { backgroundColor: "#3B82F620" }]}>
              <Feather name="cpu" size={14} color="#3B82F6" />
              <ThemedText style={[styles.criteriaTagText, { color: "#3B82F6" }]}>
                Using Standard OSCE Assessment Criteria
              </ThemedText>
            </View>
          )}
        </View>

        {overallGrade ? (
          <View
            style={[
              styles.gradeCard,
              { backgroundColor: getGradeColor(overallGrade) + "15" },
            ]}
          >
            <ThemedText style={styles.gradeLabel}>Overall Grade</ThemedText>
            <ThemedText
              style={[styles.gradeValue, { color: getGradeColor(overallGrade) }]}
            >
              {overallGrade}
            </ThemedText>
          </View>
        ) : null}

        <View
          style={[
            styles.assessmentCard,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <ThemedText style={styles.assessmentText}>{assessment}</ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  criteriaTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  criteriaTagText: {
    fontSize: 12,
    fontWeight: "500",
  },
  gradeCard: {
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  gradeLabel: {
    fontSize: 12,
    opacity: 0.7,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  gradeValue: {
    fontSize: 28,
    fontWeight: "700",
  },
  assessmentCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  assessmentText: {
    fontSize: 15,
    lineHeight: 24,
  },
});
