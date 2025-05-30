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
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';

// Icons: Unicode Emojis statt vector-icons

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

const PRIMARY = '#2563eb'; // Blau
const ACCENT = '#22d3ee'; // Türkis
const BG = '#f8fafc'; // Sehr helles Grau
const CARD = '#fff';
const TEXT = '#222';
const SUBTLE = '#64748b';
const DANGER = '#ef4444';

const LampCard = ({
  lamp,
  onToggle,
  onDelete,
}: {
  lamp: Lamp;
  onToggle: (on: boolean) => void;
  onDelete: () => void;
}) => {
  // Dummy brightness state (später persistieren)
  const [brightness, setBrightness] = React.useState(0.5);
  return (
    <View style={styles.lampCard}>
      <View style={{flex: 1}}>
        <Text style={styles.lampName}>{lamp.name}</Text>
        <Text style={styles.lampType}>
          {lamp.type === 'dummy'
            ? lamp.isOn ? 'Demo-Lampe' : 'Ausgeschaltet'
            : lamp.type === 'shelly'
            ? lamp.isOn ? 'Shelly (LAN)' : 'Ausgeschaltet'
            : lamp.type}
        </Text>
        <Text style={styles.lampLabel}>Helligkeit</Text>
        <Slider
          style={{width: '100%', height: 32, marginVertical: 2}}
          minimumValue={0}
          maximumValue={1}
          value={brightness}
          minimumTrackTintColor={PRIMARY}
          maximumTrackTintColor={'#e5e7eb'}
          thumbTintColor={PRIMARY}
          onValueChange={setBrightness}
        />
        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 8}}>
          <TouchableOpacity style={styles.lampBtn}>
            <Text style={styles.lampBtnText}>Timer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.lampBtn} onPress={onDelete} accessibilityLabel="Lampe löschen">
            <Text style={styles.lampBtnText}>Löschen</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Switch
        value={!!lamp.isOn}
        onValueChange={onToggle}
        thumbColor={lamp.isOn ? PRIMARY : '#ccc'}
        trackColor={{false: '#cbd5e1', true: ACCENT}}
        style={{marginLeft: 12, alignSelf: 'flex-start'}}
      />
    </View>
  );
};

type TabKey = 'lamps' | 'profiles' | 'energy';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'lamps', label: 'Lampen', icon: '💡' }, // Glühbirne für Lampen
  { key: 'profiles', label: 'Profile', icon: '👥' },
  { key: 'energy', label: 'Energie', icon: '⚡' }, // Blitz für Energie
];

const App = () => {
  const [lamps, setLamps] = useState<Lamp[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('lamps');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    flex: 1,
    backgroundColor: BG,
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
    <SafeAreaView style={[backgroundStyle, {paddingTop: Platform.OS === 'android' ? 32 : 0}]}> {/* Extra Padding für Android-Statusleiste */}
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={BG}
      />
      {/* Header mit Titel, Tabs und Settings-Icon */}
      <View style={{paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, backgroundColor: BG}}>
        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 56, position: 'relative'}}>
          <Text style={styles.title}>Schlaflicht</Text>
          <TouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.settingsBtn} accessibilityLabel="Einstellungen öffnen">
            <Text style={{fontSize: 26, color: PRIMARY}}>🛠️</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.tabBar}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab.key)}
              accessibilityLabel={tab.label}
            >
              <Text style={{fontSize: 20, marginRight: 4}}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, activeTab === tab.key && {color: PRIMARY}]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={{flex: 1, padding: 16}}>
        {activeTab === 'lamps' && (
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
        )}
        {activeTab === 'profiles' && (
          <View style={styles.centered}><Text style={{color:SUBTLE}}>Profile-Tab (in Arbeit)</Text></View>
        )}
        {activeTab === 'energy' && (
          <View style={styles.centered}><Text style={{color:SUBTLE}}>Energie-Tab (in Arbeit)</Text></View>
        )}
      </View>
      {/* Floating Action Button zum Hinzufügen */}
      {activeTab === 'lamps' && (
        <TouchableOpacity style={styles.fab} onPress={() => setAddVisible(true)} accessibilityLabel="Lampe hinzufügen">
          <Text style={{fontSize: 32, color: '#fff'}}>✚</Text>
        </TouchableOpacity>
      )}
      {/* Settings Modal */}
      {settingsVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={{fontSize:20, fontWeight:'bold', marginBottom:12}}>Einstellungen</Text>
            <Text style={{color:SUBTLE}}>Hier können später Einstellungen angepasst werden.</Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setSettingsVisible(false)} accessibilityLabel="Schließen">
              <Text style={{fontSize: 22, color: '#fff'}}>❌</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {/* Add Lamp Modal (Platzhalter) */}
      {addVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={{fontSize:20, fontWeight:'bold', marginBottom:12}}>Lampe hinzufügen</Text>
            <Text style={{color:SUBTLE}}>Geräte-Discovery und manuelles Hinzufügen folgen.</Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setAddVisible(false)} accessibilityLabel="Schließen">
              <Text style={{fontSize: 22, color: '#fff'}}>❌</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
    fontSize: 30,
    fontWeight: 'bold',
    color: PRIMARY,
    textAlign: 'center',
    flex: 1,
    marginTop: 0,
    marginBottom: 0,
  },
  settingsBtn: {
    position: 'absolute',
    right: 18,
    top: 12,
    padding: 4,
    zIndex: 2,
  },
  lampCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 20,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 4,
  },
  lampName: {fontSize: 20, fontWeight: 'bold', color: TEXT},
  lampType: {fontSize: 15, color: SUBTLE, marginTop: 2, marginBottom: 8},
  lampLabel: {fontSize: 15, color: TEXT, marginTop: 2, marginBottom: 0, fontWeight: '500'},
  lampBtn: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 18,
    marginHorizontal: 2,
    shadowColor: 'transparent',
  },
  lampBtnText: {
    color: TEXT,
    fontWeight: '500',
    fontSize: 15,
  },
  deleteBtn: {
    marginLeft: 14,
    backgroundColor: 'transparent', // Kein roter Hintergrund mehr
    borderRadius: 10,
    padding: 8,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  tabBtn: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    borderBottomWidth: 2,
    borderColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderColor: PRIMARY,
    backgroundColor: '#e0e7ff',
  },
  tabLabel: {
    fontSize: 16,
    color: SUBTLE,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  fab: {
    position: 'absolute',
    right: 28,
    bottom: 36,
    backgroundColor: PRIMARY,
    borderRadius: 32,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  modalOverlay: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    minWidth: 260,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  modalClose: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#7c3aed',
    borderRadius: 16,
    padding: 4,
  },
});

export default App;
