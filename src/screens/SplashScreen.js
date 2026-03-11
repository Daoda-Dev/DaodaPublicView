import React from "react";
import { View, Image, Text, StyleSheet } from "react-native";

export default function SplashScreen() {
  // No useEffect or navigation – it's now a static view
  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/splash.png")}
        style={styles.image}
        resizeMode="contain"
      />
      <Text style={styles.bottomText}>Powered by NiDao</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center"
  },
  image: {
    width: 200,
    height: 200
  },
  bottomText: {
    position: "absolute",
    bottom: 30,
    fontSize: 12,
    color: "#888"
  }
});