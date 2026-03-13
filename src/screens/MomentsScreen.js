import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Video, ResizeMode } from "expo-av";
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

// ─── Constants ────────────────────────────────────────────────────────────────
const { width, height: SCREEN_HEIGHT } = Dimensions.get("window");
const TOP_GAP = SCREEN_HEIGHT * 0.05;
const RED = "#C8102E";
const CARD_GAP = 8;
const SIDE_PAD = 10;
const COL_WIDTH = (width - SIDE_PAD * 2 - CARD_GAP) / 2;

// Cycle of soft card background colors (like the HTML design)
const CARD_COLORS = [
  "#f7c6cf", "#c8e6c9", "#ffe0b2", "#d1c4e9",
  "#b3e5fc", "#f8bbd0", "#c5cae9", "#ffccbc",
  "#b2dfdb", "#e1bee7", "#fff9c4", "#dcedc8",
];

const fmtLikes = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n || 0));

const getCardColor = (index) => CARD_COLORS[index % CARD_COLORS.length];

// Alternate card heights for masonry feel
const getCardHeight = (index) => {
  const heights = [160, 190, 170, 210, 180, 155, 200, 175, 165, 195];
  return heights[index % heights.length];
};

// ─── Video Player Modal ───────────────────────────────────────────────────────
function VideoPlayerModal({ visible, video, currentUsername, onClose, onToggleLike }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [comments, setComments] = useState([]);
  const [videoLoading, setVideoLoading] = useState(true);

  useEffect(() => {
    if (visible && video) {
      setComments(video.comments || []);
      setIsPlaying(true);
      setVideoLoading(true);
      setShowComments(false);
    }
  }, [visible, video?.id]);

  // Pause when modal closes
  useEffect(() => {
    if (!visible) {
      videoRef.current?.pauseAsync();
      setIsPlaying(false);
    }
  }, [visible]);

  const handleClose = async () => {
    await videoRef.current?.pauseAsync();
    setIsPlaying(false);
    onClose();
  };

  const togglePlay = async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
    setIsPlaying(!isPlaying);
  };

  const addComment = async () => {
    if (!newComment.trim() || !video) return;
    const videoDoc = doc(db, "videos", video.id);
    const commentObj = {
      uid: auth.currentUser.uid,
      username: currentUsername,
      text: newComment.trim(),
      timestamp: new Date().toISOString(),
    };
    try {
      await updateDoc(videoDoc, { comments: arrayUnion(commentObj) });
      setComments((prev) => [...prev, commentObj]);
      setNewComment("");
    } catch {
      Alert.alert("Error", "Couldn't post comment");
    }
  };

  if (!video) return null;

  const isLiked = video.likedBy?.includes(auth.currentUser?.uid) || false;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
      <StatusBar hidden />
      <View style={playerStyles.root}>

        {/* ── Video ── */}
        <TouchableOpacity activeOpacity={1} onPress={togglePlay} style={playerStyles.videoWrap}>
          <Video
            ref={videoRef}
            source={{ uri: video.videoUrl }}
            style={playerStyles.video}
            resizeMode={ResizeMode.COVER}
            shouldPlay={visible}
            isLooping
            isMuted={false}
            onPlaybackStatusUpdate={(s) => {
              if (s.isLoaded) setVideoLoading(false);
              if (s.isLoaded) setIsPlaying(s.isPlaying);
            }}
          />

          {videoLoading && (
            <View style={playerStyles.loadingOverlay}>
              <ActivityIndicator color="#fff" size="large" />
            </View>
          )}

          {/* Play/pause icon flash */}
          {!isPlaying && !videoLoading && (
            <View style={playerStyles.pauseOverlay}>
              <View style={playerStyles.pauseCircle}>
                <Ionicons name="play" size={28} color="#fff" />
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Close button ── */}
        <TouchableOpacity style={playerStyles.closeBtn} onPress={handleClose}>
          <Ionicons name="chevron-down" size={22} color="#fff" />
        </TouchableOpacity>

        {/* ── Info overlay ── */}
        <View style={playerStyles.infoOverlay}>
          <View style={playerStyles.infoLeft}>
            <View style={playerStyles.authorBadge}>
              <Text style={playerStyles.authorInitial}>
                {video.username?.[0]?.toUpperCase() || "?"}
              </Text>
            </View>
            <View>
              <Text style={playerStyles.username}>@{video.username}</Text>
              <Text style={playerStyles.caption} numberOfLines={2}>{video.caption}</Text>
            </View>
          </View>

          <View style={playerStyles.actions}>
            <TouchableOpacity
              style={playerStyles.actionBtn}
              onPress={() => onToggleLike(video.id, video.likedBy, video.likesCount)}
            >
              <Ionicons name={isLiked ? "heart" : "heart-outline"} size={30} color={isLiked ? RED : "#fff"} />
              <Text style={[playerStyles.actionCount, isLiked && { color: RED }]}>
                {fmtLikes(video.likesCount)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={playerStyles.actionBtn}
              onPress={() => setShowComments(true)}
            >
              <Ionicons name="chatbubble-outline" size={28} color="#fff" />
              <Text style={playerStyles.actionCount}>{video.comments?.length || 0}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Comments Sheet ── */}
      <Modal visible={showComments} transparent animationType="slide" onRequestClose={() => setShowComments(false)}>
        <View style={commentStyles.backdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={commentStyles.sheet}>
            <View style={commentStyles.handle} />
            <Text style={commentStyles.title}>Comments</Text>

            <FlatList
              data={comments}
              keyExtractor={(_, i) => i.toString()}
              style={commentStyles.list}
              ListEmptyComponent={
                <Text style={commentStyles.empty}>No comments yet. Be the first!</Text>
              }
              renderItem={({ item }) => (
                <View style={commentStyles.commentRow}>
                  <View style={commentStyles.commentAvatar}>
                    <Text style={commentStyles.commentInitial}>
                      {item.username?.[0]?.toUpperCase() || "?"}
                    </Text>
                  </View>
                  <View style={commentStyles.commentBody}>
                    <Text style={commentStyles.commentUser}>@{item.username}</Text>
                    <Text style={commentStyles.commentText}>{item.text}</Text>
                  </View>
                </View>
              )}
            />

            <View style={commentStyles.inputRow}>
              <TextInput
                style={commentStyles.input}
                placeholder="Write a comment…"
                placeholderTextColor="#ccc"
                value={newComment}
                onChangeText={setNewComment}
              />
              <TouchableOpacity onPress={addComment} style={commentStyles.sendBtn}>
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => setShowComments(false)} style={commentStyles.closeBtn}>
              <Text style={commentStyles.closeText}>Close</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </Modal>
  );
}

const playerStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  videoWrap: { flex: 1 },
  video: { width: "100%", height: "100%" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center", alignItems: "center",
  },
  pauseCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center", alignItems: "center",
    paddingLeft: 4,
  },
  closeBtn: {
    position: "absolute", top: 52, left: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center", alignItems: "center",
  },
  infoOverlay: {
    position: "absolute", bottom: 40, left: 16, right: 16,
    flexDirection: "row", alignItems: "flex-end",
    justifyContent: "space-between",
  },
  infoLeft: { flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 10, marginRight: 12 },
  authorBadge: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: RED, borderWidth: 2, borderColor: "#fff",
    justifyContent: "center", alignItems: "center", flexShrink: 0,
  },
  authorInitial: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  username: { color: "#fff", fontWeight: "700", fontSize: 14, marginBottom: 2 },
  caption: { color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 18 },
  actions: { alignItems: "center", gap: 20 },
  actionBtn: { alignItems: "center" },
  actionCount: { color: "#fff", fontSize: 11, fontWeight: "600", marginTop: 3 },
});

const commentStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 20, maxHeight: "75%",
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "#e0e0e0", alignSelf: "center", marginBottom: 14,
  },
  title: { fontSize: 16, fontWeight: "700", color: "#1a0a0f", textAlign: "center", marginBottom: 14 },
  list: { maxHeight: 300, marginBottom: 12 },
  empty: { textAlign: "center", color: "#b08090", fontSize: 13, paddingVertical: 20 },
  commentRow: { flexDirection: "row", marginBottom: 14, gap: 10 },
  commentAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: RED, justifyContent: "center", alignItems: "center", flexShrink: 0,
  },
  commentInitial: { color: "#fff", fontWeight: "700", fontSize: 13 },
  commentBody: { flex: 1 },
  commentUser: { color: RED, fontWeight: "700", fontSize: 12, marginBottom: 2 },
  commentText: { color: "#1a0a0f", fontSize: 13, lineHeight: 18 },
  inputRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  input: {
    flex: 1, borderWidth: 1, borderColor: "#fce8ef", borderRadius: 25,
    paddingHorizontal: 14, height: 42, fontSize: 13, color: "#1a0a0f",
    backgroundColor: "#fdf5f7",
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: RED, justifyContent: "center", alignItems: "center",
  },
  closeBtn: { alignItems: "center", paddingTop: 6 },
  closeText: { color: RED, fontWeight: "700", fontSize: 14 },
});

