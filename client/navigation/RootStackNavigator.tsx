import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeScreen from "@/screens/HomeScreen";
import OSCESimulatorScreen from "@/screens/OSCESimulatorScreen";
import FeedbackScreen from "@/screens/FeedbackScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type RootStackParamList = {
  Home: undefined;
  OSCESimulator: undefined;
  Feedback: undefined;
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
          headerTitle: () => <HeaderTitle title="Medical Student Assistant" />,
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
    </Stack.Navigator>
  );
}
