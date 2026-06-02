import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => {}}
      >
        <Text style={styles.buttonText}>开始</Text>
      </Pressable>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#000000',
  },
  buttonPressed: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 2,
  },
});
