import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, SafeAreaView, ScrollView, Dimensions, ActivityIndicator, Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { auth, db, storage } from "../firebase/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";

// ─── Constants ─────────────────────────────────────────────────────────────────
const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const TOP_GAP = SCREEN_HEIGHT * 0.05;
const PINK = "#E8447A";
const BG = "#fdf0f5";
const DARK = "#2A1520";
const SOFT = "#B08099";
const BORDER = "#f0c8dc";

export default function CreateScreen() {
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const pickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "We need access to your gallery.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsEditing: true,
        quality: 1,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        if (asset.fileSize > 50 * 1024 * 1024) {
          Alert.alert("Too large", "Maximum video size is 50 MB.");
          return;
        }
        setSelectedAsset(asset);
        setProgress(0);
      }
    } catch (error) {
      Alert.alert("Gallery error", "Couldn't open picker — try restarting the app.");
    }
  };

  const handleUpload = async () => {
    if (!selectedAsset || !caption.trim()) {
      Alert.alert("Missing", "Please select a video and add a caption.");
      return;
    }
    setUploading(true);
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Not logged in", "Sign in first.");
      setUploading(false);
      return;
    }
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const username = userDoc.exists() ? userDoc.data().username : "Anonymous";

      const blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new Error("Failed to read video file"));
        xhr.responseType = "blob";
        xhr.open("GET", selectedAsset.uri, true);
        xhr.send(null);
      });

      const filename = `${Date.now()}_${user.uid}.mp4`;
      const storageRef = ref(storage, `videos/${user.uid}/${filename}`);
      const metadata = { contentType: selectedAsset.mimeType || "video/mp4" };
      const uploadTask = uploadBytesResumable(storageRef, blob, metadata);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          setProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        },
        (error) => {
          Alert.alert("Upload failed", error.message || "Unknown error.");
          setUploading(false);
        },
        async () => {
          blob.close?.();
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, "videos"), {
            videoUrl: downloadURL,
            caption: caption.trim(),
            username,
            uid: user.uid,
            createdAt: serverTimestamp(),
            likesCount: 0,
            likedBy: [],
            comments: [],
          });
          Alert.alert("Posted! 🌸", "Your moment is now live.");
          setSelectedAsset(null);
          setCaption("");
          setProgress(0);
          setUploading(false);
        }
      );
    } catch (err) {
      Alert.alert("Error", err.message || "Upload prep failed.");
      setUploading(false);
    }
  };

  const sizeMB = selectedAsset ? (selectedAsset.fileSize / (1024 * 1024)).toFixed(1) : null;

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>New Moment</Text>
          <Text style={styles.headerSub}>Share a video with your community</Text>
        </View>

        {/* ── Video picker card ── */}
        <TouchableOpacity
          style={[styles.pickerCard, selectedAsset && styles.pickerCardFilled]}
          onPress={pickVideo}
          activeOpacity={0.8}
        >
          {selectedAsset ? (
            <View style={styles.pickerFilled}>
              <View style={styles.pickerIconWrap}>
                <Ionicons name="checkmark-circle" size={34} color={PINK} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerFilledTitle}>Video selected ✓</Text>
                <Text style={styles.pickerFilledSub}>{sizeMB} MB · tap to change</Text>
              </View>
              <Ionicons name="swap-horizontal-outline" size={18} color={SOFT} />
            </View>
          ) : (
            <View style={styles.pickerEmpty}>
              <View style={styles.pickerIconWrap}>
                <Ionicons name="cloud-upload-outline" size={34} color={PINK} />
              </View>
              <Text style={styles.pickerEmptyTitle}>Pick a video</Text>
              <Text style={styles.pickerEmptySub}>MP4 · up to 50 MB</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Caption card ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Caption</Text>
            <Text style={styles.charCount}>{caption.length} / 200</Text>
          </View>
          <TextInput
            style={styles.captionInput}
            placeholder="What's this moment about?…"
            placeholderTextColor="#c9a0b5"
            value={caption}
            onChangeText={(t) => setCaption(t.slice(0, 200))}
            multiline
            maxLength={200}
            textAlignVertical="top"
          />
        </View>

        {/* ── Progress ── */}
        {uploading && (
          <View style={styles.card}>
            <View style={styles.progressHeader}>
              <Ionicons name="cloud-upload-outline" size={14} color={PINK} />
              <Text style={styles.progressLabel}>Uploading… {progress}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          </View>
        )}

        {/* ── Upload button ── */}
        <TouchableOpacity
          style={[styles.uploadBtn, (uploading || !selectedAsset) && styles.uploadBtnDisabled]}
          onPress={handleUpload}
          disabled={uploading || !selectedAsset}
          activeOpacity={0.85}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="sparkles-outline" size={18} color="#fff" />
              <Text style={styles.uploadBtnText}>Post Moment</Text>
            </>
          )}
        </TouchableOpacity>

        {selectedAsset && !uploading && (
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => { setSelectedAsset(null); setCaption(""); setProgress(0); }}
          >
            <Text style={styles.resetText}>Clear</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { padding: 16, paddingTop: TOP_GAP },

  header: { marginBottom: 22, alignItems: "center" },
  headerTitle: {
    fontSize: 26, fontWeight: "700", color: DARK,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    marginBottom: 4,
  },
  headerSub: { fontSize: 13, color: SOFT },

  pickerCard: {
    backgroundColor: "#fff", borderRadius: 18,
    borderWidth: 1.5, borderColor: BORDER, borderStyle: "dashed",
    marginBottom: 12, overflow: "hidden",
  },
  pickerCardFilled: { borderStyle: "solid", borderColor: "#f9c6d8" },
  pickerEmpty: { alignItems: "center", paddingVertical: 36, gap: 8 },
  pickerFilled: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 16,
  },
  pickerIconWrap: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: "#fce8ef", justifyContent: "center", alignItems: "center",
  },
  pickerEmptyTitle: { fontSize: 15, fontWeight: "700", color: DARK },
  pickerEmptySub: { fontSize: 12, color: SOFT },
  pickerFilledTitle: { fontSize: 14, fontWeight: "700", color: DARK, marginBottom: 2 },
  pickerFilledSub: { fontSize: 11, color: SOFT },

  card: {
    backgroundColor: "#fff", borderRadius: 18,
    borderWidth: 0.5, borderColor: BORDER, padding: 14, marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardLabel: { fontSize: 11, fontWeight: "600", color: SOFT, textTransform: "uppercase", letterSpacing: 0.7 },
  charCount: { fontSize: 10, color: "#c9a0b5" },
  captionInput: { fontSize: 14, color: DARK, minHeight: 90, lineHeight: 20 },

  progressHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  progressLabel: { fontSize: 12, color: DARK, fontWeight: "500" },
  progressTrack: { height: 6, backgroundColor: BG, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: PINK, borderRadius: 3 },

  uploadBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: PINK, borderRadius: 50, paddingVertical: 15, marginBottom: 10,
    shadowColor: PINK, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8,
    elevation: 4,
  },
  uploadBtnDisabled: { opacity: 0.5, shadowOpacity: 0 },
  uploadBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  resetBtn: { alignItems: "center", paddingVertical: 8 },
  resetText: { color: SOFT, fontSize: 13 },
});