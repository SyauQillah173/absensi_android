package com.qomaruddin.absensi_skripsi

import android.app.KeyguardManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.hardware.fingerprint.FingerprintManager
import android.os.Build
import android.provider.Settings
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterFragmentActivity() {
    private val channelName = "absensi_android/payment_security"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        ThesisRoomBridge(this, flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName).setMethodCallHandler { call, result ->
            when (call.method) {
                "openBiometricEnrollment" -> {
                    val type = call.argument<String>("type") ?: "face"
                    result.success(openBiometricEnrollment(type))
                }
                "getBiometricStatus" -> {
                    result.success(getBiometricStatus())
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun getBiometricStatus(): Map<String, Any> {
        val biometricManager = BiometricManager.from(this)
        val weakStatus = biometricManager.canAuthenticate(BIOMETRIC_WEAK)
        val strongStatus = biometricManager.canAuthenticate(BIOMETRIC_STRONG)

        val fingerprintManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            getSystemService(FingerprintManager::class.java)
        } else {
            null
        }
        val fingerprintSupported = fingerprintManager?.isHardwareDetected == true
        val fingerprintEnrolled = fingerprintManager?.hasEnrolledFingerprints() == true

        val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager

        return mapOf(
            "platform" to "android",
            "biometric_weak_status" to weakStatus,
            "biometric_strong_status" to strongStatus,
            "biometric_weak_available" to (weakStatus == BiometricManager.BIOMETRIC_SUCCESS),
            "biometric_strong_available" to (strongStatus == BiometricManager.BIOMETRIC_SUCCESS),
            "any_biometric_enrolled" to (weakStatus == BiometricManager.BIOMETRIC_SUCCESS),
            "fingerprint_supported" to fingerprintSupported,
            "fingerprint_enrolled" to fingerprintEnrolled,
            "device_secure" to keyguardManager.isDeviceSecure,
            "status_hint" to biometricStatusHint(weakStatus)
        )
    }

    private fun biometricStatusHint(status: Int): String {
        return when (status) {
            BiometricManager.BIOMETRIC_SUCCESS -> "Biometrik perangkat siap dipakai."
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> "Perangkat tidak memiliki hardware biometrik yang didukung."
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> "Hardware biometrik sedang tidak tersedia."
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> "Belum ada biometrik yang terdaftar di pengaturan perangkat."
            BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> "Biometrik butuh update keamanan perangkat."
            BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED -> "Kombinasi authenticator tidak didukung perangkat."
            BiometricManager.BIOMETRIC_STATUS_UNKNOWN -> "Status biometrik perangkat belum bisa dipastikan."
            else -> "Status biometrik perangkat: $status"
        }
    }

    private fun openBiometricEnrollment(type: String): Boolean {
        val intent = when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.R -> {
                Intent(Settings.ACTION_BIOMETRIC_ENROLL).apply {
                    val authenticators = if (type == "fingerprint") {
                        BIOMETRIC_STRONG
                    } else {
                        BIOMETRIC_WEAK
                    }
                    putExtra(Settings.EXTRA_BIOMETRIC_AUTHENTICATORS_ALLOWED, authenticators)
                }
            }
            type == "fingerprint" && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P -> {
                Intent(Settings.ACTION_FINGERPRINT_ENROLL)
            }
            else -> Intent(Settings.ACTION_SECURITY_SETTINGS)
        }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

        return try {
            startActivity(intent)
            true
        } catch (_: ActivityNotFoundException) {
            try {
                startActivity(Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                true
            } catch (_: ActivityNotFoundException) {
                false
            }
        }
    }
}
