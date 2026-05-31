import React from "react";
import Svg, { Path, Circle } from "react-native-svg";

interface IconProps {
  name: string;
  size?: number;
  color?: string;
}

export default function IconPark({ name, size = 24, color = "#18181B" }: IconProps) {
  switch (name) {
    case "home":
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path d="M9 18L24 6L39 18V40H9V18Z" stroke={color} strokeWidth="4" strokeLinejoin="round" />
          <Path d="M19 28H29V40H19V28Z" stroke={color} strokeWidth="4" strokeLinejoin="round" />
        </Svg>
      );
    case "notes":
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path d="M10 6H30L38 14V42C38 43.1 37.1 44 36 44H10C8.9 44 8 43.1 8 42V8C8 6.9 8.9 6 10 6Z" stroke={color} strokeWidth="4" strokeLinejoin="round" />
          <Path d="M16 24H30" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <Path d="M16 30H30" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <Path d="M16 36H24" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <Path d="M28 6V14H38" stroke={color} strokeWidth="4" strokeLinejoin="round" />
        </Svg>
      );
    case "camera":
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path d="M16 10L19 6H29L32 10H40C41.1 10 42 10.9 42 12V38C42 39.1 41.1 40 40 40H8C6.9 40 6 39.1 6 38V12C6 10.9 6.9 10 8 10H16Z" stroke={color} strokeWidth="4" strokeLinejoin="round" />
          <Circle cx="24" cy="26" r="8" stroke={color} strokeWidth="4" />
        </Svg>
      );
    case "folder":
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path d="M5 10C5 8.89543 5.89543 8 7 8L19 8L23 14H41C42.1046 14 43 14.8954 43 16V40C43 41.1046 42.1046 42 41 42H7C5.89543 42 5 41.1046 5 40V10Z" stroke={color} strokeWidth="4" strokeLinejoin="round" />
        </Svg>
      );
    case "write":
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path d="M9 39H39" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <Path d="M12 30L24 10L36 30H12Z" stroke={color} strokeWidth="4" strokeLinejoin="round" />
        </Svg>
      );
    case "plus":
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path d="M24 8V40" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <Path d="M8 24H40" stroke={color} strokeWidth="4" strokeLinecap="round" />
        </Svg>
      );
    case "arrowRight":
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path d="M10 24H38" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <Path d="M26 14L38 24L26 34" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case "arrowLeft":
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path d="M38 24H10" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <Path d="M22 14L10 24L22 34" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    default:
      return null;
  }
}
