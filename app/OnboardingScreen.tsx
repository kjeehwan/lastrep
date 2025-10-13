import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  onFinish: (userInfo: {
    name: string;
    age: string;
    gender: 'male' | 'female' | 'LGBTQIA+' | 'Prefer not to say';
    height: string;
    weight: string;
    unit: 'kg/cm' | 'lbs/in';
  }) => void;
};

export default function OnboardingScreen({ onFinish }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<
    'female' | 'male' | 'LGBTQIA+' | 'Prefer not to say' | null
  >(null);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [unit, setUnit] = useState<'kg/cm' | 'lbs/in' | null>(null);

  const handleFinish = () => {
    if (name && age && gender && weight && height && unit) {
      onFinish({ name, age, gender, weight, height, unit });
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Welcome to LastRep!</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your Name"
        />

        <Text style={styles.label}>Age</Text>
        <TextInput
          style={styles.input}
          value={age}
          onChangeText={setAge}
          keyboardType="numeric"
          placeholder="Years"
        />

        <Text style={styles.label}>Gender</Text>
        <View style={styles.buttonRow}>
          {['female', 'male', 'LGBTQIA+', 'Prefer not to say'].map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.optionButton, gender === g && styles.selectedButton]}
              onPress={() => setGender(g as 'female' | 'male' | 'LGBTQIA+' | 'Prefer not to say')}
            >
              <Text style={[styles.optionText, gender === g && styles.selectedText]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Units</Text>
        <View style={styles.buttonRow}>
          {['kg/cm', 'lbs/in'].map((u) => (
            <TouchableOpacity
              key={u}
              style={[styles.optionButton, unit === u && styles.selectedButton]}
              onPress={() => setUnit(u as 'kg/cm' | 'lbs/in')}
            >
              <Text style={[styles.optionText, unit === u && styles.selectedText]}>{u}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Height</Text>
        <TextInput
          style={styles.input}
          value={height}
          onChangeText={setHeight}
          keyboardType="numeric"
          placeholder="e.g., 180"
        />

        <Text style={styles.label}>Weight</Text>
        <TextInput
          style={styles.input}
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
          placeholder="e.g., 75"
        />
        
        <TouchableOpacity
          style={[styles.finishButton, !(name && age && gender && weight && height && unit) && styles.disabledButton]}
          onPress={handleFinish}
          disabled={!(name && age && gender && weight && height && unit)}
        >
          <Text style={styles.finishText}>Finish</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 16, marginTop: 15 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginTop: 5 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  optionButton: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, alignItems: 'center' },
  selectedButton: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  optionText: { color: '#000' },
  selectedText: { color: '#fff' },
  finishButton: { marginTop: 30, padding: 15, backgroundColor: '#4f46e5', borderRadius: 8, alignItems: 'center' },
  disabledButton: { backgroundColor: '#a5b4fc' },
  finishText: { color: '#fff', fontWeight: 'bold' },
});
