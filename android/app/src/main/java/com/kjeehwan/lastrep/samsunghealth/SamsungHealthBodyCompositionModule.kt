package com.kjeehwan.lastrep.samsunghealth

import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.samsung.android.sdk.health.data.HealthDataService
import com.samsung.android.sdk.health.data.data.HealthDataPoint
import com.samsung.android.sdk.health.data.error.ResolvablePlatformException
import com.samsung.android.sdk.health.data.permission.AccessType
import com.samsung.android.sdk.health.data.permission.Permission
import com.samsung.android.sdk.health.data.request.DataType
import com.samsung.android.sdk.health.data.request.DataTypes
import com.samsung.android.sdk.health.data.request.InstantTimeFilter
import com.samsung.android.sdk.health.data.request.Ordering
import com.samsung.android.sdk.health.data.response.DataResponse
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.function.Consumer

class SamsungHealthBodyCompositionModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  private fun createBodyCompositionPermission(): Set<Permission> =
    setOf(Permission.of(DataTypes.BODY_COMPOSITION, AccessType.READ))

  private fun getStore() = HealthDataService.getStore(reactApplicationContext)

  private fun rejectWithResolutionIfNeeded(error: Throwable, promise: Promise) {
    if (error is ResolvablePlatformException) {
      val activity = getCurrentActivity()
      if (error.hasResolution && activity != null) {
        try {
          error.resolve(activity)
        } catch (resolutionError: Throwable) {
          promise.reject("SAMSUNG_HEALTH_RESOLUTION_FAILED", resolutionError.message, resolutionError)
          return
        }
        promise.reject("SAMSUNG_HEALTH_RESOLUTION_REQUIRED", error.message, error)
        return
      }
    }
    promise.reject("SAMSUNG_HEALTH_ERROR", error.message, error)
  }

  private fun getPreferredMuscleMassKg(point: HealthDataPoint): Pair<Float?, String?> {
    val skeletalMuscleMass = point.getValue(DataType.BodyCompositionType.SKELETAL_MUSCLE_MASS)
    if (skeletalMuscleMass != null) {
      return skeletalMuscleMass to "skeletal_muscle_mass"
    }
    val skeletalMuscle = point.getValue(DataType.BodyCompositionType.SKELETAL_MUSCLE)
    if (skeletalMuscle != null) {
      return skeletalMuscle to "skeletal_muscle"
    }
    val muscleMass = point.getValue(DataType.BodyCompositionType.MUSCLE_MASS)
    if (muscleMass != null) {
      return muscleMass to "muscle_mass"
    }
    return null to null
  }

  @ReactMethod
  fun isAvailable(promise: Promise) {
    try {
      getStore()
      promise.resolve(true)
    } catch (_: Throwable) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun hasBodyCompositionPermission(promise: Promise) {
    try {
      getStore()
        .getGrantedPermissionsAsync(createBodyCompositionPermission())
        .setCallback(
          Looper.getMainLooper(),
          Consumer { granted ->
            promise.resolve(granted.containsAll(createBodyCompositionPermission()))
          },
          Consumer { error -> rejectWithResolutionIfNeeded(error, promise) }
        )
    } catch (error: Throwable) {
      rejectWithResolutionIfNeeded(error, promise)
    }
  }

  @ReactMethod
  fun requestBodyCompositionPermission(promise: Promise) {
    val activity = getCurrentActivity()
    if (activity == null) {
      promise.reject("SAMSUNG_HEALTH_ACTIVITY_REQUIRED", "Current activity is unavailable.")
      return
    }
    try {
      getStore()
        .requestPermissionsAsync(createBodyCompositionPermission(), activity)
        .setCallback(
          Looper.getMainLooper(),
          Consumer<Set<Permission>> { granted ->
            promise.resolve(granted.containsAll(createBodyCompositionPermission()))
          },
          Consumer<Throwable> { error -> rejectWithResolutionIfNeeded(error, promise) }
        )
    } catch (error: Throwable) {
      rejectWithResolutionIfNeeded(error, promise)
    }
  }

  @ReactMethod
  fun readLatestBodyComposition(promise: Promise) {
    try {
      val request = DataTypes.BODY_COMPOSITION
        .readDataRequestBuilder
        .setOrdering(Ordering.DESC)
        .setLimit(1)
        .setPageSize(1)
        .setInstantTimeFilter(
          InstantTimeFilter.since(Instant.now().minus(3650, ChronoUnit.DAYS))
        )
        .build()

      getStore()
        .readDataAsync(request)
        .setCallback(
          Looper.getMainLooper(),
          Consumer<DataResponse<HealthDataPoint>> { response ->
            val point = response.dataList.firstOrNull()
            if (point == null) {
              promise.resolve(null)
              return@Consumer
            }

            val (muscleMassKg, muscleFieldUsed) = getPreferredMuscleMassKg(point)
            val recordedAt =
              point.endTime ?: point.startTime ?: point.updateTime ?: Instant.now()
            val source = point.dataSource
            val payload = Arguments.createMap().apply {
              point.getValue(DataType.BodyCompositionType.WEIGHT)?.let { putDouble("weightKg", it.toDouble()) }
              point.getValue(DataType.BodyCompositionType.BODY_FAT)?.let { putDouble("bodyFatPercent", it.toDouble()) }
              muscleMassKg?.let { putDouble("muscleMassKg", it.toDouble()) }
              point.getValue(DataType.BodyCompositionType.SKELETAL_MUSCLE)?.let {
                putDouble("skeletalMuscleKg", it.toDouble())
              }
              point.getValue(DataType.BodyCompositionType.SKELETAL_MUSCLE_MASS)?.let {
                putDouble("skeletalMuscleMassKg", it.toDouble())
              }
              point.getValue(DataType.BodyCompositionType.MUSCLE_MASS)?.let {
                putDouble("muscleMassFieldKg", it.toDouble())
              }
              point.getValue(DataType.BodyCompositionType.FAT_FREE_MASS)?.let {
                putDouble("fatFreeMassKg", it.toDouble())
              }
              putDouble("recordedAtMs", recordedAt.toEpochMilli().toDouble())
              putString("sourceAppId", source?.appId)
              putString("sourceDeviceId", source?.deviceId)
              putString("muscleFieldUsed", muscleFieldUsed)
            }
            promise.resolve(payload)
          },
          Consumer<Throwable> { error -> rejectWithResolutionIfNeeded(error, promise) }
        )
    } catch (error: Throwable) {
      rejectWithResolutionIfNeeded(error, promise)
    }
  }

  companion object {
    const val NAME = "SamsungHealthBodyComposition"
  }
}
