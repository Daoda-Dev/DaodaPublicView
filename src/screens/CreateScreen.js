import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { auth, db, storage } from "../firebase/firebaseConfig";

export default function CreateScreen() {
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  console.log("CreateScreen rendered"); // ← to confirm this screen is active

 const pickVideo = async () => {
  try {
    console.log("→ Starting permission request...");
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log("Permission status:", status);

    if (status !== "granted") {
      Alert.alert("Permission needed", "We need access to your gallery.");
      return;
    }

    console.log("→ Launching image library...");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: [ImagePicker.MediaType.Video],
      allowsEditing: true,
      quality: 1,
    });

    console.log("Picker result:", result);

    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      if (asset.fileSize > 50 * 1024 * 1024) {
        Alert.alert("Too big", "Video max 50 MB.");
        return;
      }
      setSelectedAsset(asset);
      setProgress(0);
    }
  } catch (error) {
    console.error("Picker full crash:", error);
    Alert.alert("Gallery error", "Couldn't open picker – try restarting app or use dev build.");
  }
};

  const handleUpload = async () => {
    console.log("handleUpload called");
    if (!selectedAsset || !caption.trim()) {
      Alert.alert("Missing", "Video + caption required.");
      return;
    }

    setUploading(true);
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Login required", "Sign in first.");
      setUploading(false);
      return;
    }

    try {
      console.log("Fetching username...");
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const username = userDoc.exists() ? userDoc.data().username : "Anonymous";

      console.log("Fetching video file...");
      const response = await fetch(selectedAsset.uri);
      const blob = await response.blob();
      console.log("Blob created, size:", blob.size);

      const filename = `${Date.now()}_${user.uid}.mp4`;
      const storageRef = ref(storage, `videos/${user.uid}/${filename}`);

      const metadata = { contentType: selectedAsset.mimeType || "video/mp4" };

      console.log("Starting upload...");
      const uploadTask = uploadBytesResumable(storageRef, blob, metadata);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const prog = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setProgress(prog);
        },
        (error) => {
          console.error("Upload error full object:", error);
          console.log("Server response if any:", error.serverResponse);
          Alert.alert("Upload failed", error.message || "Check console for details.");
          setUploading(false);
        },
        async () => {
          console.log("Upload complete, getting URL...");
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          console.log("Saving to Firestore...");
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

          Alert.alert("Done!", "Moment uploaded.");
          setSelectedAsset(null);
          setCaption("");
          setProgress(0);
        }
      );
    } catch (err) {
      console.error("Big catch error:", err);
      Alert.alert("Error", err.message || "Upload prep failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create a Moment</Text>

      <TouchableOpacity style={styles.pickButton} onPress={pickVideo}>
        <Text style={styles.pickText}>
          {selectedAsset ? "Change Video" : "Pick Video from Gallery"}
        </Text>
      </TouchableOpacity>

      {selectedAsset && (
        <Text style={styles.info}>
          Ready ({(selectedAsset.fileSize / (1024 * 1024)).toFixed(1)} MB)
        </Text>
      )}

      <TextInput
        style={styles.captionInput}
        placeholder="Caption..."
        value={caption}
        onChangeText={setCaption}
        multiline
      />

      {uploading && (
        <View style={styles.progressContainer}>
          <Text>Uploading… {progress}%</Text>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>
      )}

      <TouchableOpacity
        style={[styles.uploadButton, uploading && styles.disabled]}
        onPress={handleUpload}
        disabled={uploading}
      >
        <Text style={styles.uploadText}>
          {uploading ? "Uploading..." : "Upload"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// Keep your existing styles (or paste them here if needed)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f2f2f2", justifyContent: "center", padding: 30 },
  title: { fontSize: 28, fontWeight: "bold", color: "red", textAlign: "center", marginBottom: 40 },
  pickButton: { backgroundColor: "red", padding: 18, borderRadius: 12, alignItems: "center", marginBottom: 20 },
  pickText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  info: { textAlign: "center", color: "#555", marginBottom: 20 },
  captionInput: { borderWidth: 1, borderColor: "#ccc", borderRadius: 12, padding: 15, minHeight: 100, marginBottom: 30, backgroundColor: "#fff" },
  progressContainer: { marginBottom: 20 },
  progressBar: { height: 8, backgroundColor: "red", borderRadius: 4 },
  uploadButton: { backgroundColor: "red", padding: 18, borderRadius: 12, alignItems: "center" },
  disabled: { opacity: 0.6 },
  uploadText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
});