import { Redirect, useLocalSearchParams } from "expo-router";
export default function Program() {
  const { create }=useLocalSearchParams<{create?:string}>();
  return <Redirect href={{pathname:"/(tabs)/workout/log",params:{programAction:create==="1"?"create":"library"}}} />;
}
