import React from "react";
import Svg, { Path, Circle, Ellipse, G } from "react-native-svg";

interface MedicalIconProps {
  size?: number;
  color?: string;
}

export const HeartIcon = ({ size = 14, color = "#000" }: MedicalIconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      fill={color}
    />
    <Path
      d="M4 12h3l2-4 3 8 2-4h6"
      stroke="#fff"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const LungsIcon = ({ size = 14, color = "#000" }: MedicalIconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 4v8M12 12c-2 0-4 1-5 3-1.5 3-2 5-2 7h7v-10zM12 12c2 0 4 1 5 3 1.5 3 2 5 2 7h-7v-10z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx="8" cy="17" r="1.5" fill={color} opacity={0.5} />
    <Circle cx="16" cy="17" r="1.5" fill={color} opacity={0.5} />
  </Svg>
);

export const StomachIcon = ({ size = 14, color = "#000" }: MedicalIconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M17 4h-3c-1 0-2 1-2 2v2c0 2-1 3-3 3H7c-2 0-3 2-3 4v2c0 3 2 5 5 5h4c3 0 5-2 5-5V8c0-2-0.5-4-1-4z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M9 14c1 1 3 1 4 0"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
);

export const BrainIcon = ({ size = 14, color = "#000" }: MedicalIconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 4C9 4 7 6 7 8c-2 0-4 2-4 4s2 4 4 4v2c0 1 1 2 2 2h6c1 0 2-1 2-2v-2c2 0 4-2 4-4s-2-4-4-4c0-2-2-4-5-4z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M12 4v16M9 8c0 2 1 3 3 3M15 8c0 2-1 3-3 3M9 14c1 1 2 1 3 1M15 14c-1 1-2 1-3 1"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      opacity={0.6}
    />
  </Svg>
);

export const KidneyIcon = ({ size = 14, color = "#000" }: MedicalIconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M7 6c-2 0-4 2-4 5 0 4 2 7 5 7 2 0 3-1 4-3M17 6c2 0 4 2 4 5 0 4-2 7-5 7-2 0-3-1-4-3"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M12 15v5M10 20h4"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

export const ThyroidIcon = ({ size = 14, color = "#000" }: MedicalIconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Ellipse cx="8" cy="12" rx="3" ry="5" stroke={color} strokeWidth={2} />
    <Ellipse cx="16" cy="12" rx="3" ry="5" stroke={color} strokeWidth={2} />
    <Path
      d="M11 10h2M11 14h2"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Circle cx="12" cy="5" r="2" stroke={color} strokeWidth={1.5} />
  </Svg>
);

export const BoneIcon = ({ size = 14, color = "#000" }: MedicalIconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M8 4c-1.5 0-3 1-3 2.5S6 9 7 9.5v5c-1 .5-2 1.5-2 3S6.5 20 8 20s3-1 3-2.5-1-2.5-2-3v-5c1-.5 2-1.5 2-3S9.5 4 8 4z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M16 4c1.5 0 3 1 3 2.5S18 9 17 9.5v5c1 .5 2 1.5 2 3s-1.5 2.5-3 2.5-3-1-3-2.5 1-2.5 2-3v-5c-1-.5-2-1.5-2-3S14.5 4 16 4z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const PregnancyIcon = ({ size = 14, color = "#000" }: MedicalIconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="14" r="6" stroke={color} strokeWidth={2} />
    <Circle cx="12" cy="14" r="3" fill={color} opacity={0.4} />
    <Path
      d="M12 4v4"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Circle cx="12" cy="3" r="2" stroke={color} strokeWidth={1.5} />
  </Svg>
);

export const BacteriaIcon = ({ size = 14, color = "#000" }: MedicalIconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Ellipse cx="12" cy="12" rx="5" ry="4" stroke={color} strokeWidth={2} />
    <Path
      d="M7 9l-2-3M7 15l-2 3M17 9l2-3M17 15l2 3M12 8V4M12 16v4"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Circle cx="5" cy="6" r="1" fill={color} />
    <Circle cx="5" cy="18" r="1" fill={color} />
    <Circle cx="19" cy="6" r="1" fill={color} />
    <Circle cx="19" cy="18" r="1" fill={color} />
    <Circle cx="12" cy="4" r="1" fill={color} />
    <Circle cx="12" cy="20" r="1" fill={color} />
  </Svg>
);

export const PsychiatryIcon = ({ size = 14, color = "#000" }: MedicalIconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="8" r="5" stroke={color} strokeWidth={2} />
    <Path
      d="M7 13c-2 1-3 3-3 5v2h16v-2c0-2-1-4-3-5"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M10 6h1v2h2V6h1v2h-2v2h-2V8h-1V6z"
      fill={color}
      opacity={0.6}
    />
    <Path
      d="M11 9h2v1h-2z"
      fill={color}
      opacity={0.6}
    />
  </Svg>
);

export type MedicalIconType = 
  | "cardiology" 
  | "respiratory" 
  | "gastroenterology" 
  | "neurology" 
  | "renal" 
  | "endocrine" 
  | "msk" 
  | "obgyn" 
  | "infectious" 
  | "psychiatry";

interface MedicalIconComponentProps extends MedicalIconProps {
  type: MedicalIconType;
}

export const MedicalIcon = ({ type, size = 14, color = "#000" }: MedicalIconComponentProps) => {
  switch (type) {
    case "cardiology":
      return <HeartIcon size={size} color={color} />;
    case "respiratory":
      return <LungsIcon size={size} color={color} />;
    case "gastroenterology":
      return <StomachIcon size={size} color={color} />;
    case "neurology":
      return <BrainIcon size={size} color={color} />;
    case "renal":
      return <KidneyIcon size={size} color={color} />;
    case "endocrine":
      return <ThyroidIcon size={size} color={color} />;
    case "msk":
      return <BoneIcon size={size} color={color} />;
    case "obgyn":
      return <PregnancyIcon size={size} color={color} />;
    case "infectious":
      return <BacteriaIcon size={size} color={color} />;
    case "psychiatry":
      return <PsychiatryIcon size={size} color={color} />;
    default:
      return <HeartIcon size={size} color={color} />;
  }
};

export default MedicalIcon;
