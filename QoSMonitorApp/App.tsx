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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Monitor QoS</Text>
        <Text style={styles.headerSubtitle}>Análisis de red en tiempo real</Text>
      </View>

      <Text style={styles.sectionTitle}>Estado de la Conexión</Text>
      <View style={styles.gridContainer}>
        <View style={styles.gridCard}>
          <Text style={styles.gridLabel}>Estado</Text>
          <Text style={[styles.gridValue, netInfo.isConnected ? styles.connected : styles.disconnected]}>
            {netInfo.isConnected ? 'Conectado' : 'Desconectado'}
          </Text>
        </View>

        <View style={styles.gridCard}>
          <Text style={styles.gridLabel}>Tipo de Red</Text>
          <Text style={styles.gridValue}>{netInfo.type?.toUpperCase() || 'Desconocido'}</Text>
        </View>

        {netInfo.type === 'wifi' && (
          <View style={[styles.gridCard, styles.fullWidthCard]}>
            <Text style={styles.gridLabel}>SSID (Wi-Fi)</Text>
            <Text style={styles.gridValue}>{netInfo.details?.ssid || 'N/A'}</Text>
          </View>
        )}

        {netInfo.type === 'cellular' && cellularInfo && (
          <>
            <View style={[styles.gridCard, styles.fullWidthCard]}>
              <Text style={styles.gridLabel}>Operador</Text>
              <Text style={styles.gridValue}>{cellularInfo.operatorName || 'N/A'}</Text>
            </View>
            <View style={styles.gridCard}>
              <Text style={styles.gridLabel}>Tecnología</Text>
              <Text style={styles.gridValue}>{cellularInfo.networkType || 'N/A'} ({cellularInfo.cellTech})</Text>
            </View>
            <View style={styles.gridCard}>
              <Text style={styles.gridLabel}>Señal (RSSI)</Text>
              <Text style={styles.gridValue}>{cellularInfo.rssi < 0 ? `${cellularInfo.rssi} dBm` : 'N/A'}</Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={[styles.primaryButton, isTesting && styles.buttonDisabled]} 
          onPress={runQoSTest}
          disabled={isTesting || !netInfo.isConnected}
        >
          {isTesting ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.primaryButtonText}> Analizando Red...</Text>
            </View>
          ) : (
            <Text style={styles.primaryButtonText}>INICIAR TEST QoS</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.secondaryButton, isExporting && styles.buttonDisabled]} 
          onPress={handleExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator color="#38bdf8" size="small" />
          ) : (
            <Text style={styles.secondaryButtonText}>Exportar Resultados CSV</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Resultados Organizados */}
      {(Object.keys(pingStats).length > 0 || throughputStats) && (
        <View style={styles.resultsWrapper}>
          <Text style={styles.sectionTitle}>Resultados del Test</Text>
          
          {throughputStats && (
            <View style={styles.throughputCard}>
              <View style={styles.speedBox}>
                <Text style={styles.speedLabel}>Descarga</Text>
                <Text style={styles.speedValue}>{throughputStats.downloadMbps.toFixed(1)} <Text style={styles.speedUnit}>Mbps</Text></Text>
              </View>
              <View style={styles.speedDivider} />
              <View style={styles.speedBox}>
                <Text style={styles.speedLabel}>Subida</Text>
                <Text style={styles.speedValue}>{throughputStats.uploadMbps.toFixed(1)} <Text style={styles.speedUnit}>Mbps</Text></Text>
              </View>
            </View>
          )}

          {Object.keys(pingStats).length > 0 && (
            <View style={styles.pingContainer}>
              {Object.entries(pingStats).map(([host, stats]) => (
                <View key={host} style={styles.pingCard}>
                  <Text style={styles.pingHost}>{host}</Text>
                  <View style={styles.pingMetrics}>
                    <View style={styles.pingMetricBox}>
                      <Text style={styles.pingMetricLabel}>Latencia</Text>
                      <Text style={styles.pingMetricValue}>{stats.avg.toFixed(0)} ms</Text>
                    </View>
                    <View style={styles.pingMetricBox}>
                      <Text style={styles.pingMetricLabel}>Jitter</Text>
                      <Text style={styles.pingMetricValue}>{stats.jitter.toFixed(0)} ms</Text>
                    </View>
                    <View style={styles.pingMetricBox}>
                      <Text style={styles.pingMetricLabel}>Pérdida</Text>
                      <Text style={[styles.pingMetricValue, stats.packetLoss > 0 ? styles.lossWarning : null]}>
                        {stats.packetLoss.toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B1120" />
      
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
    backgroundColor: '#0B1120',
  },
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  scroll: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    marginTop: 10,
    marginBottom: 30,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  gridCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    width: '48%',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  fullWidthCard: {
    width: '100%',
  },
  gridLabel: {
    fontSize: 12,
    color: '#94A3B8',
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  gridValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  connected: {
    color: '#10B981',
  },
  disconnected: {
    color: '#EF4444',
  },
  actionsContainer: {
    marginTop: 10,
    marginBottom: 30,
  },
  primaryButton: {
    backgroundColor: '#0EA5E9',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    marginTop: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#38BDF8',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  resultsWrapper: {
    marginTop: 10,
  },
  throughputCard: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  speedBox: {
    alignItems: 'center',
  },
  speedDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#334155',
  },
  speedLabel: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  speedValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#10B981',
  },
  speedUnit: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
  pingContainer: {
    marginTop: 10,
  },
  pingCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0EA5E9',
  },
  pingHost: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  pingMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pingMetricBox: {
    alignItems: 'flex-start',
  },
  pingMetricLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  pingMetricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  lossWarning: {
    color: '#F59E0B',
  },
  contentArea: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingBottom: 24,
    paddingTop: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  activeTab: {
    // No background, just a colored underline and text
  },
  tabText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#38BDF8',
    fontWeight: '800',
  }
});
