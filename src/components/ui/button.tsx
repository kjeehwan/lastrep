import { Colors } from "@/src/styles/colors";
import { Text, TouchableOpacity } from "react-native";

type ButtonProps = {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: "default" | "outline" | "danger";
};

export const Button = ({ children, onPress, variant = "default" }: ButtonProps) => {
  let backgroundColor = Colors.primary;
  let textColor = Colors.surface;
  let borderColor = Colors.primary;

  if (variant === "outline") {
    backgroundColor = Colors.surface;
    textColor = Colors.primary;
  } else if (variant === "danger") {
    backgroundColor = "#EF4444";
    borderColor = "#EF4444";
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor,
        borderColor,
        borderWidth: variant === "outline" ? 1 : 0,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 20,
        marginVertical: 4,
      }}
    >
      <Text
        style={{
          color: textColor,
          textAlign: "center",
          fontWeight: "600",
          fontSize: 16,
        }}
      >
        {children}
      </Text>
    </TouchableOpacity>
  );
};
