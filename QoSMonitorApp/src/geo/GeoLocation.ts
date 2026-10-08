import Geolocation, { GeoCoordinates } from 'react-native-geolocation-service';
import { PermissionsAndroid, Platform } from 'react-native';

export class GeoService {
  static async getCurrentPosition(): Promise<GeoCoordinates | null> {
    if (Platform.OS === 'android') {
      const hasPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      if (!hasPermission) {
        console.warn("Location permission not granted");
        return null;
      }
    }

    return new Promise((resolve) => {
      Geolocation.getCurrentPosition(
        (position) => {
          resolve(position.coords);
        },
        (error) => {
          console.error("Geo error:", error.code, error.message);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    });
  }
}
