// src/screens/SignupScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from "react-native";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore"; // ← add these
import { auth, db } from "../firebase/firebaseConfig";   // make sure db is exported

export default function SignupScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState(""); // ← new
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSignup = async () => {
    if (!email || !username || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords don't match");
      return;
    }

    // Optional: basic username rules (you can make stricter)
    if (username.length < 3 || username.length > 20) {
      Alert.alert("Error", "Username must be 3–20 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      Alert.alert("Error", "Username can only contain letters, numbers, and underscores");
      return;
    }

    try {
      // 1. Check if username already exists
      const usernameDocRef = doc(db, "usernames", username.toLowerCase()); // case-insensitive
      const usernameSnap = await getDoc(usernameDocRef);

      if (usernameSnap.exists()) {
        Alert.alert("Username taken", "That username is already in use. Try another one.");
        return;
      }

      // 2. Create auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 3. Send verification email
      await sendEmailVerification(user);

      // 4. Save username + basic profile (use lowercase for lookup)
      await setDoc(doc(db, "users", user.uid), {
        username: username,                // display version
        usernameLower: username.toLowerCase(),
        email: user.email,
        createdAt: new Date().toISOString(),
        // bio: "", etc. later
      });

      // 5. Reserve the username so no one else can take it
      await setDoc(usernameDocRef, {
        uid: user.uid,
        createdAt: new Date().toISOString(),
      });

      Alert.alert(
        "Almost there!",
        "Check your email to verify your account."
      );

      navigation.replace("VerifyEmail");
    } catch (error) {
      let message = error.message;

      if (error.code === "auth/email-already-in-use") {
        message = "This email is already registered.";
      } else if (error.code === "auth/invalid-email") {
        message = "Invalid email format.";
      } else if (error.code === "auth/weak-password") {
        message = "Password should be at least 6 characters.";
      }

      Alert.alert("Signup Failed", message);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={require("../../assets/logo.png")} style={styles.logo} />
      <Text style={styles.appName}>Daoda Signup</Text>

      <TextInput
        placeholder="Username"
        style={styles.input}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TextInput
        placeholder="Email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoCorrect={false}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />

      <TextInput
        placeholder="Confirm Password"
        secureTextEntry
        style={styles.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleSignup}>
        <Text style={styles.buttonText}>SIGN UP</Text>
      </TouchableOpacity>

      <Text style={styles.login}>
        Already have an account?{" "}
        <Text style={styles.loginLink} onPress={() => navigation.navigate("Login")}>
          Log in
        </Text>
      </Text>
    </View>
  );
}

// styles stay exactly the same (just inputs are taller now — looks better)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f2",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  logo: { width: 80, height: 80, alignSelf: "center", marginBottom: 10 },
  appName: {
    textAlign: "center",
    color: "red",
    fontWeight: "bold",
    fontSize: 18,
    marginBottom: 40,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingVertical: 12,          // ← little taller
    marginBottom: 25,
    fontSize: 16,
  },
  button: {
    backgroundColor: "red",
    padding: 15,
    borderRadius: 3,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: { color: "#fff", fontWeight: "bold" },
  login: { textAlign: "center", marginTop: 40, color: "#777" },
  loginLink: { color: "red", fontWeight: "bold" },
});