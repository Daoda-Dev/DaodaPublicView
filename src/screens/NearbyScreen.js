import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, Alert, Dimensions } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import DateTimePicker from "@react-native-community/datetimepicker";
import { collection, addDoc, getDocs, Timestamp } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";

const { width, height } = Dimensions.get("window");

export default function NearbyScreen() {
  const [location, setLocation] = useState(null);
  const [events, setEvents] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", desc: "", date: new Date(), lat: 0, lng: 0 });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const mapRef = useRef(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Need location access for nearby events.");
        return;
      }
      let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc.coords);
      fetchEvents(loc.coords);
    })();
  }, []);

  const fetchEvents = async (userLoc) => {
    try {
      const querySnapshot = await getDocs(collection(db, "events"));
      const fetchedEvents = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const nearbyEvents = fetchedEvents.filter((event) =>
        getDistance(userLoc, { latitude: event.lat, longitude: event.lng }) < 50 // km
      );
      setEvents(nearbyEvents);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const handleLongPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setNewEvent({ ...newEvent, lat: latitude, lng: longitude });
    setModalVisible(true);
  };

  const createEvent = async () => {
    if (!newEvent.title || !newEvent.desc) {
      Alert.alert("Error", "Fill in title and description.");
      return;
    }
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not logged in");
      await addDoc(collection(db, "events"), {
        title: newEvent.title,
        desc: newEvent.desc,
        date: Timestamp.fromDate(newEvent.date),
        lat: newEvent.lat,
        lng: newEvent.lng,
        creator: user.uid, // "Under username" – use uid; add displayName if needed
      });
      setModalVisible(false);
      setNewEvent({ title: "", desc: "", date: new Date(), lat: 0, lng: 0 });
      fetchEvents(location); // Refresh
      Alert.alert("Success", "Event created!");
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

  const getDistance = (loc1, loc2) => {
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6371; // Earth radius km
    const dLat = toRad(loc2.latitude - loc1.latitude);
    const dLon = toRad(loc2.longitude - loc1.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(loc1.latitude)) * Math.cos(toRad(loc2.latitude)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  return (
    <View style={styles.container}>
      {location ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
          showsUserLocation={true}
          onLongPress={handleLongPress}
        >
          {events.map((event) => (
            <Marker
              key={event.id}
              coordinate={{ latitude: event.lat, longitude: event.lng }}
              title={event.title}
              description={event.desc}
            />
          ))}
        </MapView>
      ) : (
        <Text style={styles.loading}>Loading map...</Text>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Event</Text>
            <TextInput
              placeholder="Title"
              style={styles.input}
              value={newEvent.title}
              onChangeText={(text) => setNewEvent({ ...newEvent, title: text })}
            />
            <TextInput
              placeholder="Description"
              style={styles.input}
              value={newEvent.desc}
              onChangeText={(text) => setNewEvent({ ...newEvent, desc: text })}
            />
            <TouchableOpacity onPress={() => setShowDatePicker(true)}>
              <Text style={styles.dateText}>Date: {newEvent.date.toLocaleString()}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={newEvent.date}
                mode="datetime"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) setNewEvent({ ...newEvent, date: selectedDate });
                }}
              />
            )}
            <TouchableOpacity style={styles.button} onPress={createEvent}>
              <Text style={styles.buttonText}>Create</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buttonCancel} onPress={() => setModalVisible(false)}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width, height },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  modalContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  modalContent: { backgroundColor: "#fff", padding: 20, borderRadius: 10, width: "80%" },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  input: { borderBottomWidth: 1, borderColor: "#ccc", marginBottom: 15, padding: 10 },
  dateText: { padding: 10, borderBottomWidth: 1, borderColor: "#ccc", marginBottom: 15 },
  button: { backgroundColor: "red", padding: 15, borderRadius: 5, alignItems: "center", marginTop: 10 },
  buttonCancel: { backgroundColor: "gray", padding: 15, borderRadius: 5, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#fff", fontWeight: "bold" },
});