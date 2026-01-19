import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
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
  expected_diagnosis: "",
};

const STEPS = [
  { id: 0, title: "Choose Method", icon: "plus" },
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
            backgroundColor: theme.backgroundSecondary,
            color: theme.text,
            borderColor: theme.tabIconDefault,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.tabIconDefault}
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
          backgroundColor: selected ? "#0066CC" : theme.backgroundSecondary,
          borderColor: selected ? "#0066CC" : theme.tabIconDefault,
        },
      ]}
    >
      <ThemedText
        style={[
          styles.optionButtonText,
          { color: selected ? "#FFFFFF" : theme.text },
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

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<CaseFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState<{ type: "local" | "upload"; name: string } | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<"easy" | "medium" | "challenging">("medium");

  const SPECIALTIES = [
    { id: "cardiology", label: "Cardiology", icon: "heart" },
    { id: "respiratory", label: "Respiratory", icon: "wind" },
    { id: "gastroenterology", label: "Gastroenterology", icon: "activity" },
    { id: "neurology", label: "Neurology", icon: "zap" },
    { id: "renal", label: "Renal", icon: "droplet" },
    { id: "endocrine", label: "Endocrine", icon: "thermometer" },
    { id: "msk", label: "Musculoskeletal", icon: "move" },
    { id: "obgyn", label: "O&G", icon: "users" },
    { id: "infectious", label: "Infectious Disease", icon: "alert-circle" },
  ];

  const updateField = (field: keyof CaseFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleStartFromScratch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFormData(initialFormData);
    setCurrentStep(1);
  };

  const handleGenerateCase = async () => {
    if (!selectedSpecialty) {
      setErrors(["Please select a specialty"]);
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsGenerating(true);
      setErrors([]);

      const response = await fetch(new URL("/api/generate-case", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          specialty: selectedSpecialty, 
          difficulty: selectedDifficulty 
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate case");
      }

      const { data } = await response.json();

      setFormData({
        patient_name: data.patient_name || "",
        age: String(data.age || ""),
        gender: data.gender || "Male",
        chief_complaint: data.chief_complaint || "",
        presenting_history: data.presenting_history || "",
        blood_pressure: data.blood_pressure || "",
        heart_rate: data.heart_rate || "",
        respiratory_rate: data.respiratory_rate || "",
        temperature: data.temperature || "",
        spo2: data.spo2 || "",
        past_medical_history: Array.isArray(data.past_medical_history) 
          ? data.past_medical_history.join("\n") 
          : data.past_medical_history || "",
        social_history: data.social_history || "",
        allergies: data.allergies || "",
        script_instructions: data.script_instructions || "",
        secret_info: data.secret_info || "",
        expected_diagnosis: data.expected_diagnosis || "",
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCurrentStep(1);
    } catch (error) {
      console.error("Error generating case:", error);
      setErrors(["Failed to generate case. Please try again."]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImportPDF = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "text/plain"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      if (!file) return;

      setIsParsing(true);
      setErrors([]);

      let content = "";
      
      if (Platform.OS === "web") {
        const response = await fetch(file.uri);
        content = await response.text();
      } else {
        content = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      const parseResponse = await fetch(new URL("/api/parse-case", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!parseResponse.ok) {
        throw new Error("Failed to parse document");
      }

      const { data } = await parseResponse.json();

      setFormData({
        patient_name: data.patient_name || "",
        age: String(data.age || ""),
        gender: data.gender || "Male",
        chief_complaint: data.chief_complaint || "",
        presenting_history: data.presenting_history || "",
        blood_pressure: data.blood_pressure || "",
        heart_rate: data.heart_rate || "",
        respiratory_rate: data.respiratory_rate || "",
        temperature: data.temperature || "",
        spo2: data.spo2 || "",
        past_medical_history: Array.isArray(data.past_medical_history) 
          ? data.past_medical_history.join("\n") 
          : data.past_medical_history || "",
        social_history: data.social_history || "",
        allergies: data.allergies || "",
        script_instructions: data.script_instructions || "",
        secret_info: data.secret_info || "",
        expected_diagnosis: data.expected_diagnosis || "",
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCurrentStep(1);
    } catch (error) {
      console.error("Error importing PDF:", error);
      setErrors(["Failed to parse the document. Please make sure it's a valid OSCE case file."]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsParsing(false);
    }
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
    if (currentStep === 1) {
      setCurrentStep(0);
      setFormData(initialFormData);
    } else {
      setCurrentStep((prev) => Math.max(prev - 1, 0));
    }
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
      setSaveSuccess({ type: "local", name: newCase.patient_name });
      setTimeout(() => {
        navigation.goBack();
      }, 2000);
    } catch (error) {
      console.error("Error saving locally:", error);
      setErrors(["Failed to save case locally. Please try again."]);
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
      setSaveSuccess({ type: "upload", name: newCase.patient_name });
      setTimeout(() => {
        navigation.goBack();
      }, 2000);
    } catch (error) {
      console.error("Error uploading:", error);
      setErrors(["Failed to upload case. Please try again or save locally."]);
    } finally {
      setIsSaving(false);
    }
  };

  const renderStepIndicator = () => {
    const formSteps = STEPS.filter(s => s.id > 0);
    return (
      <View style={styles.stepIndicator}>
        {formSteps.map((step, index) => (
          <React.Fragment key={step.id}>
            <Pressable
              onPress={() => {
                if (step.id < currentStep && step.id > 0) {
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
                      : theme.backgroundSecondary,
                },
              ]}
            >
              <Feather
                name={step.id < currentStep ? "check" : (step.icon as any)}
                size={14}
                color={step.id <= currentStep ? "#FFFFFF" : theme.tabIconDefault}
              />
            </Pressable>
            {index < formSteps.length - 1 && (
              <View
                style={[
                  styles.stepLine,
                  {
                    backgroundColor:
                      step.id < currentStep ? "#10B981" : theme.tabIconDefault,
                  },
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </View>
    );
  };

  const renderStep0 = () => (
    <Animated.View entering={FadeIn} exiting={FadeOut}>
      <ThemedText type="h4" style={styles.stepTitle}>
        How would you like to create your case?
      </ThemedText>
      
      <ThemedText style={styles.methodDescription}>
        Choose to start from scratch, import from a document, or generate with AI.
      </ThemedText>

      <Pressable
        onPress={handleStartFromScratch}
        style={[styles.methodButton, { backgroundColor: theme.backgroundDefault }]}
      >
        <View style={[styles.methodIcon, { backgroundColor: "#0066CC20" }]}>
          <Feather name="edit-3" size={28} color="#0066CC" />
        </View>
        <View style={styles.methodContent}>
          <ThemedText style={styles.methodTitle}>Start from Scratch</ThemedText>
          <ThemedText style={styles.methodSubtitle}>
            Manually enter all patient details
          </ThemedText>
        </View>
        <Feather name="chevron-right" size={24} color={theme.tabIconDefault} />
      </Pressable>

      <Pressable
        onPress={handleImportPDF}
        disabled={isParsing}
        style={[styles.methodButton, { backgroundColor: theme.backgroundDefault }]}
      >
        {isParsing ? (
          <>
            <View style={[styles.methodIcon, { backgroundColor: "#8B5CF620" }]}>
              <ActivityIndicator size="small" color="#8B5CF6" />
            </View>
            <View style={styles.methodContent}>
              <ThemedText style={styles.methodTitle}>Analyzing Document...</ThemedText>
              <ThemedText style={styles.methodSubtitle}>
                Extracting case information with AI
              </ThemedText>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.methodIcon, { backgroundColor: "#8B5CF620" }]}>
              <Feather name="upload" size={28} color="#8B5CF6" />
            </View>
            <View style={styles.methodContent}>
              <ThemedText style={styles.methodTitle}>Import from Document</ThemedText>
              <ThemedText style={styles.methodSubtitle}>
                Upload EI/CI PDF or text file
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={24} color={theme.tabIconDefault} />
          </>
        )}
      </Pressable>

      <View style={[styles.generateSection, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.generateHeader}>
          <View style={[styles.methodIcon, { backgroundColor: "#10B98120" }]}>
            <Feather name="cpu" size={28} color="#10B981" />
          </View>
          <View style={styles.methodContent}>
            <ThemedText style={styles.methodTitle}>Generate with AI</ThemedText>
            <ThemedText style={styles.methodSubtitle}>
              Draft a comprehensive OSCE case with AI
            </ThemedText>
          </View>
        </View>

        <ThemedText style={styles.selectorLabel}>Select Specialty</ThemedText>
        <View style={styles.specialtyGrid}>
          {SPECIALTIES.map((specialty) => (
            <Pressable
              key={specialty.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedSpecialty(specialty.id);
              }}
              style={[
                styles.specialtyChip,
                {
                  backgroundColor: selectedSpecialty === specialty.id ? "#10B981" : theme.backgroundSecondary,
                  borderColor: selectedSpecialty === specialty.id ? "#10B981" : theme.tabIconDefault,
                },
              ]}
            >
              <Feather
                name={specialty.icon as any}
                size={14}
                color={selectedSpecialty === specialty.id ? "#FFFFFF" : theme.text}
              />
              <ThemedText
                style={[
                  styles.specialtyChipText,
                  { color: selectedSpecialty === specialty.id ? "#FFFFFF" : theme.text },
                ]}
              >
                {specialty.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <ThemedText style={styles.selectorLabel}>Select Difficulty</ThemedText>
        <View style={styles.difficultyRow}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedDifficulty("easy");
            }}
            style={[
              styles.difficultyOption,
              {
                backgroundColor: selectedDifficulty === "easy" ? "#22C55E" : theme.backgroundSecondary,
                borderColor: selectedDifficulty === "easy" ? "#22C55E" : theme.tabIconDefault,
              },
            ]}
          >
            <ThemedText style={[styles.difficultyText, { color: selectedDifficulty === "easy" ? "#FFFFFF" : theme.text }]}>
              Easy
            </ThemedText>
            <ThemedText style={[styles.difficultyDesc, { color: selectedDifficulty === "easy" ? "#FFFFFF" : theme.tabIconDefault }]}>
              Textbook
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedDifficulty("medium");
            }}
            style={[
              styles.difficultyOption,
              {
                backgroundColor: selectedDifficulty === "medium" ? "#F59E0B" : theme.backgroundSecondary,
                borderColor: selectedDifficulty === "medium" ? "#F59E0B" : theme.tabIconDefault,
              },
            ]}
          >
            <ThemedText style={[styles.difficultyText, { color: selectedDifficulty === "medium" ? "#FFFFFF" : theme.text }]}>
              Medium
            </ThemedText>
            <ThemedText style={[styles.difficultyDesc, { color: selectedDifficulty === "medium" ? "#FFFFFF" : theme.tabIconDefault }]}>
              Atypical
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedDifficulty("challenging");
            }}
            style={[
              styles.difficultyOption,
              {
                backgroundColor: selectedDifficulty === "challenging" ? "#EF4444" : theme.backgroundSecondary,
                borderColor: selectedDifficulty === "challenging" ? "#EF4444" : theme.tabIconDefault,
              },
            ]}
          >
            <ThemedText style={[styles.difficultyText, { color: selectedDifficulty === "challenging" ? "#FFFFFF" : theme.text }]}>
              Hard
            </ThemedText>
            <ThemedText style={[styles.difficultyDesc, { color: selectedDifficulty === "challenging" ? "#FFFFFF" : theme.tabIconDefault }]}>
              Obscure
            </ThemedText>
          </Pressable>
        </View>

        <Pressable
          onPress={handleGenerateCase}
          disabled={isGenerating || !selectedSpecialty}
          style={[
            styles.generateButton,
            {
              backgroundColor: selectedSpecialty ? "#10B981" : theme.backgroundSecondary,
              opacity: isGenerating ? 0.7 : 1,
            },
          ]}
        >
          {isGenerating ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <ThemedText style={styles.generateButtonText}>Generating Case...</ThemedText>
            </>
          ) : (
            <>
              <Feather name="zap" size={20} color={selectedSpecialty ? "#FFFFFF" : theme.tabIconDefault} />
              <ThemedText style={[styles.generateButtonText, { color: selectedSpecialty ? "#FFFFFF" : theme.tabIconDefault }]}>
                Generate Case
              </ThemedText>
            </>
          )}
        </Pressable>
      </View>
    </Animated.View>
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

    if (saveSuccess) {
      return (
        <Animated.View entering={FadeIn} style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Feather name="check-circle" size={64} color="#10B981" />
          </View>
          <ThemedText type="h3" style={styles.successTitle}>
            Case Saved!
          </ThemedText>
          <ThemedText style={styles.successText}>
            "{saveSuccess.name}" has been {saveSuccess.type === "local" ? "saved to your device" : "uploaded to the server"}.
          </ThemedText>
          <ThemedText style={styles.successSubtext}>
            Redirecting to home...
          </ThemedText>
        </Animated.View>
      );
    }

    return (
      <Animated.View entering={FadeIn} exiting={FadeOut}>
        <ThemedText type="h4" style={styles.stepTitle}>
          Review Your Case
        </ThemedText>

        <View style={[styles.previewCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={styles.previewName}>
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

        </View>

        <ThemedText type="h4" style={styles.saveTitle}>
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
      case 0:
        return renderStep0();
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
        {currentStep > 0 && renderStepIndicator()}

        {currentStep > 0 ? (
          <ThemedText style={styles.stepLabel}>
            Step {currentStep} of 5: {STEPS[currentStep].title}
          </ThemedText>
        ) : null}

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

      {currentStep > 0 && currentStep < 5 && (
        <View
          style={[
            styles.bottomNav,
            {
              paddingBottom: insets.bottom + Spacing.md,
              backgroundColor: theme.backgroundDefault,
              borderTopColor: theme.tabIconDefault,
            },
          ]}
        >
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Feather name="arrow-left" size={20} color={theme.text} />
            <ThemedText style={styles.backButtonText}>Back</ThemedText>
          </Pressable>

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
  successContainer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  successIcon: {
    marginBottom: Spacing.xl,
  },
  successTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  successText: {
    textAlign: "center",
    opacity: 0.8,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  successSubtext: {
    textAlign: "center",
    opacity: 0.5,
    fontSize: 14,
  },
  methodDescription: {
    opacity: 0.7,
    marginBottom: Spacing.xl,
    fontSize: 15,
  },
  methodButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  methodIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  methodContent: {
    flex: 1,
  },
  methodTitle: {
    fontWeight: "600",
    fontSize: 16,
    marginBottom: 2,
  },
  methodSubtitle: {
    opacity: 0.6,
    fontSize: 14,
  },
  infoBox: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    opacity: 0.7,
    lineHeight: 18,
  },
  generateSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  generateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  selectorLabel: {
    fontWeight: "600",
    fontSize: 14,
    marginBottom: Spacing.sm,
    opacity: 0.8,
  },
  specialtyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  specialtyChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  specialtyChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  difficultyRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  difficultyOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  difficultyText: {
    fontWeight: "600",
    fontSize: 14,
  },
  difficultyDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  generateButtonText: {
    fontWeight: "600",
    fontSize: 16,
  },
});
