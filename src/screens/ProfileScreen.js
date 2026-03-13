// src/screens/ProfileScreen.js
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { auth, db, storage } from "../firebase/firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { signOut } from "firebase/auth";
import { Ionicons } from "@expo/vector-icons";

// ─── Constants ────────────────────────────────────────────────────────────────
const PINK = "#E8447A";
const BG = "#fdf0f5";
const DARK = "#2A1520";
const MID = "#7A4460";
const SOFT = "#B08099";
const BORDER = "#f0c8dc";
const TOP_GAP = Dimensions.get("window").height * 0.05;

const DEFAULT_INTERESTS = [
  "Technology", "Arts", "Music", "Business",
  "Science", "Travel", "Literature", "Film",
  "Sports", "Fashion", "Cooking",
];
const DEFAULT_HOBBIES = [
  "Reading", "Hiking", "Photography", "Painting",
  "Gaming", "Yoga", "Dancing", "Writing", "Cycling",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uriToBlob = (uri) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error("Failed to convert URI to blob"));
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });

const uploadImage = async (uri, path) => {
  const blob = await uriToBlob(uri);
  const storageRef = ref(storage, path);
  await new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, blob);
    task.on("state_changed", null, reject, () => {
      blob.close?.();   // free memory
      resolve();
    });
  });
  return await getDownloadURL(storageRef);
};

