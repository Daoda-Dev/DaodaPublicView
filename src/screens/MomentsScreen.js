import React, { useState, useEffect } from "react";
import { View, Text, FlatList, StyleSheet, Dimensions } from "react-native";
import { Video } from "expo-av";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase/firebaseConfig"; // Adjust path if needed

const { width } = Dimensions.get("window");

export default function MomentsScreen() {
  const [videos, setVideos] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const videosRef = ref(storage, "videos/"); // Assume uploads go here
        const result = await listAll(videosRef);
        const urls = await Promise.all(
          result.items.map(async (itemRef) => {
            const url = await getDownloadURL(itemRef);
            return { id: itemRef.name, uri: url };
          })
        );
        setVideos(urls);
      } catch (err) {
        setError("Failed to load videos: " + err.message);
      }
    };
    fetchVideos();
  }, []);

  const renderVideo = ({ item }) => (
    <View style={styles.videoContainer}>
      <Video
        source={{ uri: item.uri }}
        rate={1.0}
        volume={1.0}
        isMuted={false}
        resizeMode="cover"
        shouldPlay
        isLooping
        style={styles.video}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {videos.length === 0 ? (
        <Text style={styles.noVideos}>No videos yet – upload some!</Text>
      ) : (
        <FlatList
          data={videos}
          renderItem={renderVideo}
          keyExtractor={(item) => item.id}
          pagingEnabled
          horizontal
          showsHorizontalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f2f2f2" },
  videoContainer: { width, height: "100%", justifyContent: "center" },
  video: { width: "100%", height: "100%" },
  error: { color: "red", textAlign: "center", margin: 20 },
  noVideos: { textAlign: "center", margin: 20, fontSize: 16 },
});