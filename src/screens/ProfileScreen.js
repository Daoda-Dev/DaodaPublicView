import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView, // ← added so content doesn't get cut off
} from "react-native";

import { auth, db } from "../firebase/firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { signOut } from "firebase/auth"; // ← import this!

export default function ProfileScreen() {
  const [userInfo, setUserInfo] = useState({
    email: "",
    uid: "",
    name: "",
    bio: "",
  });

  useEffect(() => {
    const user = auth.currentUser;

    if (user) {
      setUserInfo((prev) => ({
        ...prev,
        email: user.email || "No email",
        uid: user.uid,
      }));

      fetchProfile(user.uid);
    } else {
      Alert.alert("Not logged in", "Please sign in to view your profile.");
    }
  }, []);

  const fetchProfile = async (uid) => {
    try {
      const userDocRef = doc(db, "users", uid);
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists()) {
        setUserInfo((prev) => ({
          ...prev,
          ...docSnap.data(),
        }));
      } else {
        const defaultData = {
          name: "New User",
          bio: "Tell us about yourself!",
          createdAt: new Date().toISOString(),
        };
        await setDoc(userDocRef, defaultData);

        setUserInfo((prev) => ({
          ...prev,
          ...defaultData,
        }));
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
      Alert.alert("Error", "Couldn't load profile: " + err.message);
    }
  };

  // ── Sign Out Handler ───────────────────────────────────────
  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Log Out",
          style: "destructive",
          onPress: () => {
            signOut(auth)
              .then(() => {
                // Navigation will automatically switch to Login
                // because of your onAuthStateChanged listener in App.js
                console.log("User signed out");
              })
              .catch((error) => {
                Alert.alert("Sign Out Failed", error.message);
              });
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Your Profile</Text>

        <View style={styles.infoCard}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{userInfo.email}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.label}>User ID</Text>
          <Text style={styles.value}>{userInfo.uid}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{userInfo.name}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.label}>Bio</Text>
          <Text style={styles.value}>{userInfo.bio}</Text>
        </View>

        {/* Spacer so sign out button stays at bottom even with little content */}
        <View style={{ flex: 1, minHeight: 40 }} />
      </ScrollView>

      {/* Sign Out Button – fixed at bottom */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100, // extra space so button doesn't overlap content
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#d32f2f",
    textAlign: "center",
    marginBottom: 32,
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },

  // ── Sign Out Button Styles ──
  signOutButton: {
    position: "absolute",
    bottom: 40,
    left: 24,
    right: 24,
    backgroundColor: "#d32f2f", // your red theme
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  signOutText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});