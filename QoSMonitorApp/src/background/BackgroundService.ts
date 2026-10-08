import BackgroundFetch from 'react-native-background-fetch';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { PingEngine } from '../engine/PingEngine';
import { DBService } from '../db/Database';
import { GeoService } from '../geo/GeoLocation';
import { getCellularInfo } from '../native/TelephonyModule';

export const configureBackgroundFetch = () => {
  BackgroundFetch.configure({
    minimumFetchInterval: 15, // minutos
    stopOnTerminate: false,
    enableHeadless: true,
    startOnBoot: true,
    requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
  }, async (taskId) => {
    console.log('[BackgroundFetch] Task executed: ', taskId);
    await executeBackgroundMeasurement();
    BackgroundFetch.finish(taskId);
  }, (error) => {
    console.error('[BackgroundFetch] Failed to configure: ', error);
  });
};

export const executeBackgroundMeasurement = async () => {
  try {
    const coords = await GeoService.getCurrentPosition();
    const cellInfo = await getCellularInfo();
    // Test rápido para no consumir mucha batería ni datos
    const pings = await PingEngine.runPingSuite(['8.8.8.8'], 3); 
    const ping = pings['8.8.8.8'];

    // Lógica de alerta: si la latencia es horrible o hay pérdida, notificamos al usuario.
    if (ping && (ping.packetLoss > 50 || ping.avg > 300)) {
      await sendDegradedNotification(ping.avg, ping.packetLoss);
    }

    await DBService.insertMeasurement({
      timestamp: Date.now(),
      latitude: coords?.latitude || null,
      longitude: coords?.longitude || null,
      networkType: 'background_auto',
      operator: cellInfo?.operatorName || null,
      rssi: cellInfo?.rssi || null,
      avgPing: ping ? ping.avg : null,
      jitter: ping ? ping.jitter : null,
      downloadMbps: null, // Evitamos gastar el plan de datos del usuario
      uploadMbps: null,
    });
  } catch (e) {
    console.error("Background task error", e);
  }
};

const sendDegradedNotification = async (ping: number, loss: number) => {
  await notifee.requestPermission();
  
  const channelId = await notifee.createChannel({
    id: 'qos_degraded',
    name: 'Alertas de Calidad de Red',
    importance: AndroidImportance.HIGH,
  });

  await notifee.displayNotification({
    title: '⚠️ Calidad de Red Degradada',
    body: `Tu conexión está inestable. Latencia: ${ping.toFixed(0)}ms, Pérdida: ${loss}%`,
    android: {
      channelId,
      pressAction: {
        id: 'default',
      },
    },
  });
};
