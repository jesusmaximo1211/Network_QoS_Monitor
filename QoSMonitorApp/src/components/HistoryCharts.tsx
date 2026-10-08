import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { DBService, MeasurementRecord } from '../db/Database';
import { LineChart } from 'react-native-chart-kit';

const { width } = Dimensions.get('window');

export default function HistoryCharts() {
  const [data, setData] = useState<MeasurementRecord[]>([]);
  const [filter, setFilter] = useState<string>('ALL'); // RF-09 Filter

  useEffect(() => {
    const loadData = async () => {
      let records = await DBService.getHistory(filter);
      // Reverse to show chronological order left to right
      records = records.reverse();
      setData(records);
    };
    loadData();
  }, [filter]);

  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No hay datos históricos para graficar.</Text>
      </View>
    );
  }

  let pingValues = data.filter(d => d.avgPing !== null).map(d => d.avgPing as number);
  let downloadValues = data.filter(d => d.downloadMbps !== null).map(d => d.downloadMbps as number);

  if (pingValues.length === 0) pingValues = [0];
  if (downloadValues.length === 0) downloadValues = [0];

  const chartConfig = {
    backgroundGradientFrom: '#1e293b',
    backgroundGradientTo: '#1e293b',
    color: (opacity = 1) => "rgba(244, 63, 94, " + opacity + ")",
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#e11d48'
    }
  };

  const chartConfigDL = {
    backgroundGradientFrom: '#1e293b',
    backgroundGradientTo: '#1e293b',
    color: (opacity = 1) => "rgba(16, 185, 129, " + opacity + ")",
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#059669'
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.filterRow}>
        <TouchableOpacity style={[styles.filterBtn, filter==='ALL' && styles.filterBtnActive]} onPress={()=>setFilter('ALL')}>
          <Text style={styles.filterText}>Todos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterBtn, filter==='cellular' && styles.filterBtnActive]} onPress={()=>setFilter('cellular')}>
          <Text style={styles.filterText}>Celular</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterBtn, filter==='wifi' && styles.filterBtnActive]} onPress={()=>setFilter('wifi')}>
          <Text style={styles.filterText}>Wi-Fi</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Latencia Histórica (TCP RTT - ms)</Text>
        <View style={styles.chartWrapper}>
          <LineChart
            data={{
              labels: pingValues.map((_, i) => String(i + 1)),
              datasets: [{ data: pingValues }]
            }}
            width={width - 40}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={{ borderRadius: 16 }}
            withInnerLines={true}
            withOuterLines={false}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Velocidad de Descarga (Mbps)</Text>
        <View style={styles.chartWrapper}>
          <LineChart
            data={{
              labels: downloadValues.map((_, i) => String(i + 1)),
              datasets: [{ data: downloadValues }]
            }}
            width={width - 40}
            height={220}
            chartConfig={chartConfigDL}
            bezier
            style={{ borderRadius: 16 }}
            withInnerLines={true}
            withOuterLines={false}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, marginTop: 20 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 10, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#f8fafc', marginBottom: 10, textAlign: 'center' },
  chartWrapper: { alignItems: 'center' },
  filterRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 15 },
  filterBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#334155', marginHorizontal: 5 },
  filterBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  filterText: { color: '#f8fafc', fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 16 }
});
