import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { Video } from "expo-av"; // ← back to this
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";

const { width, height } = Dimensions.get("window");

export default function MomentsScreen() {
  const [videos, setVideos] = useState([]);
  const [currentUsername, setCurrentUsername] = useState("You");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    const q = query(collection(db, "videos"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setVideos(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const fetchMyUsername = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) setCurrentUsername(userDoc.data().username || "You");
      }
    };
    fetchMyUsername();

    return unsub;
  }, []);

  const toggleLike = async (videoId, likedBy = [], likesCount = 0) => {
    const videoRef = doc(db, "videos", videoId);
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const isLiked = likedBy.includes(userId);

    try {
      if (isLiked) {
        await updateDoc(videoRef, {
          likedBy: arrayRemove(userId),
          likesCount: increment(-1),
        });
      } else {
        await updateDoc(videoRef, {
          likedBy: arrayUnion(userId),
          likesCount: increment(1),
        });
      }
    } catch (err) {
      Alert.alert("Error", "Couldn't update like");
    }
  };

  const openComments = (video) => {
    setSelectedVideoId(video.id);
    setComments(video.comments || []);
    setModalVisible(true);
    setNewComment("");
  };

  const addComment = async () => {
    if (!newComment.trim() || !selectedVideoId) return;

    const videoRef = doc(db, "videos", selectedVideoId);
    const commentObj = {
      uid: auth.currentUser.uid,
      username: currentUsername,
      text: newComment.trim(),
      timestamp: new Date().toISOString(),
    };

    try {
      await updateDoc(videoRef, { comments: arrayUnion(commentObj) });
      setNewComment("");
    } catch (err) {
      Alert.alert("Error", "Couldn't post comment");
    }
  };

  const renderVideo = ({ item }) => {
    const isLiked = item.likedBy?.includes(auth.currentUser?.uid) || false;

    return (
      <View style={styles.videoContainer}>
        <Video
          source={{ uri: item.videoUrl }}
          style={styles.video}
          resizeMode="cover"
          shouldPlay
          isLooping
          useNativeControls={false} // set to true if you want controls
          isMuted={false} // change to true for silent autoplay
        />

        <View style={styles.overlay}>
          <View style={styles.infoBox}>
            <Text style={styles.username}>@{item.username}</Text>
            <Text style={styles.caption}>{item.caption}</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => toggleLike(item.id, item.likedBy, item.likesCount)}
              style={styles.action}
            >
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={42}
                color={isLiked ? "red" : "white"}
              />
              <Text style={styles.count}>{item.likesCount || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => openComments(item)} style={styles.action}>
              <Ionicons name="chatbubble-outline" size={42} color="white" />
              <Text style={styles.count}>{item.comments?.length || 0}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={videos}
        renderItem={renderVideo}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        decelerationRate="fast"
        snapToInterval={height}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Comments</Text>

            <FlatList
              data={comments}
              keyExtractor={(_, index) => index.toString()}
              renderItem={({ item }) => (
                <Text style={styles.commentText}>
                  <Text style={styles.commentUser}>@{item.username}</Text>: {item.text}
                </Text>
              )}
              style={styles.commentsList}
            />

            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                value={newComment}
                onChangeText={setNewComment}
              />
              <TouchableOpacity onPress={addComment} style={styles.sendButton}>
                <Text style={styles.sendText}>Send</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  videoContainer: { width, height, position: "relative" },
  video: { width: "100%", height: "100%" },
  overlay: {
    position: "absolute",
    bottom: 80,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoBox: { flex: 1, marginRight: 20 },
  username: { color: "#fff", fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  caption: { color: "#fff", fontSize: 16 },
  actions: { alignItems: "center", gap: 30 },
  action: { alignItems: "center" },
  count: { color: "#fff", marginTop: 4, fontWeight: "bold" },

  modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "70%",
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 15, textAlign: "center" },
  commentsList: { marginBottom: 15 },
  commentText: { fontSize: 16, marginBottom: 10 },
  commentUser: { fontWeight: "bold", color: "red" },
  commentInputRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: "#ddd",
    paddingTop: 10,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 25,
    paddingHorizontal: 15,
    height: 45,
  },
  sendButton: {
    backgroundColor: "red",
    paddingHorizontal: 20,
    justifyContent: "center",
    borderRadius: 25,
    marginLeft: 10,
  },
  sendText: { color: "#fff", fontWeight: "bold" },
  closeButton: { marginTop: 15, alignItems: "center" },
  closeText: { color: "red", fontWeight: "bold" },
});