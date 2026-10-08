import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, StatusBar, PermissionsAndroid, Platform, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { getCellularInfo, CellularInfo } from './src/native/TelephonyModule';
import { PingEngine, PingStats } from './src/engine/PingEngine';
import { ThroughputEngine, ThroughputResult } from './src/engine/ThroughputEngine';
import { GeoService } from './src/geo/GeoLocation';
import { DBService, MeasurementRecord } from './src/db/Database';

// Import Visualizers & Background/Export
import HistoryMap from './src/components/HistoryMap';
import HistoryCharts from './src/components/HistoryCharts';
import { configureBackgroundFetch } from './src/background/BackgroundService';
import { ExportService } from './src/utils/ExportService';

function AppContent() {
  const netInfo = useNetInfo();
  const [cellularInfo, setCellularInfo] = useState<CellularInfo | null>(null);
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'charts'>('dashboard');

  // QoS Test States
  const [isTesting, setIsTesting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // RF-02 Configurable Hosts
  const [targetHosts, setTargetHosts] = useState<string[]>(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
  
  const [pingStats, setPingStats] = useState<Record<string, PingStats>>({});
  const [throughputStats, setThroughputStats] = useState<ThroughputResult | null>(null);

  useEffect(() => {
    // Init Database & Background Fetch
    DBService.initDB();
    configureBackgroundFetch();

    const fetchNativeInfo = async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
        ]);
        
        if (
          granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.READ_PHONE_STATE'] === PermissionsAndroid.RESULTS.GRANTED
        ) {
          const info = await getCellularInfo();
          setCellularInfo(info);
        }
      }
    };

    if (netInfo.type === 'cellular') {
      fetchNativeInfo();
      const interval = setInterval(fetchNativeInfo, 5000);
      return () => clearInterval(interval);
    } else {
      setCellularInfo(null);
    }
  }, [netInfo.type]);

  const runQoSTest = async () => {
    setIsTesting(true);
    setPingStats({});
    setThroughputStats(null);
    
    try {
      // 0. Get Location
      const coords = await GeoService.getCurrentPosition();

      // 1. Run Ping Suite against Configurable Hosts (RF-02)
      const pings = await PingEngine.runPingSuite(targetHosts, 5);
      setPingStats(pings);

      // 2. Run Throughput Test
      const tp = await ThroughputEngine.runFullTest();
      setThroughputStats(tp);

      // 3. Persist to Database
      const primaryPing = pings['8.8.8.8'] || pings['1.1.1.1'] || pings['8.8.4.4'];
      
      const record: MeasurementRecord = {
        timestamp: Date.now(),
        latitude: coords?.latitude || null,
        longitude: coords?.longitude || null,
        networkType: netInfo.type,
        operator: cellularInfo?.operatorName || null,
        rssi: cellularInfo?.rssi || null,
        avgPing: primaryPing ? primaryPing.avg : null,
        jitter: primaryPing ? primaryPing.jitter : null,
        downloadMbps: tp.downloadMbps,
        uploadMbps: tp.uploadMbps,
      };

      await DBService.insertMeasurement(record);

    } catch (e) {
      console.error("Test error", e);
    } finally {
      setIsTesting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    const path = await ExportService.exportToCSV();
    setIsExporting(false);
    if (path) {
      Alert.alert('Éxito', `Historial exportado a:\n${path}`);
    } else {
      Alert.alert('Error', 'No hay datos para exportar o hubo un error.');
    }
  };

  const renderDashboard = () => (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Estado de la Conexión</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Conectado:</Text>
          <Text style={[styles.infoValue, netInfo.isConnected ? styles.connected : styles.disconnected]}>
            {netInfo.isConnected ? 'Sí' : 'No'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tipo de Red (NetInfo):</Text>
          <Text style={styles.infoValue}>{netInfo.type?.toUpperCase() || 'Desconocido'}</Text>
        </View>

        {netInfo.type === 'wifi' && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>SSID (Wi-Fi):</Text>
            <Text style={styles.infoValue}>{netInfo.details?.ssid || 'N/A'}</Text>
          </View>
        )}

        {netInfo.type === 'cellular' && cellularInfo && (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Operador:</Text>
              <Text style={styles.infoValue}>{cellularInfo.operatorName || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tecnología de Red:</Text>
              <Text style={styles.infoValue}>{cellularInfo.networkType || 'N/A'} ({cellularInfo.cellTech})</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Intensidad (RSSI):</Text>
              <Text style={styles.infoValue}>{cellularInfo.rssi < 0 ? `${cellularInfo.rssi} dBm` : 'N/A'}</Text>
            </View>
          </>
        )}
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Alcanzable a Internet:</Text>
          <Text style={styles.infoValue}>{netInfo.isInternetReachable ? 'Sí' : 'No'}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Test de Calidad (QoS)</Text>
        
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.button, {flex: 1, marginRight: 10}, isTesting && styles.buttonDisabled]} 
            onPress={runQoSTest}
            disabled={isTesting || !netInfo.isConnected}
          >
            {isTesting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Probar Red</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.exportButton, {flex: 1}, isExporting && styles.buttonDisabled]} 
            onPress={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Exportar CSV</Text>
            )}
          </TouchableOpacity>
        </View>

        {Object.keys(pingStats).length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Ping & Latencia (TCP RTT)</Text>
            {Object.entries(pingStats).map(([host, stats]) => (
              <View key={host} style={styles.resultBlock}>
                <Text style={styles.hostName}>{host}</Text>
                <Text style={styles.statLine}>Avg: {stats.avg.toFixed(1)}ms | Jitter: {stats.jitter.toFixed(1)}ms</Text>
                <Text style={styles.statLine}>Min: {stats.min.toFixed(0)}ms | Max: {stats.max.toFixed(0)}ms</Text>
                <Text style={styles.statLine}>Loss: {stats.packetLoss.toFixed(0)}%</Text>
              </View>
            ))}
          </View>
        )}

        {throughputStats && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Throughput (Ancho de banda)</Text>
            <View style={styles.resultBlock}>
              <Text style={styles.statLine}>Descarga: <Text style={styles.highlight}>{throughputStats.downloadMbps.toFixed(2)} Mbps</Text></Text>
              <Text style={styles.statLine}>Subida: <Text style={styles.highlight}>{throughputStats.uploadMbps.toFixed(2)} Mbps</Text></Text>
            </View>
          </View>
        )}

      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Network QoS Monitor</Text>
      </View>

      <View style={styles.contentArea}>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'map' && <HistoryMap />}
        {activeTab === 'charts' && <HistoryCharts />}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'dashboard' && styles.activeTab]} 
          onPress={() => setActiveTab('dashboard')}
        >
          <Text style={[styles.tabText, activeTab === 'dashboard' && styles.activeTabText]}>Test</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'map' && styles.activeTab]} 
          onPress={() => setActiveTab('map')}
        >
          <Text style={[styles.tabText, activeTab === 'map' && styles.activeTabText]}>Mapa</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'charts' && styles.activeTab]} 
          onPress={() => setActiveTab('charts')}
        >
          <Text style={[styles.tabText, activeTab === 'charts' && styles.activeTabText]}>Historial</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider style={styles.provider}>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  provider: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#38bdf8',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: '#94a3b8',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#e2e8f0',
  },
  connected: {
    color: '#4ade80',
  },
  disconnected: {
    color: '#f87171',
  },
  button: {
    backgroundColor: '#0ea5e9',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  exportButton: {
    backgroundColor: '#10b981',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buttonDisabled: {
    backgroundColor: '#475569',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultsContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  resultsTitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 10,
    fontWeight: '600',
  },
  resultBlock: {
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  hostName: {
    color: '#38bdf8',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLine: {
    color: '#cbd5e1',
    fontSize: 14,
    marginBottom: 2,
  },
  highlight: {
    color: '#4ade80',
    fontWeight: 'bold',
  },
  contentArea: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingBottom: 20,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#38bdf8',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#38bdf8',
    fontWeight: 'bold',
  }
});