// ─── Chip component ───────────────────────────────────────────────────────────
function ChipGroup({ chips, onToggle, onAdd, maxActive = 5 }) {
  return (
    <View style={chipStyles.wrap}>
      {chips.map((chip, i) => (
        <TouchableOpacity
          key={chip.label + i}
          onPress={() => onToggle(i)}
          style={[chipStyles.chip, chip.active && chipStyles.chipActive]}
          activeOpacity={0.75}
        >
          <Text style={[chipStyles.chipText, chip.active && chipStyles.chipTextActive]}>
            {chip.label}
          </Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity onPress={onAdd} style={chipStyles.chipAdd}>
        <Text style={chipStyles.chipAddText}>+ add</Text>
      </TouchableOpacity>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  chip: {
    paddingHorizontal: 11, paddingVertical: 5,
    borderRadius: 50, borderWidth: 1,
    borderColor: BORDER, backgroundColor: BG,
  },
  chipActive: { backgroundColor: PINK, borderColor: PINK },
  chipText: { fontSize: 12, color: MID },
  chipTextActive: { color: "#fff" },
  chipAdd: {
    paddingHorizontal: 11, paddingVertical: 5,
    borderRadius: 50, borderWidth: 1,
    borderStyle: "dashed", borderColor: BORDER,
  },
  chipAddText: { fontSize: 12, color: SOFT },
});

// ─── Spark Question Card ───────────────────────────────────────────────────────
function SparkCard({ badge, badgeStyle, prompt, sub, value, onChangeText, charId, cardStyle, textareaStyle }) {
  const MAX = 200;
  return (
    <View style={[sparkStyles.card, cardStyle]}>
      <View style={[sparkStyles.blob, cardStyle?.blobStyle]} />
      <View style={[sparkStyles.badge, badgeStyle]}>
        <Text style={[sparkStyles.badgeText, badgeStyle?.textStyle]}>{badge}</Text>
      </View>
      <Text style={sparkStyles.prompt} allowFontScaling={false}>{prompt}</Text>
      <Text style={sparkStyles.sub}>{sub}</Text>
      <TextInput
        style={[sparkStyles.textarea, textareaStyle]}
        multiline
        maxLength={MAX}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor="#c9a0b5"
        textAlignVertical="top"
      />
      <Text style={sparkStyles.count}>{value.length} / {MAX}</Text>
    </View>
  );
}

const sparkStyles = StyleSheet.create({
  card: {
    borderRadius: 18, padding: 14,
    marginBottom: 9, borderWidth: 1,
    overflow: "hidden",
  },
  blob: {
    position: "absolute", top: -22, right: -22,
    width: 72, height: 72, borderRadius: 36, opacity: 0.3,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 50, marginBottom: 8,
  },
  badgeText: {
    fontSize: 10, fontWeight: "500",
    letterSpacing: 0.7, textTransform: "uppercase",
  },
  prompt: {
    fontSize: 15, fontWeight: "500",
    color: DARK, lineHeight: 22,
    marginBottom: 5, fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  sub: {
    fontSize: 11, color: SOFT,
    marginBottom: 9, lineHeight: 16, fontStyle: "italic",
  },
  textarea: {
    padding: 9, paddingHorizontal: 11,
    fontSize: 12, borderWidth: 1,
    borderRadius: 10, minHeight: 58,
    lineHeight: 18, backgroundColor: "rgba(255,255,255,0.7)",
    color: DARK,
  },
  count: { fontSize: 10, color: SOFT, textAlign: "right", marginTop: 3 },
});

// ─── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ visible, message }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: visible ? 1 : 0, useNativeDriver: true }).start();
  }, [visible]);
  return (
    <Animated.View
      style={[
        toastStyles.toast,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}
      pointerEvents="none"
    >
      <Text style={toastStyles.text}>{message}</Text>
    </Animated.View>
  );
}
const toastStyles = StyleSheet.create({
  toast: {
    position: "absolute", bottom: 90,
    alignSelf: "center",
    backgroundColor: DARK, borderRadius: 50,
    paddingHorizontal: 18, paddingVertical: 8,
    zIndex: 999,
  },
  text: { color: "#fff", fontSize: 12 },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);

  // About
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [education, setEducation] = useState("");
  const [occupation, setOccupation] = useState("");

  // Photos
  const [avatarUri, setAvatarUri] = useState(null);   // local URI or remote URL
  const [gridPhotos, setGridPhotos] = useState([null, null, null]);

  // Chips
  const initChips = (labels, active = []) =>
    labels.map((l) => ({ label: l, active: active.includes(l) }));
  const [interests, setInterests] = useState(initChips(DEFAULT_INTERESTS));
  const [hobbies, setHobbies] = useState(initChips(DEFAULT_HOBBIES));

  // Spark questions
  const [memory, setMemory] = useState("");
  const [happiness, setHappiness] = useState("");
  const [dreamSelf, setDreamSelf] = useState("");

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const d = snap.data();
        setName(d.name || "");
        setAge(d.age ? String(d.age) : "");
        setBio(d.bio || "");
        setLocation(d.location || "");
        setEducation(d.education || "");
        setOccupation(d.occupation || "");
        if (d.avatarUrl) setAvatarUri(d.avatarUrl);
        if (d.gridPhotos) setGridPhotos(d.gridPhotos);
        if (d.interests) setInterests(initChips(
          [...DEFAULT_INTERESTS, ...(d.interests.filter(i => !DEFAULT_INTERESTS.includes(i)))],
          d.interests
        ));
        if (d.hobbies) setHobbies(initChips(
          [...DEFAULT_HOBBIES, ...(d.hobbies.filter(h => !DEFAULT_HOBBIES.includes(h)))],
          d.hobbies
        ));
        setMemory(d.memory || "");
        setHappiness(d.happiness || "");
        setDreamSelf(d.dreamSelf || "");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ── Pick photo ────────────────────────────────────────────────────────────
  const pickPhoto = async (onPick) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "We need access to your gallery.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets?.length > 0) {
      onPick(result.assets[0].uri);
    }
  };

  const pickAvatar = () => pickPhoto(setAvatarUri);
  const pickGridPhoto = (i) =>
    pickPhoto((uri) => {
      const updated = [...gridPhotos];
      updated[i] = uri;
      setGridPhotos(updated);
    });

  // ── Chips ─────────────────────────────────────────────────────────────────
  const toggleChip = (setFn, chips, index, maxActive = 5) => {
    const activeCount = chips.filter((c) => c.active).length;
    const chip = chips[index];
    if (!chip.active && activeCount >= maxActive) {
      showToast("Max 5 selected");
      return;
    }
    const updated = chips.map((c, i) => i === index ? { ...c, active: !c.active } : c);
    setFn(updated);
  };

  const addChip = (setFn, chips) => {
    Alert.prompt(
      "Add your own",
      "Enter a custom tag",
      (val) => {
        if (!val?.trim()) return;
        setFn([...chips, { label: val.trim(), active: true }]);
      },
      "plain-text"
    );
  };

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(false), 2500);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const saveProfile = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setSaving(true);

    try {
      let avatarUrl = avatarUri;
      // Upload avatar if it's a local URI (not a remote URL)
      if (avatarUri && avatarUri.startsWith("file")) {
        avatarUrl = await uploadImage(
          avatarUri,
          `avatars/${user.uid}/main.jpg`
        );
      }

      // Upload grid photos
      const savedGridPhotos = await Promise.all(
        gridPhotos.map(async (uri, i) => {
          if (uri && uri.startsWith("file")) {
            return await uploadImage(uri, `avatars/${user.uid}/grid_${i}.jpg`);
          }
          return uri;
        })
      );

      await setDoc(
        doc(db, "users", user.uid),
        {
          name: name.trim(),
          age: age ? parseInt(age) : null,
          bio: bio.trim(),
          location: location.trim(),
          education: education.trim(),
          occupation: occupation.trim(),
          avatarUrl: avatarUrl || null,
          gridPhotos: savedGridPhotos,
          interests: interests.filter((c) => c.active).map((c) => c.label),
          hobbies: hobbies.filter((c) => c.active).map((c) => c.label),
          memory: memory.trim(),
          happiness: happiness.trim(),
          dreamSelf: dreamSelf.trim(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      showToast("Profile saved 🌸");
    } catch (err) {
      Alert.alert("Error", err.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Log out?", "Are you sure?", [
      { text: "Cancel" },
      { text: "Yes", style: "destructive", onPress: () => signOut(auth) },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={PINK} size="large" />
        <Text style={styles.loadingText}>Loading your profile…</Text>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root}>
      {/* ── Top bar ── */}
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.tbBack} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={16} color={PINK} />
        </TouchableOpacity>
        <Text style={styles.tbTitle}>Edit Profile</Text>
        <TouchableOpacity
          style={[styles.tbSave, saving && { opacity: 0.6 }]}
          onPress={saveProfile}
          disabled={saving}
        >
          <Text style={styles.tbSaveText}>{saving ? "…" : "Save"}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={60}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Photo hero ── */}
          <View style={styles.photoHero}>
            <TouchableOpacity onPress={pickAvatar} style={styles.avatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarRing} />
              ) : (
                <LinearGradient
                  colors={["#E8447A", "#f472a8"]}
                  style={styles.avatarRing}
                >
                  <Text style={styles.avatarInitial}>
                    {name ? name[0].toUpperCase() : "A"}
                  </Text>
                </LinearGradient>
              )}
              <View style={styles.avEdit}>
                <Ionicons name="camera" size={11} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={styles.photoHint}>Tap to update your main photo</Text>

            {/* Grid photos */}
            <View style={styles.pgrid}>
              {[0, 1, 2].map((i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.pslot, gridPhotos[i] && styles.pslotFilled]}
                  onPress={() => pickGridPhoto(i)}
                >
                  {gridPhotos[i] ? (
                    <Image source={{ uri: gridPhotos[i] }} style={styles.pslotImg} />
                  ) : (
                    <Ionicons name="add" size={16} color={BORDER} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── About card ── */}
          <View style={styles.card}>
            <View style={styles.secLabel}>
              <Text style={styles.secLabelText}>About me</Text>
            </View>

            <View style={styles.row}>
              <View style={[styles.field, { flex: 1.5, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor="#c9a0b5"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Age</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={age}
                  onChangeText={setAge}
                  placeholder="24"
                  placeholderTextColor="#c9a0b5"
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Bio</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldTextarea]}
                value={bio}
                onChangeText={setBio}
                placeholder="Something real about you…"
                placeholderTextColor="#c9a0b5"
                multiline
                maxLength={140}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{bio.length} / 140</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Location</Text>
              <TextInput
                style={styles.fieldInput}
                value={location}
                onChangeText={setLocation}
                placeholder="City, Country"
                placeholderTextColor="#c9a0b5"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Education</Text>
              <TextInput
                style={styles.fieldInput}
                value={education}
                onChangeText={setEducation}
                placeholder="e.g. BSc Psychology, TU"
                placeholderTextColor="#c9a0b5"
              />
            </View>

            <View style={[styles.field, { marginBottom: 0 }]}>
              <Text style={styles.fieldLabel}>Occupation</Text>
              <TextInput
                style={styles.fieldInput}
                value={occupation}
                onChangeText={setOccupation}
                placeholder="e.g. Graphic Designer"
                placeholderTextColor="#c9a0b5"
              />
            </View>
          </View>

          {/* ── Interests ── */}
          <View style={styles.card}>
            <View style={styles.secLabel}>
              <Text style={styles.secLabelText}>Fields of interest</Text>
            </View>
            <Text style={styles.chipNote}>Pick up to 5</Text>
            <ChipGroup
              chips={interests}
              onToggle={(i) => toggleChip(setInterests, interests, i, 5)}
              onAdd={() => addChip(setInterests, interests)}
              maxActive={5}
            />
          </View>

          {/* ── Hobbies ── */}
          <View style={styles.card}>
            <View style={styles.secLabel}>
              <Text style={styles.secLabelText}>Hobbies</Text>
            </View>
            <Text style={styles.chipNote}>What fills your free time?</Text>
            <ChipGroup
              chips={hobbies}
              onToggle={(i) => toggleChip(setHobbies, hobbies, i, 10)}
              onAdd={() => addChip(setHobbies, hobbies)}
            />
          </View>

          {/* ── Spark Questions ── */}
          <View style={styles.sparkHeadingRow}>
            <Text style={styles.sparkHeading}>✦ Spark questions</Text>
            <Text style={styles.sparkSub}>makes people want to message you</Text>
          </View>

          {/* Q1 Memory */}
          <SparkCard
            badge="✦ Memory"
            badgeStyle={{ backgroundColor: "#fcd6e6", textStyle: { color: "#b83368" } }}
            prompt={"A smell, song, or place that instantly teleports you back — where do you go?"}
            sub="The tiny things that made us feel alive before we knew the world was complicated."
            value={memory}
            onChangeText={setMemory}
            cardStyle={{
              backgroundColor: "#fff5f9",
              borderColor: "#fcd6e6",
              blobStyle: { backgroundColor: "#f9c6d8" },
            }}
            textareaStyle={{ borderColor: "#fcd6e6" }}
          />

          {/* Q2 Happiness */}
          <SparkCard
            badge="☀ Happiness"
            badgeStyle={{ backgroundColor: "#fde8c6", textStyle: { color: "#a05c18" } }}
            prompt={"Your happiest ordinary day — the one that felt like nothing but was secretly everything."}
            sub="Not a trip abroad or a big event. A quiet Tuesday that somehow made your chest full."
            value={happiness}
            onChangeText={setHappiness}
            cardStyle={{
              backgroundColor: "#fffaf4",
              borderColor: "#fde8c6",
              blobStyle: { backgroundColor: "#fde8c6" },
            }}
            textareaStyle={{ borderColor: "#fde8c6" }}
          />

          {/* Q3 Dream self */}
          <SparkCard
            badge="✧ Dream self"
            badgeStyle={{ backgroundColor: "#d6e4fd", textStyle: { color: "#2858b8" } }}
            prompt={"What would your 10-year-old self be most surprised to know about you today?"}
            sub="Our past selves hold truths our present selves quietly forget."
            value={dreamSelf}
            onChangeText={setDreamSelf}
            cardStyle={{
              backgroundColor: "#f6f8ff",
              borderColor: "#d6e4fd",
              blobStyle: { backgroundColor: "#d6e4fd" },
            }}
            textareaStyle={{ borderColor: "#d6e4fd" }}
          />

          {/* bottom spacer for sticky bar */}
          <View style={{ height: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Sticky Save Button ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.65 }]}
          onPress={saveProfile}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save Profile 🌸</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Toast ── */}
      <Toast visible={!!toast} message={typeof toast === "string" ? toast : ""} />
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  loadingScreen: {
    flex: 1, backgroundColor: BG,
    justifyContent: "center", alignItems: "center", gap: 12,
  },
  loadingText: { color: SOFT, fontSize: 14 },

  // Topbar
  topbar: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: TOP_GAP, paddingBottom: 10,
    backgroundColor: "rgba(253,240,245,0.95)",
    borderBottomWidth: 0.5, borderBottomColor: BORDER,
  },
  tbBack: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    backgroundColor: "#fff",
    justifyContent: "center", alignItems: "center",
  },
  tbTitle: {
    fontSize: 17, fontWeight: "500",
    color: DARK, fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    letterSpacing: 0.3,
  },
  tbSave: {
    backgroundColor: PINK, paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 50,
  },
  tbSaveText: { color: "#fff", fontSize: 12, fontWeight: "500" },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 24 },

  // Photo hero
  photoHero: { alignItems: "center", marginBottom: 16 },
  avatarWrap: { position: "relative", marginBottom: 7 },
  avatarRing: {
    width: 90, height: 90, borderRadius: 45,
    justifyContent: "center", alignItems: "center",
    borderWidth: 3, borderColor: "#fff",
    overflow: "hidden",
  },
  avatarInitial: {
    fontSize: 34, fontWeight: "500", color: "#fff",
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  avEdit: {
    position: "absolute", bottom: 1, right: 1,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: PINK, borderWidth: 2, borderColor: "#fff",
    justifyContent: "center", alignItems: "center",
  },
  photoHint: { fontSize: 11, color: SOFT },
  pgrid: {
    flexDirection: "row", gap: 6,
    marginTop: 12, width: "100%",
  },
  pslot: {
    flex: 1, aspectRatio: 1, borderRadius: 11,
    borderWidth: 1.5, borderStyle: "dashed", borderColor: BORDER,
    backgroundColor: "#fff",
    justifyContent: "center", alignItems: "center",
    overflow: "hidden",
  },
  pslotFilled: { borderStyle: "solid", borderColor: "#f9c6d8" },
  pslotImg: { width: "100%", height: "100%", borderRadius: 10 },

  // Cards
  card: {
    backgroundColor: "#fff", borderRadius: 18,
    padding: 14, marginBottom: 9,
    borderWidth: 0.5, borderColor: BORDER,
  },
  secLabel: {
    flexDirection: "row", alignItems: "center",
    marginBottom: 10,
  },
  secLabelText: {
    fontSize: 10, fontWeight: "500",
    letterSpacing: 1, textTransform: "uppercase",
    color: PINK, marginRight: 6,
  },

  // Fields
  row: { flexDirection: "row" },
  field: { marginBottom: 10 },
  fieldLabel: {
    fontSize: 11, fontWeight: "500",
    color: MID, marginBottom: 4,
  },
  fieldInput: {
    paddingHorizontal: 11, paddingVertical: 9,
    fontSize: 13, borderWidth: 1, borderColor: BORDER,
    borderRadius: 10, backgroundColor: BG, color: DARK,
  },
  fieldTextarea: { minHeight: 62, textAlignVertical: "top", paddingTop: 9 },
  charCount: { fontSize: 10, color: SOFT, textAlign: "right", marginTop: 3 },

  // Chips
  chipNote: { fontSize: 11, color: SOFT, marginBottom: 7 },

  // Spark
  sparkHeadingRow: {
    flexDirection: "row", alignItems: "center",
    gap: 7, marginVertical: 10, marginLeft: 2,
  },
  sparkHeading: {
    fontSize: 16, fontWeight: "500", color: DARK,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  sparkSub: { fontSize: 11, color: SOFT },

  // Bottom bar
  bottomBar: {
    backgroundColor: "rgba(253,240,245,0.97)",
    borderTopWidth: 0.5, borderTopColor: BORDER,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 20,
  },
  saveBtn: {
    borderRadius: 50, paddingVertical: 13,
    alignItems: "center", justifyContent: "center",
    backgroundColor: PINK,
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "500" },
});