import { useRouter } from 'expo-router';
import { Button, Text, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();

  const handleStartWorkout = () => {
    // Navigate to dashboard for now
    router.push('/Dashboard');
    // later: router.push('/workout/start') or similar
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 20, marginBottom: 20 }}>
        Welcome to LastRep
      </Text>
      <Button title="Start Workout" onPress={handleStartWorkout} />
    </View>
  );
}
