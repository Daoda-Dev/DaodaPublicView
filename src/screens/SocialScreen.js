import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function SocialScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Social Placeholder – Connect with Users!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f2f2f2" },
  text: { fontSize: 18, color: "#333" },
});