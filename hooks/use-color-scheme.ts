import { useAppTheme } from '../src/theme/AppThemeProvider';
export function useColorScheme() { return useAppTheme().colorScheme; }
