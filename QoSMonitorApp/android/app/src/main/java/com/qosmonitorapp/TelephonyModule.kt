package com.qosmonitorapp

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.CellInfo
import android.telephony.CellInfoCdma
import android.telephony.CellInfoGsm
import android.telephony.CellInfoLte
import android.telephony.CellInfoWcdma
import android.telephony.CellInfoNr
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class TelephonyModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "TelephonyModule"
    }

    @ReactMethod
    fun getCellularInfo(promise: Promise) {
        try {
            val context = reactApplicationContext
            val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager

            val map = Arguments.createMap()
            map.putString("operatorName", telephonyManager.networkOperatorName)

            // Get Network Type (2G, 3G, 4G, 5G)
            val networkTypeStr = getNetworkTypeString(telephonyManager)
            map.putString("networkType", networkTypeStr)

            // Get RSSI and Cell Tech (Requires Location Permission)
            var rssi = 0
            var cellType = "UNKNOWN"
            
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                
                try {
                    val cellInfoList = telephonyManager.allCellInfo
                    if (cellInfoList != null) {
                        for (info in cellInfoList) {
                            if (info.isRegistered) {
                                when (info) {
                                    is CellInfoLte -> {
                                        rssi = info.cellSignalStrength.dbm
                                        cellType = "LTE"
                                    }
                                    is CellInfoGsm -> {
                                        rssi = info.cellSignalStrength.dbm
                                        cellType = "GSM"
                                    }
                                    is CellInfoWcdma -> {
                                        rssi = info.cellSignalStrength.dbm
                                        cellType = "WCDMA"
                                    }
                                    is CellInfoCdma -> {
                                        rssi = info.cellSignalStrength.dbm
                                        cellType = "CDMA"
                                    }
                                }
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                                    if (info is CellInfoNr) {
                                        rssi = info.cellSignalStrength.dbm
                                        cellType = "5G_NR"
                                    }
                                }
                                break // We just need the primary registered cell
                            }
                        }
                    }
                } catch (e: SecurityException) {
                    // Handled gracefully, will just return default values
                }
            }
            
            map.putInt("rssi", rssi)
            map.putString("cellTech", cellType)
            
            promise.resolve(map)

        } catch (e: Exception) {
            promise.reject("TELEPHONY_ERROR", e.message)
        }
    }

    private fun getNetworkTypeString(telephonyManager: TelephonyManager): String {
        val context = reactApplicationContext
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            return "PERMISSION_DENIED"
        }

        return try {
            val networkType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                telephonyManager.dataNetworkType
            } else {
                telephonyManager.networkType
            }
            
            when (networkType) {
                1, 2, 4, 7, 11, 16 -> "2G" // GPRS, EDGE, CDMA, 1xRTT, IDEN, GSM
                3, 5, 6, 8, 9, 10, 12, 14, 15, 17 -> "3G" // UMTS, EVDO_0, EVDO_A, HSDPA, HSUPA, HSPA, EVDO_B, EHRPD, HSPAP, TD_SCDMA
                13, 18 -> "4G" // LTE, IWLAN
                20 -> "5G" // NR
                else -> "UNKNOWN"
            }
        } catch (e: SecurityException) {
            "PERMISSION_DENIED"
        }
    }
}
