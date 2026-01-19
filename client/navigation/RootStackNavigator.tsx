import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeScreen from "@/screens/HomeScreen";
import OSCESimulatorScreen from "@/screens/OSCESimulatorScreen";
import FeedbackScreen from "@/screens/FeedbackScreen";
import CreateCaseScreen from "@/screens/CreateCaseScreen";
import VoiceModeScreen from "@/screens/VoiceModeScreen";
import AssessmentScreen from "@/screens/AssessmentScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type RootStackParamList = {
  Home: undefined;
  OSCESimulator: undefined;
  Feedback: undefined;
  CreateCase: undefined;
  VoiceMode: { caseData?: object };
  Assessment: {
    assessment: string;
    hasCustomCriteria: boolean;
    patientName: string;
    chiefComplaint: string;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerTitle: () => <HeaderTitle title="OSCE Study Buddy" />,
        }}
      />
      <Stack.Screen
        name="OSCESimulator"
        component={OSCESimulatorScreen}
        options={{
          headerTitle: "OSCE Simulator",
        }}
      />
      <Stack.Screen
        name="Feedback"
        component={FeedbackScreen}
        options={{
          headerTitle: "Feedback",
        }}
      />
      <Stack.Screen
        name="CreateCase"
        component={CreateCaseScreen}
        options={{
          headerTitle: "Create Case",
        }}
      />
      <Stack.Screen
        name="VoiceMode"
        component={VoiceModeScreen}
        options={{
          headerTitle: "Voice Mode",
        }}
      />
      <Stack.Screen
        name="Assessment"
        component={AssessmentScreen}
        options={{
          headerTitle: "Assessment",
        }}
      />
    </Stack.Navigator>
  );
}
