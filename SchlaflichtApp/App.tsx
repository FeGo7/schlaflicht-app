/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  Colors,
  DebugInstructions,
  Header,
  LearnMoreLinks,
  ReloadInstructions,
} from 'react-native/Libraries/NewAppScreen';

interface Lamp {
  id: string;
  name: string;
  type: 'dummy' | 'shelly';
  ip?: string;
  isOn?: boolean;
}

const DUMMY_LAMPS: Lamp[] = [
  {
    id: 'dummy-1',
    name: 'Nachtlicht Kinderzimmer 1',
    type: 'dummy',
    isOn: true,
  },
  {
    id: 'dummy-2',
    name: 'Nachtlicht Kinderzimmer 2',
    type: 'dummy',
    isOn: false,
  },
];

const STORAGE_KEY = 'schlaflichtDeviceList';

async function loadLamps(): Promise<Lamp[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (json) return JSON.parse(json);
  } catch {}
  return [];
}
async function saveLamps(lamps: Lamp[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lamps));
}

async function setLampState(lamp: Lamp, on: boolean) {
  if (lamp.type === 'dummy') return;
  if (lamp.type === 'shelly' && lamp.ip) {
    try {
      await fetch(
        `http://${lamp.ip}/light/0?turn=${on ? 'on' : 'off'}`,
        {method: 'POST'},
      );
    } catch (e) {
      Alert.alert('Fehler', 'Shelly-Lampe nicht erreichbar.');
    }
  }
}

const LampCard = ({
  lamp,
  onToggle,
  onDelete,
}: {
  lamp: Lamp;
  onToggle: (on: boolean) => void;
  onDelete: () => void;
}) => (
  <View style={styles.lampCard}>
    <View style={{flex: 1}}>
      <Text style={styles.lampName}>{lamp.name}</Text>
      <Text style={styles.lampType}>
        {lamp.type === 'dummy'
          ? 'Demo-Lampe'
          : lamp.type === 'shelly'
          ? 'Shelly (LAN)'
          : lamp.type}
      </Text>
    </View>
    <Switch
      value={!!lamp.isOn}
      onValueChange={onToggle}
      thumbColor={lamp.isOn ? '#7c3aed' : '#ccc'}
      trackColor={{false: '#bbb', true: '#a5b4fc'}}
    />
    <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
      <Text style={{color: '#fff'}}>🗑️</Text>
    </TouchableOpacity>
  </View>
);

const App = () => {
  const [lamps, setLamps] = useState<Lamp[] | null>(null);
  const [loading, setLoading] = useState(true);
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    flex: 1,
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  useEffect(() => {
    loadLamps().then(list => {
      setLamps(list.length ? list : DUMMY_LAMPS);
      setLoading(false);
    });
  }, []);

  const updateLamp = async (id: string, isOn: boolean) => {
    if (!lamps) return;
    const updated = lamps.map(l => (l.id === id ? {...l, isOn} : l));
    setLamps(updated);
    await saveLamps(updated);
    const lamp = updated.find(l => l.id === id);
    if (lamp) await setLampState(lamp, isOn);
  };

  const deleteLamp = async (id: string) => {
    if (!lamps) return;
    const updated = lamps.filter(l => l.id !== id);
    setLamps(updated);
    await saveLamps(updated);
  };

  if (loading || !lamps)
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      <View style={{padding: 16, flex: 1}}>
        <Text style={styles.title}>Schlaflicht Lampen</Text>
        <FlatList
          data={lamps}
          keyExtractor={item => item.id}
          renderItem={({item}) => (
            <LampCard
              lamp={item}
              onToggle={on => updateLamp(item.id, on)}
              onDelete={() => deleteLamp(item.id)}
            />
          )}
          contentContainerStyle={{paddingBottom: 40}}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
  },
  container: {flex: 1, backgroundColor: '#f3f4f6', padding: 16},
  centered: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#7c3aed',
    textAlign: 'center',
  },
  lampCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  lampName: {fontSize: 18, fontWeight: 'bold', color: '#222'},
  lampType: {fontSize: 14, color: '#888', marginTop: 2},
  deleteBtn: {
    marginLeft: 12,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    padding: 8,
  },
});

export default App;
