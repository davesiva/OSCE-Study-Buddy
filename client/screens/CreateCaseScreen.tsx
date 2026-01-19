import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

const LOCAL_CASES_KEY = "custom_cases_local";

interface CaseFormData {
  patient_name: string;
  age: string;
  gender: string;
  chief_complaint: string;
  presenting_history: string;
  blood_pressure: string;
  heart_rate: string;
  respiratory_rate: string;
  temperature: string;
  spo2: string;
  past_medical_history: string;
  social_history: string;
  allergies: string;
  script_instructions: string;
  secret_info: string;
  singlish_level: string;
  expected_diagnosis: string;
}

const initialFormData: CaseFormData = {
  patient_name: "",
  age: "",
  gender: "Male",
  chief_complaint: "",
  presenting_history: "",
  blood_pressure: "",
  heart_rate: "",
  respiratory_rate: "",
  temperature: "",
  spo2: "",
  past_medical_history: "",
  social_history: "",
  allergies: "",
  script_instructions: "",
  secret_info: "",
  singlish_level: "moderate",
  expected_diagnosis: "",
};

const STEPS = [
  { id: 1, title: "Patient Info", icon: "user" },
  { id: 2, title: "Vitals", icon: "heart" },
  { id: 3, title: "History", icon: "file-text" },
  { id: 4, title: "AI Setup", icon: "cpu" },
  { id: 5, title: "Preview", icon: "eye" },
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface FormInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric";
}

function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = "default",
}: FormInputProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.inputGroup}>
      <ThemedText style={styles.inputLabel}>{label}</ThemedText>
      <TextInput
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          {
            backgroundColor: theme.backgroundElevated,
            color: theme.textPrimary,
            borderColor: theme.borderDefault,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        keyboardType={keyboardType}
      />
    </View>
  );
}

interface OptionButtonProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function OptionButton({ label, selected, onPress }: OptionButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      onPressIn={() => (scale.value = withSpring(0.95))}
      onPressOut={() => (scale.value = withSpring(1))}
      style={[
        styles.optionButton,
        animatedStyle,
        {
          backgroundColor: selected ? "#0066CC" : theme.backgroundElevated,
          borderColor: selected ? "#0066CC" : theme.borderDefault,
        },
      ]}
    >
      <ThemedText
        style={[
          styles.optionButtonText,
          { color: selected ? "#FFFFFF" : theme.textPrimary },
        ]}
      >
        {label}
      </ThemedText>
    </AnimatedPressable>
  );
}

