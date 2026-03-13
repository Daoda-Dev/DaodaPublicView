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

import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Super important: refresh the user object to get latest emailVerified status
      await user.reload();

      if (user.emailVerified) {
        // Verified → App.js will show the tabs automatically
        Alert.alert("Welcome back!", "You're logged in.");
      } else {
        // Not verified → kick them out and send to verification screen
        await auth.signOut();

        Alert.alert(
          "Email not verified",
          "You need to verify your email before using Daoda.\n\nCheck your inbox (and spam/junk folder) for the link we sent.",
          [{ text: "OK", style: "default" }]
        );

        navigation.replace("VerifyEmail");
      }
    } catch (error) {
      // Keep your nice specific error messages
      let message = "Something went wrong. Try again.";

      switch (error.code) {
        case "auth/user-not-found":
          message = "No account found with this email";
          break;
        case "auth/wrong-password":
          message = "Incorrect password";
          break;
        case "auth/invalid-email":
          message = "Invalid email format";
          break;
        case "auth/too-many-requests":
          message = "Too many attempts. Try again later or reset your password";
          break;
        default:
          message = error.message;
      }

      Alert.alert("Login Failed", message);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={require("../../assets/logo.png")} style={styles.logo} />

      <Text style={styles.appName}>Daoda</Text>

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

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>LOG IN</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          Alert.alert("Coming soon", "Password reset feature coming in next update!");
        }}
      >
        <Text style={styles.forgot}>Forgot your password?</Text>
      </TouchableOpacity>

      <Text style={styles.signup}>
        Don't have an account?{" "}
        <Text
          style={styles.signupLink}
          onPress={() => navigation.navigate("Signup")}
        >
          Sign up
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f2",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  logo: {
    width: 80,
    height: 80,
    alignSelf: "center",
    marginBottom: 10,
  },
  appName: {
    textAlign: "center",
    color: "red",
    fontWeight: "bold",
    fontSize: 24,
    marginBottom: 48,
  },
  input: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#ccc",
    paddingVertical: 12,
    marginBottom: 28,
    fontSize: 16,
  },
  button: {
    backgroundColor: "red",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },
  forgot: {
    textAlign: "center",
    marginTop: 24,
    color: "#d32f2f",
    fontSize: 15,
  },
  signup: {
    textAlign: "center",
    marginTop: 48,
    color: "#555",
    fontSize: 16,
  },
  signupLink: {
    color: "red",
    fontWeight: "bold",
  },
});