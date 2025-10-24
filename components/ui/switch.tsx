import { Colors } from "@/styles/colors";
import { Switch as RNSwitch } from "react-native";

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (val: boolean) => void;
};

export const Switch = ({ checked, onCheckedChange }: SwitchProps) => (
  <RNSwitch
    value={checked}
    onValueChange={onCheckedChange}
    trackColor={{
      false: "#ccc",
      true: Colors.primaryLight + "66", // translucent aqua
    }}
    thumbColor={checked ? Colors.primary : "#f4f3f4"}
  />
);