export default function CreateCaseScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<CaseFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const updateField = (field: keyof CaseFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number): string[] => {
    const stepErrors: string[] = [];

    if (step === 1) {
      if (!formData.patient_name.trim()) stepErrors.push("Patient name is required");
      if (!formData.age.trim()) stepErrors.push("Age is required");
      if (!formData.chief_complaint.trim()) stepErrors.push("Chief complaint is required");
    } else if (step === 2) {
      if (!formData.blood_pressure.trim()) stepErrors.push("Blood pressure is required");
      if (!formData.heart_rate.trim()) stepErrors.push("Heart rate is required");
    } else if (step === 3) {
      if (!formData.presenting_history.trim()) stepErrors.push("Presenting history is required");
    } else if (step === 4) {
      if (!formData.script_instructions.trim()) stepErrors.push("Acting instructions are required");
    }

    return stepErrors;
  };

  const handleNext = () => {
    const stepErrors = validateStep(currentStep);
    if (stepErrors.length > 0) {
      setErrors(stepErrors);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setErrors([]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentStep((prev) => Math.min(prev + 1, 5));
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setErrors([]);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const buildCaseObject = () => {
    const caseId = `custom_${Date.now()}`;
    return {
      case_id: caseId,
      patient_name: formData.patient_name.trim(),
      age: parseInt(formData.age) || 0,
      gender: formData.gender,
      chief_complaint: formData.chief_complaint.trim(),
      presenting_history: formData.presenting_history.trim(),
      vitals: {
        blood_pressure: formData.blood_pressure.trim() || "Not recorded",
        heart_rate: formData.heart_rate.trim() || "Not recorded",
        respiratory_rate: formData.respiratory_rate.trim() || "Not recorded",
        temperature: formData.temperature.trim() || "Not recorded",
        spo2: formData.spo2.trim() || "Not recorded",
      },
      past_medical_history: formData.past_medical_history
        .split("\n")
        .filter((line) => line.trim()),
      social_history: formData.social_history.trim() || "Not provided",
      allergies: formData.allergies.trim() || "No known allergies",
      script_instructions: formData.script_instructions.trim(),
      secret_info: formData.secret_info.trim() || "None",
      singlish_level: formData.singlish_level,
      expected_diagnosis: formData.expected_diagnosis.trim() || "To be determined",
      is_custom: true,
    };
  };

  const handleSaveLocally = async () => {
    setIsSaving(true);
    try {
      const newCase = buildCaseObject();
      const existingCasesJson = await AsyncStorage.getItem(LOCAL_CASES_KEY);
      const existingCases = existingCasesJson ? JSON.parse(existingCasesJson) : [];
      existingCases.push(newCase);
      await AsyncStorage.setItem(LOCAL_CASES_KEY, JSON.stringify(existingCases));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Case Saved",
        `"${newCase.patient_name}" has been saved to your device. You can now use this case in the OSCE Simulator.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error("Error saving locally:", error);
      Alert.alert("Error", "Failed to save case locally. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpload = async () => {
    setIsSaving(true);
    try {
      const newCase = buildCaseObject();
      const response = await fetch(new URL("/api/cases", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCase),
      });

      if (!response.ok) {
        throw new Error("Failed to upload case");
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Case Uploaded",
        `"${newCase.patient_name}" has been uploaded to the server. Everyone can now use this case.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error("Error uploading:", error);
      Alert.alert("Error", "Failed to upload case. Please try again or save locally.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((step, index) => (
        <React.Fragment key={step.id}>
          <Pressable
            onPress={() => {
              if (step.id < currentStep) {
                setCurrentStep(step.id);
              }
            }}
            style={[
              styles.stepDot,
              {
                backgroundColor:
                  step.id === currentStep
                    ? "#0066CC"
                    : step.id < currentStep
                    ? "#10B981"
                    : theme.backgroundElevated,
              },
            ]}
          >
            <Feather
              name={step.id < currentStep ? "check" : (step.icon as any)}
              size={14}
              color={step.id <= currentStep ? "#FFFFFF" : theme.textTertiary}
            />
          </Pressable>
          {index < STEPS.length - 1 && (
            <View
              style={[
                styles.stepLine,
                {
                  backgroundColor:
                    step.id < currentStep ? "#10B981" : theme.borderDefault,
                },
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <Animated.View entering={FadeIn} exiting={FadeOut}>
      <ThemedText type="h4" style={styles.stepTitle}>
        Patient Information
      </ThemedText>
      <FormInput
        label="Patient Name *"
        value={formData.patient_name}
        onChangeText={(v) => updateField("patient_name", v)}
        placeholder="e.g., Mr. Tan Ah Kow"
      />
      <View style={styles.row}>
        <View style={styles.halfWidth}>
          <FormInput
            label="Age *"
            value={formData.age}
            onChangeText={(v) => updateField("age", v)}
            placeholder="e.g., 55"
            keyboardType="numeric"
          />
        </View>
        <View style={styles.halfWidth}>
          <ThemedText style={styles.inputLabel}>Gender</ThemedText>
          <View style={styles.optionRow}>
            <OptionButton
              label="Male"
              selected={formData.gender === "Male"}
              onPress={() => updateField("gender", "Male")}
            />
            <OptionButton
              label="Female"
              selected={formData.gender === "Female"}
              onPress={() => updateField("gender", "Female")}
            />
          </View>
        </View>
      </View>
      <FormInput
        label="Chief Complaint *"
        value={formData.chief_complaint}
        onChangeText={(v) => updateField("chief_complaint", v)}
        placeholder="e.g., Chest pain for 2 hours"
      />
    </Animated.View>
  );

  const renderStep2 = () => (
    <Animated.View entering={FadeIn} exiting={FadeOut}>
      <ThemedText type="h4" style={styles.stepTitle}>
        Vital Signs
      </ThemedText>
      <View style={styles.row}>
        <View style={styles.halfWidth}>
          <FormInput
            label="Blood Pressure *"
            value={formData.blood_pressure}
            onChangeText={(v) => updateField("blood_pressure", v)}
            placeholder="e.g., 120/80 mmHg"
          />
        </View>
        <View style={styles.halfWidth}>
          <FormInput
            label="Heart Rate *"
            value={formData.heart_rate}
            onChangeText={(v) => updateField("heart_rate", v)}
            placeholder="e.g., 72 bpm"
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.halfWidth}>
          <FormInput
            label="Respiratory Rate"
            value={formData.respiratory_rate}
            onChangeText={(v) => updateField("respiratory_rate", v)}
            placeholder="e.g., 16/min"
          />
        </View>
        <View style={styles.halfWidth}>
          <FormInput
            label="Temperature"
            value={formData.temperature}
            onChangeText={(v) => updateField("temperature", v)}
            placeholder="e.g., 36.8 C"
          />
        </View>
      </View>
      <FormInput
        label="SpO2"
        value={formData.spo2}
        onChangeText={(v) => updateField("spo2", v)}
        placeholder="e.g., 98% on room air"
      />
    </Animated.View>
  );

  const renderStep3 = () => (
    <Animated.View entering={FadeIn} exiting={FadeOut}>
      <ThemedText type="h4" style={styles.stepTitle}>
        Medical History
      </ThemedText>
      <FormInput
        label="Presenting History *"
        value={formData.presenting_history}
        onChangeText={(v) => updateField("presenting_history", v)}
        placeholder="Describe how the symptoms started and progressed..."
        multiline
      />
      <FormInput
        label="Past Medical History"
        value={formData.past_medical_history}
        onChangeText={(v) => updateField("past_medical_history", v)}
        placeholder="Enter each condition on a new line..."
        multiline
      />
      <FormInput
        label="Social History"
        value={formData.social_history}
        onChangeText={(v) => updateField("social_history", v)}
        placeholder="e.g., Smoker, occupation, lifestyle..."
      />
      <FormInput
        label="Allergies"
        value={formData.allergies}
        onChangeText={(v) => updateField("allergies", v)}
        placeholder="e.g., Penicillin, No known allergies"
      />
    </Animated.View>
  );

  const renderStep4 = () => (
    <Animated.View entering={FadeIn} exiting={FadeOut}>
      <ThemedText type="h4" style={styles.stepTitle}>
        AI Patient Setup
      </ThemedText>
      <FormInput
        label="Acting Instructions *"
        value={formData.script_instructions}
        onChangeText={(v) => updateField("script_instructions", v)}
        placeholder="How should the AI patient behave? Describe their personality, emotions, and how they should respond..."
        multiline
      />
      <FormInput
        label="Secret Information"
        value={formData.secret_info}
        onChangeText={(v) => updateField("secret_info", v)}
        placeholder="Information the patient only reveals when asked specific questions..."
        multiline
      />
      <ThemedText style={styles.inputLabel}>Singlish Level</ThemedText>
      <View style={styles.optionRow}>
        <OptionButton
          label="Low"
          selected={formData.singlish_level === "low"}
          onPress={() => updateField("singlish_level", "low")}
        />
        <OptionButton
          label="Moderate"
          selected={formData.singlish_level === "moderate"}
          onPress={() => updateField("singlish_level", "moderate")}
        />
        <OptionButton
          label="High"
          selected={formData.singlish_level === "high"}
          onPress={() => updateField("singlish_level", "high")}
        />
      </View>
      <View style={{ height: Spacing.lg }} />
      <FormInput
        label="Expected Diagnosis"
        value={formData.expected_diagnosis}
        onChangeText={(v) => updateField("expected_diagnosis", v)}
        placeholder="e.g., Acute Appendicitis"
      />
    </Animated.View>
  );

  const renderPreview = () => {
    const caseObj = buildCaseObject();
    return (
      <Animated.View entering={FadeIn} exiting={FadeOut}>
        <ThemedText type="h4" style={styles.stepTitle}>
          Review Your Case
        </ThemedText>

        <View style={[styles.previewCard, { backgroundColor: theme.backgroundElevated }]}>
          <ThemedText type="h5" style={styles.previewName}>
            {caseObj.patient_name}
          </ThemedText>
          <ThemedText style={styles.previewMeta}>
            {caseObj.age} years old, {caseObj.gender}
          </ThemedText>

          <View style={styles.previewSection}>
            <ThemedText style={styles.previewLabel}>Chief Complaint</ThemedText>
            <ThemedText>{caseObj.chief_complaint}</ThemedText>
          </View>

          <View style={styles.previewSection}>
            <ThemedText style={styles.previewLabel}>Vitals</ThemedText>
            <ThemedText style={styles.previewVital}>
              BP: {caseObj.vitals.blood_pressure} | HR: {caseObj.vitals.heart_rate}
            </ThemedText>
          </View>

          <View style={styles.previewSection}>
            <ThemedText style={styles.previewLabel}>Singlish Level</ThemedText>
            <ThemedText style={{ textTransform: "capitalize" }}>
              {caseObj.singlish_level}
            </ThemedText>
          </View>
        </View>

        <ThemedText type="h5" style={styles.saveTitle}>
          Where would you like to save this case?
        </ThemedText>

        <Pressable
          onPress={handleSaveLocally}
          disabled={isSaving}
          style={[styles.saveButton, { backgroundColor: "#10B981" }]}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Feather name="smartphone" size={20} color="#FFFFFF" />
              <View style={styles.saveButtonContent}>
                <ThemedText style={styles.saveButtonTitle}>Save Locally</ThemedText>
                <ThemedText style={styles.saveButtonSubtitle}>
                  Only available on this device
                </ThemedText>
              </View>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={handleUpload}
          disabled={isSaving}
          style={[styles.saveButton, { backgroundColor: "#0066CC" }]}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Feather name="upload-cloud" size={20} color="#FFFFFF" />
              <View style={styles.saveButtonContent}>
                <ThemedText style={styles.saveButtonTitle}>Upload to Server</ThemedText>
                <ThemedText style={styles.saveButtonSubtitle}>
                  Available to everyone
                </ThemedText>
              </View>
            </>
          )}
        </Pressable>
      </Animated.View>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderPreview();
      default:
        return null;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderStepIndicator()}

        <ThemedText style={styles.stepLabel}>
          Step {currentStep} of 5: {STEPS[currentStep - 1].title}
        </ThemedText>

        {errors.length > 0 && (
          <View style={[styles.errorBox, { backgroundColor: "#FEE2E2" }]}>
            {errors.map((error, idx) => (
              <ThemedText key={idx} style={styles.errorText}>
                {error}
              </ThemedText>
            ))}
          </View>
        )}

        {renderCurrentStep()}
      </ScrollView>

      {currentStep < 5 && (
        <View
          style={[
            styles.bottomNav,
            {
              paddingBottom: insets.bottom + Spacing.md,
              backgroundColor: theme.backgroundDefault,
              borderTopColor: theme.borderDefault,
            },
          ]}
        >
          {currentStep > 1 ? (
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Feather name="arrow-left" size={20} color={theme.textPrimary} />
              <ThemedText style={styles.backButtonText}>Back</ThemedText>
            </Pressable>
          ) : (
            <View style={styles.backButton} />
          )}

          <Pressable
            onPress={handleNext}
            style={[styles.nextButton, { backgroundColor: "#0066CC" }]}
          >
            <ThemedText style={styles.nextButtonText}>
              {currentStep === 4 ? "Preview" : "Next"}
            </ThemedText>
            <Feather name="arrow-right" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      )}
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
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: {
    width: 24,
    height: 2,
    marginHorizontal: 4,
  },
  stepLabel: {
    textAlign: "center",
    opacity: 0.6,
    marginBottom: Spacing.lg,
  },
  stepTitle: {
    marginBottom: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    minHeight: 48,
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  optionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  optionButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  optionButtonText: {
    fontWeight: "500",
  },
  errorBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
  },
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    minWidth: 80,
  },
  backButtonText: {
    fontSize: 16,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  previewCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  previewName: {
    marginBottom: Spacing.xs,
  },
  previewMeta: {
    opacity: 0.6,
    marginBottom: Spacing.lg,
  },
  previewSection: {
    marginBottom: Spacing.md,
  },
  previewLabel: {
    fontWeight: "600",
    fontSize: 12,
    opacity: 0.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  previewVital: {
    fontSize: 14,
  },
  saveTitle: {
    marginBottom: Spacing.lg,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  saveButtonContent: {
    flex: 1,
  },
  saveButtonTitle: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  saveButtonSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
  },
});
