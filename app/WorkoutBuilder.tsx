import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Button, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const WorkoutBuilder = () => {
  const [preferences, setPreferences] = useState<any>(null);
  const [workout, setWorkout] = useState<any[]>([]);
  const [loggedWorkout, setLoggedWorkout] = useState<any[]>([]);
  const router = useRouter();

  // Load onboarding preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const jsonValue = await AsyncStorage.getItem('@user_preferences');
        if (jsonValue) setPreferences(JSON.parse(jsonValue));
      } catch (e) {
        console.error('Error loading preferences', e);
      }
    };
    loadPreferences();
  }, []);

  // Generate a sample workout based on preferences
  const generateWorkout = () => {
    if (!preferences) return;

    // Simple placeholder logic: can replace with AI logic later
    let exercises = [];

    if (preferences.goal === 'Hypertrophy') {
      exercises = [
        { name: 'Bench Press', sets: 4, reps: 10, RIR: 2 },
        { name: 'Incline Dumbbell Press', sets: 3, reps: 12, RIR: 2 },
        { name: 'Squat', sets: 4, reps: 10, RIR: 2 },
        { name: 'Pull-ups', sets: 3, reps: 8, RIR: 1 },
      ];
    } else if (preferences.goal === 'Strength') {
      exercises = [
        { name: 'Deadlift', sets: 4, reps: 5, RIR: 1 },
        { name: 'Overhead Press', sets: 4, reps: 5, RIR: 1 },
        { name: 'Front Squat', sets: 4, reps: 5, RIR: 1 },
      ];
    } else if (preferences.goal === 'Fat loss') {
      exercises = [
        { name: 'Burpees', sets: 4, reps: 15, RIR: 1 },
        { name: 'Jump Squats', sets: 4, reps: 15, RIR: 1 },
        { name: 'Push-ups', sets: 4, reps: 12, RIR: 1 },
      ];
    } else {
      exercises = [
        { name: 'Bodyweight Squats', sets: 3, reps: 12, RIR: 2 },
        { name: 'Push-ups', sets: 3, reps: 12, RIR: 2 },
      ];
    }

    // Initialize input values
    const exercisesWithInputs = exercises.map(ex => ({
        ...ex,
        inputSets: ex.sets.toString(),
        inputReps: ex.reps.toString(),
        inputWeight: '',
        inputRIR: ex.RIR.toString(),
    }));

    setWorkout(exercisesWithInputs);
  };

  // Log a single exercise
  const logExercise = async (index: number) => {
    const ex = workout[index];
    const logEntry = {
      name: ex.name,
      sets: parseInt(ex.inputSets),
      reps: parseInt(ex.inputReps),
      weight: parseFloat(ex.inputWeight) || 0,
      RIR: parseInt(ex.inputRIR),
      date: new Date().toISOString(),
    };

    const updatedLoggedWorkout = [...loggedWorkout, logEntry];
    setLoggedWorkout(updatedLoggedWorkout);

    try {
      await AsyncStorage.setItem('@logged_workouts', JSON.stringify(updatedLoggedWorkout));
      alert(`Logged ${ex.name}`);
    } catch (e) {
      console.error('Error saving logged workout', e);
    }
  };

  if (!preferences) {
    return (
      <View style={styles.container}>
        <Text>Loading preferences...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Workout Builder</Text>
        <Text style={styles.subtitle}>
          Experience: {preferences.experience} | Goal: {preferences.goal} | Split: {preferences.split} | Equipment: {preferences.equipment}
        </Text>

        <Button title="Generate Sample Workout" onPress={generateWorkout} />

        {workout.length > 0 && workout.map((ex, idx) => (
          <View key={idx} style={styles.exercise}>
            <Text style={styles.exerciseName}>{ex.name}</Text>

            <View style={styles.row}>
              <Text>Sets:</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={ex.inputSets}
                onChangeText={(text) => {
                  const newWorkout = [...workout];
                  newWorkout[idx].inputSets = text;
                  setWorkout(newWorkout);
                }}
              />
            </View>

            <View style={styles.row}>
              <Text>Reps:</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={ex.inputReps}
                onChangeText={(text) => {
                  const newWorkout = [...workout];
                  newWorkout[idx].inputReps = text;
                  setWorkout(newWorkout);
                }}
              />
            </View>

            <View style={styles.row}>
              <Text>Weight:</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={ex.inputWeight}
                onChangeText={(text) => {
                  const newWorkout = [...workout];
                  newWorkout[idx].inputWeight = text;
                  setWorkout(newWorkout);
                }}
              />
            </View>

            <View style={styles.row}>
              <Text>RIR:</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={ex.inputRIR}
                onChangeText={(text) => {
                  const newWorkout = [...workout];
                  newWorkout[idx].inputRIR = text;
                  setWorkout(newWorkout);
                }}
              />
            </View>

            <Button title="Log Exercise" onPress={() => logExercise(idx)} />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    safeContainer: {flex: 1, backgroundColor: '#fff'}, 
    container: { padding: 20, paddingTop: 50 },
    title: { fontSize: 28, fontWeight: 'bold', marginBottom: 15 },
    subtitle: { fontSize: 16, marginBottom: 20 },
    exercise: {
      padding: 15,
      borderWidth: 1,
      borderColor: '#ccc',
      borderRadius: 6,
      marginBottom: 15,
      backgroundColor: '#f9f9f9',
    },
    exerciseName: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    input: {
      borderWidth: 1,
      borderColor: '#ccc',
      borderRadius: 4,
      padding: 5,
      marginLeft: 10,
      width: 60,
    },
  });

export default WorkoutBuilder;
