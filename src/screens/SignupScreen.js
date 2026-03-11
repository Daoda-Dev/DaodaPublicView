import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert
} from "react-native";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";

export default function SignupScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSignup = () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert("Error", "Fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords don't match");
      return;
    }

    createUserWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    sendEmailVerification(userCredential.user)
      .then(() => {
        Alert.alert(
          "Almost there!",
          "Check your email to verify your account."
        );
        navigation.replace("VerifyEmail");
      })
      .catch((error) => Alert.alert("Error", error.message));
  })
  .catch((error) => Alert.alert("Signup Failed", error.message));
  };

  return (
    <View style={styles.container}>
      <Image source={require("../../assets/logo.png")} style={styles.logo} />
      <Text style={styles.appName}>Daoda Signup</Text>

      <TextInput
        placeholder="Email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
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
        Already have an account? <Text style={styles.loginLink} onPress={() => navigation.navigate("Login")}>Log in</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f2",
    justifyContent: "center",
    paddingHorizontal: 40
  },
  logo: { width: 80, height: 80, alignSelf: "center", marginBottom: 10 },
  appName: { textAlign: "center", color: "red", fontWeight: "bold", fontSize: 18, marginBottom: 40 },
  input: { borderBottomWidth: 1, borderBottomColor: "#ccc", paddingVertical: 10, marginBottom: 25 },
  button: { backgroundColor: "red", padding: 15, borderRadius: 3, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#fff", fontWeight: "bold" },
  login: { textAlign: "center", marginTop: 40, color: "#777" },
  loginLink: { color: "red", fontWeight: "bold" }
});