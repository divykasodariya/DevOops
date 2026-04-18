import { View, Text, StyleSheet } from "react-native";

export default function DashboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Dashboard Working 🚀</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A1008",
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    color: "white",
    fontSize: 20,
  },
});
