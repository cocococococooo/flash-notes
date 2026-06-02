import React from "react";
import Svg, { Path, Circle, Rect } from "react-native-svg";

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
    case "more":
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Circle cx="24" cy="10" r="4" fill={color} />
          <Circle cx="24" cy="24" r="4" fill={color} />
          <Circle cx="24" cy="38" r="4" fill={color} />
        </Svg>
      );
    case "search":
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Circle cx="22" cy="22" r="14" stroke={color} strokeWidth="4" />
          <Path d="M32 32L42 42" stroke={color} strokeWidth="4" strokeLinecap="round" />
        </Svg>
      );
    case "checkSquare":
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Rect x="6" y="6" width="36" height="36" rx="4" stroke={color} strokeWidth="4" />
          <Path d="M14 24L22 32L36 16" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case "edit":
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path d="M8 40H14L36 18L30 12L8 34V40Z" stroke={color} strokeWidth="4" strokeLinejoin="round" />
          <Path d="M30 12L36 18" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <Path d="M34 6L42 14L36 20L28 12L34 6Z" stroke={color} strokeWidth="4" strokeLinejoin="round" />
        </Svg>
      );
    case "check":
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path d="M12 24L20 32L36 14" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case "share":
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Circle cx="36" cy="12" r="6" stroke={color} strokeWidth="4" />
          <Circle cx="12" cy="24" r="6" stroke={color} strokeWidth="4" />
          <Circle cx="36" cy="36" r="6" stroke={color} strokeWidth="4" />
          <Path d="M17 21L31 15" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <Path d="M17 27L31 33" stroke={color} strokeWidth="4" strokeLinecap="round" />
        </Svg>
      );
    case "undo":
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path d="M8 22H30C36.627 22 42 27.373 42 34C42 40.627 36.627 46 30 46H24" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <Path d="M16 14L8 22L16 30" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case "redo":
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path d="M40 22H18C11.373 22 6 27.373 6 34C6 40.627 11.373 46 18 46H24" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <Path d="M32 14L40 22L32 30" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case "image":
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Rect x="6" y="6" width="36" height="36" rx="4" stroke={color} strokeWidth="4" />
          <Circle cx="16" cy="16" r="4" stroke={color} strokeWidth="4" />
          <Path d="M6 34L16 24L24 32L32 22L42 34" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case "list":
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path d="M14 12H42" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <Path d="M14 24H42" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <Path d="M14 36H42" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <Circle cx="6" cy="12" r="2" fill={color} />
          <Circle cx="6" cy="24" r="2" fill={color} />
          <Circle cx="6" cy="36" r="2" fill={color} />
        </Svg>
      );
    case "close":
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path d="M12 12L36 36" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <Path d="M36 12L12 36" stroke={color} strokeWidth="4" strokeLinecap="round" />
        </Svg>
      );
    case "refresh":
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path d="M8 24C8 15.1634 15.1634 8 24 8C29.2907 8 33.9575 10.4571 37 14.1964" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <Path d="M40 24C40 32.8366 32.8366 40 24 40C18.7093 40 14.0425 37.5429 11 33.8036" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <Path d="M37 6V14H29" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M11 42V34H19" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    default:
      return null;
  }
}
