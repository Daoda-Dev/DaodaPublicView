// src/screens/VerifyEmailScreen.js
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { auth, sendEmailVerification } from "firebase/auth";

export default function VerifyEmailScreen({ navigation }) {
  const user = auth.currentUser;

  // Safety: if somehow no user → back to login
  if (!user) {
    navigation.replace("Login");
    return null;
  }

  const resendVerification = () => {
    sendEmailVerification(user)
      .then(() => {
        Alert.alert(
          "Email Resent",
          "We sent a new verification link.\nCheck your inbox and spam folder."
        );
      })
      .catch((error) => {
        Alert.alert("Error", error.message || "Could not resend email.");
      });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.innerContainer}>
        <Text style={styles.title}>Email Verification Required</Text>

        <Text style={styles.mainMessage}>
          To use Daoda, you must verify your email first.
        </Text>

        <Text style={styles.instruction}>
          We sent a verification link to:
        </Text>

        <Text style={styles.email}>{user.email}</Text>

        <Text style={styles.instruction}>
          1. Open your email app{"\n"}
          2. Find the message from Daoda{"\n"}
          3. Click the verification link{"\n"}
          4. Come back here and tap "Back to Login"
        </Text>

        <Text style={styles.note}>
          Didn't see it? Check your spam/junk folder or tap "Resend" below.
        </Text>

        <TouchableOpacity
          style={styles.resendButton}
          onPress={resendVerification}
        >
          <Text style={styles.buttonText}>Resend Verification Email</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => navigation.replace("Login")}
        >
          <Text style={styles.buttonText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  innerContainer: {
    flex: 1,
    backgroundColor: "#f2f2f2",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 36,
    paddingVertical: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#d32f2f",
    marginBottom: 24,
    textAlign: "center",
  },
  mainMessage: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 26,
  },
  instruction: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 24,
  },
  email: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#d32f2f",
    marginVertical: 16,
    textAlign: "center",
  },
  note: {
    fontSize: 14,
    color: "#777",
    textAlign: "center",
    marginTop: 24,
    marginBottom: 40,
    lineHeight: 20,
  },
  resendButton: {
    backgroundColor: "#d32f2f",
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: "85%",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  loginButton: {
    backgroundColor: "#444",
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: "85%",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
});