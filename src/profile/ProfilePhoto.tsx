import { Image, type ImageProps } from "expo-image";
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { resolveProfilePhoto } from "./profilePhotos";
import { cloudPhotoPath } from "./profilePhotoReference";

type Props = Omit<ImageProps, "source"> & { uid: string | null; reference: string; initial?: string; fallbackBackgroundColor?: string; fallbackTextColor?: string; fallbackFontFamily?: string };

export function ProfilePhoto({ uid, reference, initial = "L", style, fallbackBackgroundColor = "#263447", fallbackTextColor = "#f4f7ff", fallbackFontFamily, ...props }: Props) {
  const [resolved, setResolved] = useState<{ uid: string; reference: string; uri: string } | null>(null);
  const [failedReference, setFailedReference] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!uid || !reference) return;
    void resolveProfilePhoto(uid, reference).then((uri) => {
      if (active) { setResolved({ uid, reference, uri }); setFailedReference(null); }
    }).catch(() => {
      if (active) setResolved(null);
    });
    return () => { active = false; };
  }, [uid, reference]);
  const uri = !cloudPhotoPath(reference) ? reference : uid && resolved?.uid === uid && resolved?.reference === reference ? resolved.uri : null;
  return uri && failedReference !== reference ? <Image {...props} style={style} source={{ uri }} onError={() => setFailedReference(reference)} /> : (
    <View style={[style, { alignItems: "center", justifyContent: "center", backgroundColor: fallbackBackgroundColor }]}>
      <Text style={{ color: fallbackTextColor, fontSize: 24, fontWeight: fallbackFontFamily ? undefined : "600", fontFamily: fallbackFontFamily }}>{initial}</Text>
    </View>
  );
}
