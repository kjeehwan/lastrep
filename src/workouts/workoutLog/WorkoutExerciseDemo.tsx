import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import type { ExerciseCatalogItem } from "../exerciseCatalog";
import type { createStyles } from "./workoutLogStyles";
export function WorkoutExerciseDemo({
  styles,
  activeDemoExercise,
  activeDemoImageUris,
  closeExerciseDemo,
}: {
  styles: ReturnType<typeof createStyles>;
  activeDemoExercise: ExerciseCatalogItem | null;
  activeDemoImageUris: string[];
  closeExerciseDemo: () => void;
}) {
  return (
    <>
      <Text style={styles.modalTitle}>
        {activeDemoExercise?.name ?? "Exercise Demo"}
      </Text>
      {activeDemoImageUris.length ? (
        <View style={styles.demoImageRow}>
          {activeDemoImageUris.slice(0, 2).map((image, index) => (
            <Image
              key={`remote-demo-${index}-${image}`}
              source={image}
              style={styles.demoImage}
              contentFit="cover"
            />
          ))}
        </View>
      ) : activeDemoExercise?.demoImages?.length ? (
        <View style={styles.demoImageRow}>
          {activeDemoExercise.demoImages.slice(0, 2).map((image, index) => (
            <Image
              key={`${activeDemoExercise.id}-demo-${index}`}
              source={image}
              style={styles.demoImage}
              contentFit="cover"
            />
          ))}
        </View>
      ) : (
        <Text style={styles.modalText}>No images available yet.</Text>
      )}
      {(activeDemoExercise?.cues ?? []).slice(0, 3).map((cue) => (
        <Text key={`${activeDemoExercise?.id}-${cue}`} style={styles.modalText}>
          - {cue}
        </Text>
      ))}
      <TouchableOpacity
        style={[styles.secondaryButton, { marginTop: 12 }]}
        onPress={closeExerciseDemo}
      >
        <Text style={styles.secondaryText}>Close</Text>
      </TouchableOpacity>
    </>
  );
}
