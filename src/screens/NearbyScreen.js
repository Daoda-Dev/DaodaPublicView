import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, Modal, TextInput, TouchableOpacity,
  Alert, Dimensions, ScrollView, FlatList, KeyboardAvoidingView,
  Platform, Animated, SafeAreaView, ActivityIndicator,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  collection, addDoc, onSnapshot, query, orderBy,
  Timestamp, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, getDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";

// ─── Constants ─────────────────────────────────────────────────────────────────
const { width, height: SCREEN_HEIGHT } = Dimensions.get("window");
const TOP_GAP = SCREEN_HEIGHT * 0.05;
const PINK = "#E8447A";
const BG = "#fdf0f5";
const DARK = "#2A1520";
const SOFT = "#B08099";
const BORDER = "#f0c8dc";
const SHEET_MIN = 100;
const SHEET_MAX = SCREEN_HEIGHT * 0.55;

const EMOJI_OPTIONS = [
  "🎉","🎸","🍕","☕","🏃","🎨","🎮","📚","🌿","🎬","🏋️","🧘","🍻","🎤","🌏","🚴","🍜","🎯",
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
const getDistance = (loc1, loc2) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(loc2.latitude - loc1.latitude);
  const dLon = toRad(loc2.longitude - loc1.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(loc1.latitude)) * Math.cos(toRad(loc2.latitude)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const fmtDate = (ts) => {
  if (!ts) return "–";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const fmtTime = (ts) => {
  if (!ts) return "–";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
};

const isEventOver = (event) => {
  if (!event.dateTo) return false;
  const end = event.dateTo.toDate ? event.dateTo.toDate() : new Date(event.dateTo);
  return Date.now() > end.getTime();
};

// ─── Custom Map Pin ─────────────────────────────────────────────────────────────
function EventPin({ event }) {
  return (
    <View style={pinStyles.container}>
      <View style={pinStyles.bubble}>
        <Text style={pinStyles.emoji}>{event.emoji || "📍"}</Text>
        <Text style={pinStyles.label} numberOfLines={1}>{event.title}</Text>
      </View>
      <View style={pinStyles.tail} />
    </View>
  );
}

const pinStyles = StyleSheet.create({
  container: { alignItems: "center" },
  bubble: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#fff", borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 5,
    borderWidth: 1.5, borderColor: PINK,
    shadowColor: PINK, shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
    elevation: 4, maxWidth: 130,
  },
  emoji: { fontSize: 14 },
  label: { fontSize: 11, fontWeight: "700", color: DARK, flexShrink: 1 },
  tail: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
    borderLeftColor: "transparent", borderRightColor: "transparent",
    borderTopColor: PINK,
  },
});

// ─── DateRow helper ─────────────────────────────────────────────────────────────
function DateRow({ label, date, onPress }) {
  return (
    <TouchableOpacity style={formStyles.dateRow} onPress={onPress} activeOpacity={0.75}>
      <Text style={formStyles.dateLabel}>{label}</Text>
      <Text style={formStyles.dateValue}>
        {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        {"  "}
        {date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
      </Text>
      <Ionicons name="chevron-forward" size={14} color={SOFT} />
    </TouchableOpacity>
  );
}

const formStyles = StyleSheet.create({
  dateRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: BG, borderRadius: 10,
    borderWidth: 1, borderColor: BORDER, marginBottom: 8,
  },
  dateLabel: { fontSize: 11, color: SOFT, width: 50 },
  dateValue: { flex: 1, fontSize: 12, color: DARK, fontWeight: "500" },
});

// ─── Create Event Modal ─────────────────────────────────────────────────────────
function CreateEventModal({ visible, lat, lng, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [emoji, setEmoji] = useState("🎉");
  const [dateFrom, setDateFrom] = useState(new Date());
  const [dateTo, setDateTo]   = useState(new Date(Date.now() + 2 * 3600 * 1000));
  const [maxPeople, setMaxPeople] = useState("10");
  const [activePicker, setActivePicker] = useState(null); // 'from' | 'fromTime' | 'to' | 'toTime'
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle(""); setType(""); setEmoji("🎉");
    setDateFrom(new Date()); setDateTo(new Date(Date.now() + 2 * 3600 * 1000));
    setMaxPeople("10"); setActivePicker(null);
  };

  const handleCreate = async () => {
    if (!title.trim()) return Alert.alert("Required", "Event name is required.");
    if (!type.trim())  return Alert.alert("Required", "Event type is required.");
    const max = parseInt(maxPeople);
    if (isNaN(max) || max < 1) return Alert.alert("Invalid", "Enter a valid max people count.");
    if (dateTo <= dateFrom) return Alert.alert("Invalid", "End must be after start.");

    setSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not logged in");
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const username = userDoc.exists() ? userDoc.data().username : "Anonymous";

      const eventRef = await addDoc(collection(db, "events"), {
        title: title.trim(),
        type: type.trim(),
        emoji,
        dateFrom: Timestamp.fromDate(dateFrom),
        dateTo: Timestamp.fromDate(dateTo),
        maxPeople: max,
        attendees: [user.uid],
        creator: user.uid,
        creatorUsername: username,
        lat, lng,
        createdAt: Timestamp.now(),
      });

      // Seed the group chat with a welcome message
      await addDoc(collection(db, "events", eventRef.id, "messages"), {
        text: `🎉 ${username} created "${title.trim()}" – welcome everyone!`,
        uid: "system",
        username: "Daoda",
        createdAt: Timestamp.now(),
      });

      reset();
      onCreated();
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePickerChange = (picker, event, date) => {
    setActivePicker(null);
    if (!date) return;
    if (picker === "from") {
      const d = new Date(dateFrom);
      d.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      setDateFrom(d);
    } else if (picker === "fromTime") {
      const d = new Date(dateFrom);
      d.setHours(date.getHours(), date.getMinutes());
      setDateFrom(d);
    } else if (picker === "to") {
      const d = new Date(dateTo);
      d.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      setDateTo(d);
    } else if (picker === "toTime") {
      const d = new Date(dateTo);
      d.setHours(date.getHours(), date.getMinutes());
      setDateTo(d);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { reset(); onClose(); }}>
      <View style={cStyles.backdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={cStyles.sheet}>
          <View style={cStyles.handle} />
          <Text style={cStyles.title}>Create Event</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Emoji picker */}
            <Text style={cStyles.fieldLabel}>Pick an emoji for your pin</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {EMOJI_OPTIONS.map((e) => (
                <TouchableOpacity
                  key={e}
                  onPress={() => setEmoji(e)}
                  style={[cStyles.emojiBtn, emoji === e && cStyles.emojiBtnActive]}
                >
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Title */}
            <Text style={cStyles.fieldLabel}>Event name <Text style={cStyles.charHint}>({title.length}/15)</Text></Text>
            <TextInput
              style={cStyles.input}
              placeholder="e.g. Rooftop hangout"
              placeholderTextColor="#c9a0b5"
              value={title}
              onChangeText={(t) => setTitle(t.slice(0, 15))}
              maxLength={15}
            />

            {/* Type */}
            <Text style={cStyles.fieldLabel}>What's it about? <Text style={cStyles.charHint}>({type.length}/100)</Text></Text>
            <TextInput
              style={[cStyles.input, { minHeight: 64, textAlignVertical: "top" }]}
              placeholder="Describe the vibe…"
              placeholderTextColor="#c9a0b5"
              value={type}
              onChangeText={(t) => setType(t.slice(0, 100))}
              maxLength={100}
              multiline
            />

            {/* Max people */}
            <Text style={cStyles.fieldLabel}>Max attendees</Text>
            <TextInput
              style={cStyles.input}
              placeholder="10"
              placeholderTextColor="#c9a0b5"
              value={maxPeople}
              onChangeText={setMaxPeople}
              keyboardType="number-pad"
              maxLength={3}
            />

            {/* From → To */}
            <Text style={cStyles.fieldLabel}>From</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              <TouchableOpacity style={[cStyles.dateChip, { flex: 1 }]} onPress={() => setActivePicker("from")}>
                <Ionicons name="calendar-outline" size={13} color={PINK} />
                <Text style={cStyles.dateChipText}>{dateFrom.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[cStyles.dateChip, { flex: 1 }]} onPress={() => setActivePicker("fromTime")}>
                <Ionicons name="time-outline" size={13} color={PINK} />
                <Text style={cStyles.dateChipText}>{dateFrom.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</Text>
              </TouchableOpacity>
            </View>

            <Text style={cStyles.fieldLabel}>To</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              <TouchableOpacity style={[cStyles.dateChip, { flex: 1 }]} onPress={() => setActivePicker("to")}>
                <Ionicons name="calendar-outline" size={13} color={PINK} />
                <Text style={cStyles.dateChipText}>{dateTo.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[cStyles.dateChip, { flex: 1 }]} onPress={() => setActivePicker("toTime")}>
                <Ionicons name="time-outline" size={13} color={PINK} />
                <Text style={cStyles.dateChipText}>{dateTo.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</Text>
              </TouchableOpacity>
            </View>

            {/* DateTimePicker */}
            {activePicker && (
              <DateTimePicker
                value={activePicker === "from" || activePicker === "fromTime" ? dateFrom : dateTo}
                mode={activePicker === "from" || activePicker === "to" ? "date" : "time"}
                display="default"
                onChange={(e, d) => handlePickerChange(activePicker, e, d)}
              />
            )}

            <TouchableOpacity
              style={[cStyles.createBtn, saving && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={cStyles.createBtnText}>Create Event 🎉</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={cStyles.cancelBtn} onPress={() => { reset(); onClose(); }}>
              <Text style={cStyles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const cStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(42,21,32,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: "90%",
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: BORDER, alignSelf: "center", marginBottom: 14 },
  title: { fontSize: 20, fontWeight: "700", color: DARK, marginBottom: 16 },
  fieldLabel: { fontSize: 11, fontWeight: "600", color: SOFT, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  charHint: { fontSize: 10, color: "#c9a0b5", textTransform: "none", letterSpacing: 0 },
  input: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13, color: DARK, backgroundColor: BG, marginBottom: 12,
  },
  emojiBtn: {
    width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: BORDER, marginRight: 6,
  },
  emojiBtnActive: { borderColor: PINK, backgroundColor: "#fce8ef" },
  dateChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1, borderColor: BORDER, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 9, backgroundColor: BG,
  },
  dateChipText: { fontSize: 12, color: DARK, fontWeight: "500" },
  createBtn: {
    backgroundColor: PINK, borderRadius: 50, paddingVertical: 14,
    alignItems: "center", marginBottom: 10,
  },
  createBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelBtnText: { color: SOFT, fontSize: 13 },
});

// ─── Chat Modal ─────────────────────────────────────────────────────────────────
function ChatModal({ visible, event, currentUsername, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const flatRef = useRef(null);
  const ended = event ? isEventOver(event) : false;

  useEffect(() => {
    if (!visible || !event) return;
    const q = query(collection(db, "events", event.id, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return unsub;
  }, [visible, event?.id]);

  const sendMessage = async () => {
    if (!text.trim() || !event) return;
    const user = auth.currentUser;
    if (!user) return;
    await addDoc(collection(db, "events", event.id, "messages"), {
      text: text.trim(),
      uid: user.uid,
      username: currentUsername,
      createdAt: Timestamp.now(),
    });
    setText("");
  };

  if (!event) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={chatStyles.root}>
        {/* Header */}
        <View style={chatStyles.header}>
          <TouchableOpacity onPress={onClose} style={chatStyles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={DARK} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={chatStyles.headerTitle}>{event.emoji} {event.title}</Text>
            <Text style={chatStyles.headerSub}>
              {ended ? "Event ended" : `${event.attendees?.length || 0} members`}
            </Text>
          </View>
        </View>

        {ended && (
          <View style={chatStyles.endedBanner}>
            <Text style={chatStyles.endedText}>This event has ended — chat is read-only</Text>
          </View>
        )}

        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={chatStyles.list}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          renderItem={({ item }) => {
            const mine = item.uid === auth.currentUser?.uid;
            const isSystem = item.uid === "system";
            if (isSystem) return (
              <View style={chatStyles.systemMsg}>
                <Text style={chatStyles.systemText}>{item.text}</Text>
              </View>
            );
            return (
              <View style={[chatStyles.msgRow, mine && chatStyles.msgRowMine]}>
                {!mine && (
                  <View style={chatStyles.msgAvatar}>
                    <Text style={chatStyles.msgInitial}>{item.username?.[0]?.toUpperCase()}</Text>
                  </View>
                )}
                <View style={[chatStyles.msgBubble, mine && chatStyles.msgBubbleMine]}>
                  {!mine && <Text style={chatStyles.msgUsername}>@{item.username}</Text>}
                  <Text style={[chatStyles.msgText, mine && chatStyles.msgTextMine]}>{item.text}</Text>
                </View>
              </View>
            );
          }}
        />

        {!ended && (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={chatStyles.inputRow}>
              <TextInput
                style={chatStyles.input}
                placeholder="Message…"
                placeholderTextColor="#c9a0b5"
                value={text}
                onChangeText={setText}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
              />
              <TouchableOpacity onPress={sendMessage} style={chatStyles.sendBtn}>
                <Ionicons name="send" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const chatStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: BORDER,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: BG, borderWidth: 1, borderColor: BORDER,
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 15, fontWeight: "700", color: DARK },
  headerSub: { fontSize: 11, color: SOFT, marginTop: 1 },
  endedBanner: { backgroundColor: "#fce8ef", paddingVertical: 8, alignItems: "center" },
  endedText: { fontSize: 12, color: PINK, fontWeight: "500" },
  list: { flex: 1 },
  systemMsg: { alignSelf: "center", backgroundColor: "rgba(232,68,122,0.1)", borderRadius: 50, paddingHorizontal: 12, paddingVertical: 5 },
  systemText: { fontSize: 11, color: PINK, textAlign: "center" },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 7, marginBottom: 2 },
  msgRowMine: { flexDirection: "row-reverse" },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: PINK, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  msgInitial: { color: "#fff", fontSize: 11, fontWeight: "700" },
  msgBubble: { maxWidth: "70%", backgroundColor: "#fff", borderRadius: 14, borderBottomLeftRadius: 4, padding: 9, borderWidth: 0.5, borderColor: BORDER },
  msgBubbleMine: { backgroundColor: PINK, borderBottomLeftRadius: 14, borderBottomRightRadius: 4, borderColor: "transparent" },
  msgUsername: { fontSize: 10, color: PINK, fontWeight: "700", marginBottom: 2 },
  msgText: { fontSize: 13, color: DARK, lineHeight: 18 },
  msgTextMine: { color: "#fff" },
  inputRow: {
    flexDirection: "row", gap: 8, padding: 10,
    backgroundColor: "#fff", borderTopWidth: 0.5, borderTopColor: BORDER,
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 25,
    paddingHorizontal: 14, paddingVertical: 9, fontSize: 13, color: DARK, backgroundColor: BG,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: PINK, justifyContent: "center", alignItems: "center" },
});

// ─── Event Detail Modal ─────────────────────────────────────────────────────────
function EventDetailModal({ visible, event, currentUsername, onClose, onDeleted }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [joining, setJoining] = useState(false);

  if (!event) return null;

  const uid = auth.currentUser?.uid;
  const isCreator = event.creator === uid;
  const isAttending = event.attendees?.includes(uid);
  const isFull = (event.attendees?.length || 0) >= (event.maxPeople || Infinity);
  const ended = isEventOver(event);

  const handleJoin = async () => {
    if (!uid) return;
    setJoining(true);
    try {
      await updateDoc(doc(db, "events", event.id), {
        attendees: isAttending ? arrayRemove(uid) : arrayUnion(uid),
      });
      if (!isAttending) {
        await addDoc(collection(db, "events", event.id, "messages"), {
          text: `👋 @${currentUsername} joined the event!`,
          uid: "system", username: "Daoda", createdAt: Timestamp.now(),
        });
      }
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleDelete = () => {
    Alert.alert("Delete event?", "This will remove the event and all messages.", [
      { text: "Cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "events", event.id));
            onDeleted();
            onClose();
          } catch (err) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={dStyles.backdrop}>
          <View style={dStyles.sheet}>
            <View style={dStyles.handle} />

            {/* Header */}
            <View style={dStyles.header}>
              <Text style={dStyles.emoji}>{event.emoji || "📍"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={dStyles.title}>{event.title}</Text>
                <Text style={dStyles.sub}>by @{event.creatorUsername}</Text>
              </View>
              {isCreator && (
                <TouchableOpacity onPress={handleDelete} style={dStyles.deleteBtn}>
                  <Ionicons name="trash-outline" size={16} color="#e53935" />
                </TouchableOpacity>
              )}
            </View>

            {/* Type */}
            <View style={dStyles.typeBox}>
              <Text style={dStyles.typeText}>{event.type}</Text>
            </View>

            {/* Date row */}
            <View style={dStyles.infoRow}>
              <Ionicons name="calendar-outline" size={14} color={PINK} />
              <Text style={dStyles.infoText}>
                {fmtDate(event.dateFrom)} {fmtTime(event.dateFrom)} → {fmtDate(event.dateTo)} {fmtTime(event.dateTo)}
              </Text>
            </View>

            {/* Attendees */}
            <View style={dStyles.infoRow}>
              <Ionicons name="people-outline" size={14} color={PINK} />
              <Text style={dStyles.infoText}>
                {event.attendees?.length || 0} / {event.maxPeople} going
              </Text>
              {ended && <View style={dStyles.endedBadge}><Text style={dStyles.endedBadgeText}>Ended</Text></View>}
              {!ended && isFull && !isAttending && <View style={dStyles.fullBadge}><Text style={dStyles.fullBadgeText}>Full</Text></View>}
            </View>

            {/* Buttons */}
            <View style={dStyles.btnRow}>
              {/* Join / Leave */}
              {!ended && (
                <TouchableOpacity
                  style={[
                    dStyles.joinBtn,
                    isAttending && dStyles.leaveBtn,
                    (isFull && !isAttending) && dStyles.disabledBtn,
                  ]}
                  onPress={handleJoin}
                  disabled={joining || (isFull && !isAttending)}
                  activeOpacity={0.8}
                >
                  {joining ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={dStyles.joinBtnText}>
                      {isAttending ? "Leave" : isFull ? "Event Full" : "Join Event"}
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              {/* Chat button — only for attendees */}
              {(isAttending || isCreator) && (
                <TouchableOpacity style={dStyles.chatBtn} onPress={() => setChatOpen(true)}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={PINK} />
                  <Text style={dStyles.chatBtnText}>Group Chat</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity onPress={onClose} style={dStyles.closeRow}>
              <Text style={dStyles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ChatModal
        visible={chatOpen}
        event={event}
        currentUsername={currentUsername}
        onClose={() => setChatOpen(false)}
      />
    </>
  );
}

const dStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(42,21,32,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: BORDER, alignSelf: "center", marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  emoji: { fontSize: 30 },
  title: { fontSize: 18, fontWeight: "700", color: DARK },
  sub: { fontSize: 11, color: SOFT, marginTop: 2 },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: "#fce8ef",
    backgroundColor: "#fff5f5", justifyContent: "center", alignItems: "center",
  },
  typeBox: { backgroundColor: BG, borderRadius: 10, padding: 10, borderWidth: 0.5, borderColor: BORDER, marginBottom: 12 },
  typeText: { fontSize: 13, color: DARK, lineHeight: 18 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 9 },
  infoText: { fontSize: 12, color: DARK, flex: 1 },
  endedBadge: { backgroundColor: "#eee", borderRadius: 50, paddingHorizontal: 8, paddingVertical: 2 },
  endedBadgeText: { fontSize: 10, color: "#888", fontWeight: "600" },
  fullBadge: { backgroundColor: "#fce8ef", borderRadius: 50, paddingHorizontal: 8, paddingVertical: 2 },
  fullBadgeText: { fontSize: 10, color: PINK, fontWeight: "600" },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 14, marginBottom: 8 },
  joinBtn: { flex: 1, backgroundColor: PINK, borderRadius: 50, paddingVertical: 12, alignItems: "center" },
  leaveBtn: { backgroundColor: "#888" },
  disabledBtn: { backgroundColor: "#ccc" },
  joinBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  chatBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1.5, borderColor: PINK, borderRadius: 50,
    paddingVertical: 11, paddingHorizontal: 16,
  },
  chatBtnText: { color: PINK, fontWeight: "600", fontSize: 13 },
  closeRow: { alignItems: "center", paddingTop: 6 },
  closeText: { color: SOFT, fontSize: 13 },
});

// ─── Events Bottom Sheet ────────────────────────────────────────────────────────
function EventsSheet({ events, onEventPress }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[sheetStyles.container, expanded && sheetStyles.containerExpanded]}>
      {/* Pull tab */}
      <TouchableOpacity style={sheetStyles.pullTab} onPress={() => setExpanded((v) => !v)}>
        <View style={sheetStyles.handle} />
        <Text style={sheetStyles.count}>
          {events.length} {events.length === 1 ? "event" : "events"} in this area
        </Text>
        <Ionicons name={expanded ? "chevron-down" : "chevron-up"} size={14} color={SOFT} />
      </TouchableOpacity>

      {expanded && (
        <ScrollView style={sheetStyles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {events.length === 0 ? (
            <View style={sheetStyles.empty}>
              <Text style={sheetStyles.emptyText}>Long press on the map to create an event</Text>
            </View>
          ) : (
            events.map((ev) => {
              const full = (ev.attendees?.length || 0) >= (ev.maxPeople || Infinity);
              const over = isEventOver(ev);
              return (
                <TouchableOpacity key={ev.id} style={sheetStyles.row} onPress={() => onEventPress(ev)} activeOpacity={0.8}>
                  <Text style={sheetStyles.rowEmoji}>{ev.emoji || "📍"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={sheetStyles.rowTitle}>{ev.title}</Text>
                    <Text style={sheetStyles.rowMeta}>
                      {fmtDate(ev.dateFrom)} {fmtTime(ev.dateFrom)} → {fmtTime(ev.dateTo)}
                    </Text>
                  </View>
                  <View style={sheetStyles.rowRight}>
                    <Text style={sheetStyles.rowCount}>{ev.attendees?.length || 0} going</Text>
                    {over && <View style={sheetStyles.badge}><Text style={sheetStyles.badgeText}>Ended</Text></View>}
                    {!over && full && <View style={[sheetStyles.badge, { backgroundColor: "#fce8ef" }]}><Text style={[sheetStyles.badgeText, { color: PINK }]}>Full</Text></View>}
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={SOFT} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 12 }} />
        </ScrollView>
      )}
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  container: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 0.5, borderColor: BORDER,
    shadowColor: "#000", shadowOpacity: 0.12, shadowOffset: { width: 0, height: -3 }, shadowRadius: 8,
    elevation: 6,
  },
  containerExpanded: { maxHeight: SHEET_MAX },
  pullTab: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: BORDER },
  count: { flex: 1, fontSize: 14, fontWeight: "700", color: DARK },
  list: { maxHeight: SHEET_MAX - 60 },
  empty: { padding: 20, alignItems: "center" },
  emptyText: { fontSize: 12, color: SOFT, textAlign: "center" },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 13,
    borderTopWidth: 0.5, borderTopColor: BORDER,
  },
  rowEmoji: { fontSize: 26, width: 36, textAlign: "center" },
  rowTitle: { fontSize: 13, fontWeight: "700", color: DARK, marginBottom: 2 },
  rowMeta: { fontSize: 11, color: SOFT },
  rowRight: { alignItems: "flex-end", gap: 3 },
  rowCount: { fontSize: 11, color: SOFT, fontWeight: "600" },
  badge: { backgroundColor: "#eee", borderRadius: 50, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 9, color: "#888", fontWeight: "700" },
});

// ─── Main Screen ────────────────────────────────────────────────────────────────
export default function NearbyScreen() {
  const [location, setLocation] = useState(null);
  const [events, setEvents] = useState([]);
  const [pendingCoords, setPendingCoords] = useState({ lat: 0, lng: 0 });
  const [createVisible, setCreateVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentUsername, setCurrentUsername] = useState("You");
  const mapRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Need location access for nearby events.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc.coords);
    })();

    // Fetch current username
    const user = auth.currentUser;
    if (user) {
      getDoc(doc(db, "users", user.uid)).then((snap) => {
        if (snap.exists()) setCurrentUsername(snap.data().username || "You");
      });
    }

    // Real-time events listener
    const unsub = onSnapshot(collection(db, "events"), (snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const nearbyEvents = location
    ? events.filter((ev) => getDistance(location, { latitude: ev.lat, longitude: ev.lng }) < 50)
    : [];

  const handleLongPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPendingCoords({ lat: latitude, lng: longitude });
    setCreateVisible(true);
  };

  const openEvent = (ev) => {
    setSelectedEvent(ev);
    setDetailVisible(true);
  };

  // Keep selectedEvent in sync with live data
  const liveSelected = selectedEvent
    ? events.find((e) => e.id === selectedEvent.id) || selectedEvent
    : null;

  return (
    <View style={styles.root}>
      {location ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFillObject}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          }}
          showsUserLocation
          onLongPress={handleLongPress}
        >
          {nearbyEvents.map((ev) => (
            <Marker
              key={ev.id}
              coordinate={{ latitude: ev.lat, longitude: ev.lng }}
              onPress={() => openEvent(ev)}
              tracksViewChanges={false}
            >
              <EventPin event={ev} />
            </Marker>
          ))}
        </MapView>
      ) : (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={PINK} size="large" />
          <Text style={styles.loadingText}>Getting your location…</Text>
        </View>
      )}

      {/* Hint overlay */}
      <View style={styles.hintBox}>
        <Text style={styles.hintText}>Long press on map to create an event</Text>
      </View>

      {/* Bottom sheet */}
      <EventsSheet events={nearbyEvents} onEventPress={openEvent} />

      {/* Create modal */}
      <CreateEventModal
        visible={createVisible}
        lat={pendingCoords.lat}
        lng={pendingCoords.lng}
        onClose={() => setCreateVisible(false)}
        onCreated={() => {
          setCreateVisible(false);
          Alert.alert("Event created! 🎉", "Your event is now live on the map.");
        }}
      />

      {/* Detail modal */}
      <EventDetailModal
        visible={detailVisible}
        event={liveSelected}
        currentUsername={currentUsername}
        onClose={() => setDetailVisible(false)}
        onDeleted={() => setSelectedEvent(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f9f9f9" },
  loadingBox: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { fontSize: 13, color: SOFT },
  hintBox: {
    position: "absolute", top: TOP_GAP + 10, alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 50,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 0.5, borderColor: BORDER,
    shadowColor: "#000", shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
    elevation: 3,
  },
  hintText: { fontSize: 11, color: DARK, fontWeight: "500" },
});