import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Map, Camera, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { DBService, MeasurementRecord } from '../db/Database';

export default function HistoryMap() {
  const [points, setPoints] = useState<any[]>([]);
  const mapRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  const handleZoomIn = async () => {
    try {
      if (mapRef.current && cameraRef.current) {
        const currentZoom = await mapRef.current.getZoom();
        cameraRef.current.zoomTo(currentZoom + 1, { duration: 300 });
      }
    } catch (e) {
      console.log('Zoom in error', e);
    }
  };

  const handleZoomOut = async () => {
    try {
      if (mapRef.current && cameraRef.current) {
        const currentZoom = await mapRef.current.getZoom();
        cameraRef.current.zoomTo(currentZoom - 1, { duration: 300 });
      }
    } catch (e) {
      console.log('Zoom out error', e);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      const records = await DBService.getHistory();
      const validPoints = records
        .filter(r => r.latitude && r.longitude)
        .map(r => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [r.longitude, r.latitude]
          },
          properties: {
            weight: r.rssi ? Math.max(1, 120 + r.rssi) : 50
          }
        }));
      setPoints(validPoints);
    };
    loadData();
  }, []);

  const geoJSONSource = {
    type: 'FeatureCollection',
    features: points
  };

  const centerCoords = points.length > 0 
    ? [points[0].geometry.coordinates[0], points[0].geometry.coordinates[1]] 
    : [-58.2333, -32.4833]; // Concepción del Uruguay, Entre Ríos fallback

  return (
    <View style={styles.container}>
      <View style={styles.mapWrapper}>
        <Map
          ref={mapRef}
          style={styles.map}
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
          logo={false}
          compass={true}
        >
          <Camera
            ref={cameraRef}
            zoom={points.length > 0 ? 12 : 5}
            center={centerCoords as [number, number]}
          />
          {points.length > 0 && (
            <GeoJSONSource id="heatmapSource" data={geoJSONSource as any}>
              <Layer
                id="heatmapLayer"
                type="heatmap"
                paint={{
                  'heatmap-weight': ['get', 'weight'],
                  'heatmap-intensity': 1,
                  'heatmap-color': [
                    'interpolate',
                    ['linear'],
                    ['heatmap-density'],
                    0, 'rgba(0, 0, 0, 0)',
                    0.25, '#3b82f6',
                    0.5, '#22c55e',
                    1, '#ef4444'
                  ],
                  'heatmap-radius': 20, // <-- Radio reducido para manchas más precisas
                  'heatmap-opacity': 0.8,
                }}
              />
            </GeoJSONSource>
          )}
        </Map>

        {/* Controles de Zoom */}
        <View style={styles.zoomControls}>
          <TouchableOpacity style={styles.zoomButton} onPress={handleZoomIn}>
            <Text style={styles.zoomText}>+</Text>
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity style={styles.zoomButton} onPress={handleZoomOut}>
            <Text style={styles.zoomText}>-</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>⚠️ AVISO PARA LA DEMOSTRACIÓN DEL TP</Text>
          <Text style={styles.bannerText}>
            Se ha integrado MapLibre para el renderizado del mapa. 
            {points.length === 0 ? " Aún no hay datos geolocalizados. Ejecute un Test con GPS para ver el Heatmap." : " El mapa de calor (Heatmap) refleja los datos del GPS y métricas almacenadas."}
          </Text>
        </View>
      </View>
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
    ...StyleSheet.absoluteFill,
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
  },
  zoomControls: {
    position: 'absolute',
    right: 16,
    bottom: 32,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  zoomButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: '#334155',
    width: '100%',
  },
  zoomText: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '300',
  }
});