import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../theme/tokens';

/** The receipt-scan camera. 2.4px strokes, square ends — same weight as the rules. */
export function CameraIcon({ size = 20, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4}>
      <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <Circle cx={12} cy={13} r={3} />
    </Svg>
  );
}

/** Send — an arrow up, matching the composer's square button. */
export function SendIcon({ size = 18, color = colors.cream }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3}>
      <Path d="M12 19V5" />
      <Path d="m5 12 7-7 7 7" />
    </Svg>
  );
}
