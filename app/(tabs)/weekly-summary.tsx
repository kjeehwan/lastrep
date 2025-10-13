import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const WeeklySummary = () => {
  const [loggedWorkouts, setLoggedWorkouts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});

  useEffect(() => {
    const loadLoggedWorkouts = async () => {
      try {
        const jsonValue = await AsyncStorage.getItem('@logged_workouts');
        const logs = jsonValue ? JSON.parse(jsonValue) : [];
        setLoggedWorkouts(logs);
      } catch (e) {
        console.error('Error loading logged workouts', e);
      }
    };

    loadLoggedWorkouts();
  }, []);

  useEffect(() => {
    if (loggedWorkouts.length === 0) return;

    // Aggregate by exercise
    const agg: any = {};
    loggedWorkouts.forEach(log => {
      const name = log.name;
      if (!agg[name]) agg[name] = { sets: 0, reps: 0, weight: 0, RIR: 0, count: 0 };
      agg[name].sets += log.sets;
      agg[name].reps += log.reps;
      agg[name].weight += log.weight;
      agg[name].RIR += log.RIR;
      agg[name].count += 1;
    });

    // Compute averages
    const finalSummary: any = {};
    Object.keys(agg).forEach(name => {
      finalSummary[name] = {
        sets: (agg[name].sets / agg[name].count).toFixed(1),
        reps: (agg[name].reps / agg[name].count).toFixed(1),
        weight: (agg[name].weight / agg[name].count).toFixed(1),
        RIR: (agg[name].RIR / agg[name].count).toFixed(1),
      };
    });

    setSummary(finalSummary);
  }, [loggedWorkouts]);

  if (loggedWorkouts.length === 0) {
    return (
      <View style={styles.container}>
        <Text>No workouts logged yet.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Weekly Feedback Summary</Text>
        {Object.keys(summary).map((exercise, idx) => (
          <View key={idx} style={styles.exercise}>
            <Text style={styles.exerciseName}>{exercise}</Text>
            <Text>Avg Sets: {summary[exercise].sets}</Text>
            <Text>Avg Reps: {summary[exercise].reps}</Text>
            <Text>Avg Weight: {summary[exercise].weight} kg</Text>
            <Text>Avg RIR: {summary[exercise].RIR}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: { flex:  1, backgroundColor: '#fff' },
  container: { padding: 20, paddingTop: 20 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
  exercise: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
  },
  exerciseName: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
});

export default WeeklySummary;