// ─── Feed Card ────────────────────────────────────────────────────────────────
function VideoCard({ item, index, onPress }) {
  const isLiked = item.likedBy?.includes(auth.currentUser?.uid) || false;
  const cardH = getCardHeight(index);
  const bg = getCardColor(index);
  const initial = item.username?.[0]?.toUpperCase() || "?";

  return (
    <TouchableOpacity style={[cardStyles.card, { width: COL_WIDTH }]} onPress={onPress} activeOpacity={0.88}>
      {/* Thumbnail placeholder with play icon */}
      <View style={[cardStyles.thumb, { height: cardH, backgroundColor: bg }]}>
        <View style={cardStyles.playBadge}>
          <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.85)" />
        </View>
        <View style={cardStyles.tagBadge}>
          <Ionicons name="videocam" size={9} color={RED} />
          <Text style={cardStyles.tagText}>VIDEO</Text>
        </View>
      </View>

      <View style={cardStyles.body}>
        <Text style={cardStyles.caption} numberOfLines={2}>{item.caption || "Untitled"}</Text>
        <View style={cardStyles.footer}>
          <View style={cardStyles.authorRow}>
            <View style={[cardStyles.avatar, { backgroundColor: getCardColor(index + 3) }]}>
              <Text style={cardStyles.avatarText}>{initial}</Text>
            </View>
            <Text style={cardStyles.authorName} numberOfLines={1}>@{item.username}</Text>
          </View>
          <View style={[cardStyles.likeRow, isLiked && cardStyles.likeRowActive]}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={12} color={isLiked ? RED : "#d4aab8"} />
            <Text style={[cardStyles.likeCount, isLiked && { color: RED }]}>
              {fmtLikes(item.likesCount)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 14,
    overflow: "hidden", marginBottom: CARD_GAP,
    shadowColor: "#C8102E", shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 6,
    elevation: 3,
  },
  thumb: { width: "100%", justifyContent: "center", alignItems: "center", position: "relative" },
  playBadge: { position: "absolute" },
  tagBadge: {
    position: "absolute", bottom: 7, left: 7,
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(255,255,255,0.88)",
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 50,
  },
  tagText: { fontSize: 8, fontWeight: "800", color: RED, letterSpacing: 0.5 },
  body: { padding: 8 },
  caption: { fontSize: 11.5, fontWeight: "600", color: "#1a0a0f", lineHeight: 16, marginBottom: 7 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 5, flex: 1, overflow: "hidden" },
  avatar: {
    width: 20, height: 20, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 9, fontWeight: "700", color: "#1a0a0f" },
  authorName: { fontSize: 10, color: "#b08090", flex: 1 },
  likeRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  likeRowActive: {},
  likeCount: { fontSize: 10, color: "#b08090", fontWeight: "600" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MomentsScreen() {
  const [videos, setVideos] = useState([]);
  const [currentUsername, setCurrentUsername] = useState("You");
  const [activeTab, setActiveTab] = useState("Explore");
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [playerVisible, setPlayerVisible] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "videos"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setVideos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const fetchUsername = async () => {
      const user = auth.currentUser;
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) setCurrentUsername(snap.data().username || "You");
      }
    };
    fetchUsername();
    return unsub;
  }, []);

  const toggleLike = useCallback(async (videoId, likedBy = [], likesCount = 0) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const isLiked = likedBy.includes(userId);
    try {
      await updateDoc(doc(db, "videos", videoId), isLiked
        ? { likedBy: arrayRemove(userId), likesCount: increment(-1) }
        : { likedBy: arrayUnion(userId), likesCount: increment(1) }
      );
    } catch {
      Alert.alert("Error", "Couldn't update like");
    }
  }, []);

  const openVideo = (video) => {
    setSelectedVideo(video);
    setPlayerVisible(true);
  };

  const closeVideo = () => {
    setPlayerVisible(false);
    setTimeout(() => setSelectedVideo(null), 300);
  };

  // Keep selectedVideo in sync with live Firestore data (for likes/comments)
  const liveSelected = selectedVideo
    ? videos.find((v) => v.id === selectedVideo.id) || selectedVideo
    : null;

  // Filter by search
  const filtered = searchQuery.trim()
    ? videos.filter(
        (v) =>
          v.caption?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.username?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : videos;

  // Split into 2 columns
  const leftCol = filtered.filter((_, i) => i % 2 === 0);
  const rightCol = filtered.filter((_, i) => i % 2 !== 0);

  const TABS = ["Following", "Explore", "Nearby"];

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fdf0f5" />

      {/* ── Top Nav ── */}
      <View style={styles.topnav}>
        <View style={styles.topnavRow}>
          <View style={styles.menuIcon}>
            <View style={styles.mline} />
            <View style={[styles.mline, { width: 13 }]} />
            <View style={styles.mline} />
          </View>

          <View style={styles.tabs}>
            {TABS.map((tab) => (
              <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={styles.tabBtn}>
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                {activeTab === tab && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={() => setSearchVisible((v) => !v)}>
            <Ionicons name="search-outline" size={20} color="#1a0a0f" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search Bar ── */}
      {searchVisible && (
        <View style={styles.searchBar}>
          <View style={styles.searchInner}>
            <Ionicons name="search-outline" size={13} color="#d4aab8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search people, posts, topics…"
              placeholderTextColor="#d4aab8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={14} color="#d4aab8" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── Feed ── */}
      {activeTab === "Explore" ? (
        <ScrollView
          style={styles.feed}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="videocam-outline" size={48} color="#d4aab8" />
              <Text style={styles.emptyTitle}>No moments yet</Text>
              <Text style={styles.emptySubtitle}>Be the first to share a moment!</Text>
            </View>
          ) : (
            <View style={styles.masonry}>
              {/* Left column */}
              <View style={styles.col}>
                {leftCol.map((item, i) => (
                  <VideoCard
                    key={item.id}
                    item={item}
                    index={i * 2}
                    onPress={() => openVideo(item)}
                  />
                ))}
              </View>
              {/* Right column */}
              <View style={styles.col}>
                {rightCol.map((item, i) => (
                  <VideoCard
                    key={item.id}
                    item={item}
                    index={i * 2 + 1}
                    onPress={() => openVideo(item)}
                  />
                ))}
              </View>
            </View>
          )}
          <View style={{ height: 20 }} />
        </ScrollView>
      ) : (
        <View style={styles.tabPlaceholder}>
          <Text style={styles.phIcon}>{activeTab === "Following" ? "👥" : "📍"}</Text>
          <Text style={styles.phTitle}>{activeTab}</Text>
          <Text style={styles.phSub}>
            {activeTab === "Following"
              ? "Posts from people you follow will appear here."
              : "Discover people and posts near you."}
          </Text>
        </View>
      )}

      {/* ── Video Player Modal ── */}
      <VideoPlayerModal
        visible={playerVisible}
        video={liveSelected}
        currentUsername={currentUsername}
        onClose={closeVideo}
        onToggleLike={toggleLike}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fdf0f5" },

  // Top nav
  topnav: {
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingTop: TOP_GAP,
    borderBottomWidth: 1, borderBottomColor: "#fce8ef",
  },
  topnavRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 0,
  },
  menuIcon: { gap: 4, paddingVertical: 2 },
  mline: { width: 18, height: 2, backgroundColor: "#1a0a0f", borderRadius: 2 },
  tabs: { flexDirection: "row", gap: 4, flex: 1, justifyContent: "center" },
  tabBtn: { paddingHorizontal: 10, paddingBottom: 10, alignItems: "center", position: "relative" },
  tabText: { fontSize: 14, fontWeight: "500", color: "#b08090" },
  tabTextActive: { color: "#1a0a0f", fontWeight: "800", fontSize: 15 },
  tabUnderline: {
    position: "absolute", bottom: 0,
    width: 20, height: 2.5,
    backgroundColor: RED, borderRadius: 2,
  },

  // Search
  searchBar: {
    backgroundColor: "#fff", paddingHorizontal: 14,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#fce8ef",
  },
  searchInner: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: "#fdf5f7", borderWidth: 1, borderColor: "#fce8ef",
    borderRadius: 50, paddingHorizontal: 14, paddingVertical: 7,
  },
  searchInput: {
    flex: 1, fontSize: 12, color: "#1a0a0f",
    padding: 0,
  },

  // Feed
  feed: { flex: 1 },
  feedContent: { padding: SIDE_PAD, paddingTop: 12 },
  masonry: { flexDirection: "row", gap: CARD_GAP },
  col: { flex: 1 },

  // Empty state
  emptyState: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingTop: 80, gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#1a0a0f" },
  emptySubtitle: { fontSize: 13, color: "#b08090", textAlign: "center" },

  // Tab placeholders
  tabPlaceholder: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 30,
  },
  phIcon: { fontSize: 40 },
  phTitle: { fontSize: 16, fontWeight: "700", color: "#1a0a0f" },
  phSub: { fontSize: 13, color: "#b08090", textAlign: "center", lineHeight: 20 },
});