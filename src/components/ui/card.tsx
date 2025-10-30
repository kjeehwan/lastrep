import { Colors } from "@/src/styles/colors";
import { View } from "react-native";

export const Card = ({ children }: any) => (
  <View
    style={{
      backgroundColor: Colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 5,
      elevation: 2,
    }}
  >
    {children}
  </View>
);

export const CardContent = ({ children }: any) => (
  <View style={{ gap: 12 }}>{children}</View>
);
