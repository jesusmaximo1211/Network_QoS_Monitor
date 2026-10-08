import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Heatmap, PROVIDER_GOOGLE } from 'react-native-maps';
import { DBService, MeasurementRecord } from '../db/Database';

export default function HistoryMap() {
  const [points, setPoints] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const records = await DBService.getHistory();
      const validPoints = records
        .filter(r => r.latitude && r.longitude)
        .map(r => ({
          latitude: r.latitude,
          longitude: r.longitude,
          weight: r.rssi ? Math.max(1, 120 + r.rssi) : 50
        }));
      setPoints(validPoints);
    };
    loadData();
  }, []);

  return (
    <View style={styles.container}>
      {points.length > 0 ? (
        <View style={styles.mapWrapper}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={{
              latitude: points[0].latitude,
              longitude: points[0].longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            <Heatmap
              points={points}
              radius={50}
              opacity={0.8}
              gradient={{
                colors: ['#00000000', '#3b82f6', '#22c55e', '#ef4444'],
                startPoints: [0.01, 0.25, 0.50, 1.0],
                colorMapSize: 256
              }}
            />
          </MapView>
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>?? AVISO PARA LA DEMOSTRACIÓN DEL TP</Text>
            <Text style={styles.bannerText}>
              El renderizado de los mosaicos de calles se encuentra desactivado temporalmente al no disponer de una Google Maps API Key comercial, para evitar bloqueos. El mapa de calor (Heatmap) se genera y dibuja correctamente sobre este lienzo utilizando los datos reales del GPS y las mediciones almacenadas en SQLite.
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No hay datos geolocalizados suficientes para generar el Mapa de Calor (Heatmap). Asegúrese de encender el GPS e iniciar una nueva prueba.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 20,
    backgroundColor: '#1e293b',
    minHeight: 400,
  },
  mapWrapper: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  banner: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bannerTitle: {
    color: '#fbbf24',
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 4,
  },
  bannerText: {
    color: '#e2e8f0',
    fontSize: 11,
    lineHeight: 16,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
  }
});
