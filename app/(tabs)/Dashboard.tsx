// /app/(tabs)/Dashboard.tsx
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const todaysPlan = [
    { name: 'Bench Press', sets: 4, reps: '8-10' },
    { name: 'Incline Dumbbell Press', sets: 3, reps: '8-12' },
    { name: 'Shoulder Press', sets: 3, reps: '10-12' },
  ];

  const weeklySummary = [
    { day: 'Mon', workouts: 1 },
    { day: 'Tue', workouts: 1 },
    { day: 'Wed', workouts: 0 },
    { day: 'Thu', workouts: 1 },
    { day: 'Fri', workouts: 0 },
    { day: 'Sat', workouts: 1 },
    { day: 'Sun', workouts: 0 },
  ];

  const recentAchievements = [
    { title: 'First Week', earned: true },
    { title: 'Consistency', earned: true },
    { title: 'Strength Milestone', earned: false },
    { title: 'Month Champion', earned: false },
  ];

  const handleStartWorkout = () => {
    router.push('/WorkoutBuilder'); // navigate to WorkoutBuilder
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Start Workout Button */}
        <TouchableOpacity style={styles.startButton} onPress={handleStartWorkout}>
          <Text style={styles.startText}>Start Workout</Text>
        </TouchableOpacity>

        {/* Today's Plan */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Plan</Text>
          {todaysPlan.map((exercise, idx) => (
            <View key={idx} style={styles.row}>
              <Text>{exercise.name}</Text>
              <Text>{exercise.sets} x {exercise.reps}</Text>
            </View>
          ))}
        </View>

        {/* This Week */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>This Week</Text>
          <View style={styles.weekRow}>
            {weeklySummary.map((day, idx) => (
              <View
                key={idx}
                style={[styles.weekDay, day.workouts ? styles.activeDay : styles.inactiveDay]}
              >
                <Text>{day.day}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Achievements */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Achievements</Text>
          <View style={styles.achievementsRow}>
            {recentAchievements.map((ach, idx) => (
              <View
                key={idx}
                style={[styles.achievement, ach.earned ? styles.earned : styles.locked]}
              >
                <Text>{ach.title}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  startButton: { backgroundColor: '#4f46e5', padding: 20, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  startText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  card: { backgroundColor: '#f3f4f6', borderRadius: 12, padding: 15, marginBottom: 20 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  activeDay: { backgroundColor: '#4f46e5', color: '#fff' },
  inactiveDay: { backgroundColor: '#e5e7eb' },
  achievementsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  achievement: { padding: 10, borderRadius: 8, marginRight: 10, marginBottom: 10 },
  earned: { backgroundColor: '#34d399' },
  locked: { backgroundColor: '#d1d5db' },
});
