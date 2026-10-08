import { NativeModules, Platform } from 'react-native';

const { TelephonyModule } = NativeModules;

export interface CellularInfo {
  operatorName: string;
  networkType: string;
  rssi: number;
  cellTech: string;
}

export const getCellularInfo = async (): Promise<CellularInfo | null> => {
  if (Platform.OS !== 'android') {
    return null; // Not implemented for iOS yet
  }
  
  try {
    const info = await TelephonyModule.getCellularInfo();
    return info;
  } catch (error) {
    console.error("Error getting cellular info from Native Module", error);
    return null;
  }
};
