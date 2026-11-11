package com.kjeehwan.lastrep.restalerts

import android.Manifest
import android.app.*
import android.content.*
import android.content.pm.PackageManager
import android.media.MediaPlayer
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import org.json.JSONArray
import org.json.JSONObject

/** PendingIntent alarms survive JS suspension. A persisted deadline is consumed once. */
object RestAlerts {
  const val CHANNEL = "workout-rest-media-v3"
  fun alertsEnabled(c: Context) = prefs(c).getBoolean("alertsEnabled", true)
  fun soundEnabled(c: Context) = prefs(c).getBoolean("gongEnabled", true)
  @Synchronized fun setSoundEnabled(c: Context, owner: String, enabled: Boolean) {
    if (owner.isEmpty() || prefs(c).getString("owner", "") != owner) throw IllegalStateException("Your account changed. Reopen Settings.")
    if (!prefs(c).edit().putBoolean("gongEnabled", enabled).commit()) throw IllegalStateException("Could not save rest sound setting")
    if (!enabled) RestGong.stop()
  }
  @Synchronized fun setAlertsEnabled(c: Context, owner: String, enabled: Boolean) {
    if (owner.isEmpty() || prefs(c).getString("owner", "") != owner) throw IllegalStateException("Your account changed. Reopen Settings.")
    if (!prefs(c).edit().putBoolean("alertsEnabled", enabled).commit()) throw IllegalStateException("Could not save rest alerts setting")
    val all = records(c)
    if (!enabled) {
      RestGong.stop()
      all.keys().forEach { cancel(c, owner, it) }
      return
    }
    val incoming = JSONArray()
    val now = System.currentTimeMillis()
    all.keys().forEach { id ->
      val record = all.getJSONObject(id)
      if (!record.optBoolean("fired")) {
        if (record.getLong("deadline") <= now) record.put("fired", true)
        else incoming.put(JSONObject().put("id", id).put("name", record.optString("name")).put("deadline", record.getLong("deadline")))
      }
    }
    // Expired muted timers are consumed, never replayed when alerts turn on.
    save(c, all)
    sync(c, owner, incoming)
  }
  private fun prefs(c: Context) = c.getSharedPreferences("workout-rest-alerts", Context.MODE_PRIVATE)
  private fun manager(c: Context) = c.getSystemService(NotificationManager::class.java)
  private fun alarms(c: Context) = c.getSystemService(AlarmManager::class.java)
  private fun records(c: Context) = JSONObject(prefs(c).getString("records", "{}") ?: "{}")
  private fun save(c: Context, data: JSONObject) { prefs(c).edit().putString("records", data.toString()).commit() }
  private fun notificationId(id: String) = "rest:$id"
  private fun pending(c: Context, owner: String, id: String): PendingIntent {
    val intent = Intent(c, RestAlertReceiver::class.java).setData(Uri.Builder().scheme("lastrep-rest").authority(c.packageName).appendPath(owner).appendPath(id).build())
      .putExtra("owner", owner).putExtra("id", id)
    return PendingIntent.getBroadcast(c, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
  private fun openApp(c: Context): PendingIntent {
    val scheme = if (c.packageName.endsWith(".dev")) "lastrep-dev" else "lastrep"
    val intent = c.packageManager.getLaunchIntentForPackage(c.packageName)!!.setAction(Intent.ACTION_VIEW)
      .setData(Uri.parse("$scheme://workout/log")).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(c, 6201, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
  fun channel(c: Context) {
    val notifications = manager(c)
    if (notifications.getNotificationChannel(CHANNEL) != null) return
    // Sound is played once as media, not by Android's alarm/notification route.
    // Migrate the active legacy channel's disabled/vibration choices rather than
    // silently re-enabling alerts when moving to a channel without a sound.
    val legacyId = if (prefs(c).getBoolean("alarmSound", false)) "workout-rest-alarm-v2" else "workout-rest-v1"
    val legacy = notifications.getNotificationChannel(legacyId)
    val channel = NotificationChannel(CHANNEL, "Workout rest timers", legacy?.importance ?: NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Rest timer notifications and vibration; gong uses media volume"
      setSound(null, null)
      enableVibration(legacy?.shouldVibrate() ?: true)
      legacy?.vibrationPattern?.let { vibrationPattern = it }
      lockscreenVisibility = legacy?.lockscreenVisibility ?: Notification.VISIBILITY_PRIVATE
      setShowBadge(legacy?.canShowBadge() ?: true)
    }
    notifications.createNotificationChannel(channel)
  }

  fun notificationsAllowed(c: Context): Boolean {
    channel(c)
    return manager(c).areNotificationsEnabled() && manager(c).getNotificationChannel(CHANNEL)?.importance != NotificationManager.IMPORTANCE_NONE &&
      (Build.VERSION.SDK_INT < 33 || c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
  }
  fun exactAllowed(c: Context) = Build.VERSION.SDK_INT < 31 || alarms(c).canScheduleExactAlarms()
  private fun cancel(c: Context, owner: String, id: String) {
    alarms(c).cancel(pending(c, owner, id))
    manager(c).cancel(notificationId(id), 6201)
  }
  @Synchronized fun setOwner(c: Context, owner: String) {
    val old = prefs(c).getString("owner", "") ?: ""
    channel(c)
    if (old == owner) return
    RestGong.stop()
    val all = records(c)
    all.keys().forEach { cancel(c, old, it) }
    prefs(c).edit().putString("owner", owner).putString("records", "{}").remove("alarmSound").remove("gongEnabled").remove("alertsEnabled").commit()
  }
  /** Receiver and foreground completion race through this same lock. */
  @Synchronized fun finish(c: Context, owner: String, id: String, deadline: Long, fromAlarm: Boolean, finished: () -> Unit = {}): Boolean {
    var playing = false
    try {
    if (prefs(c).getString("owner", "") != owner) return false
    val all = records(c)
    val record = all.optJSONObject(id) ?: return false
    if (record.optLong("deadline") != deadline) return false
    if (record.optBoolean("fired")) return true
    if (System.currentTimeMillis() < deadline) return false
    record.put("fired", true)
    save(c, all)
    // Never replay a missed timer when reopening a force-stopped app.
    if (!fromAlarm && System.currentTimeMillis() - deadline > 2000) return true
    if (!alertsEnabled(c) || !notificationsAllowed(c)) return true
    val public = Notification.Builder(c, CHANNEL).setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle("Rest finished").setContentText("Your next set is ready.").build()
    val notification = Notification.Builder(c, CHANNEL).setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle("Rest finished").setContentText(record.optString("name", "Your next set is ready."))
      .setCategory(Notification.CATEGORY_ALARM).setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(public)
      .setContentIntent(openApp(c)).setAutoCancel(true).setOnlyAlertOnce(true).setTimeoutAfter(120000).build()
    manager(c).notify(notificationId(id), 6201, notification)
    if (soundEnabled(c)) {
      playing = true
      RestGong.play(c.applicationContext, finished)
    }
    return true
    } finally { if (!playing) finished() }
  }
  @Synchronized fun sync(c: Context, owner: String, incoming: JSONArray) {
    if (prefs(c).getString("owner", "") != owner || owner.isEmpty()) return
    val all = records(c)
    val active = mutableSetOf<String>()
    for (i in 0 until incoming.length()) active.add(incoming.getJSONObject(i).getString("id"))
    val oldIds = all.keys().asSequence().toList()
    for (id in oldIds) {
      val record = all.getJSONObject(id)
      if (id !in active && !record.optBoolean("fired")) {
        val deadline = record.getLong("deadline")
        if (deadline <= System.currentTimeMillis()) {
          finish(c, owner, id, deadline, false)
          all.put(id, record.put("fired", true))
        } else { cancel(c, owner, id); all.remove(id) }
      }
    }
    val enabled = alertsEnabled(c)
    val ready = enabled && notificationsAllowed(c) && exactAllowed(c)
    for (i in 0 until incoming.length()) {
      val entry = incoming.getJSONObject(i)
      val id = entry.getString("id")
      val deadline = entry.getLong("deadline")
      val old = all.optJSONObject(id)
      if (old?.optLong("deadline") == deadline && old.optBoolean("fired")) continue
      if (!ready && enabled) { if (old != null) cancel(c, owner, id); all.remove(id); continue }
      if (deadline <= System.currentTimeMillis()) continue
      cancel(c, owner, id)
      val record = JSONObject().put("deadline", deadline).put("name", entry.optString("name", "Your next set is ready.")).put("fired", false)
      all.put(id, record)
      // Persist before registering so a very short alarm cannot beat its record.
      save(c, all)
      if (ready) try {
        alarms(c).setAlarmClock(AlarmManager.AlarmClockInfo(deadline, openApp(c)), pending(c, owner, id))
      } catch (denied: SecurityException) { all.remove(id) }
    }
    // Keep only active or recently fired generations to bound local storage.
    all.keys().asSequence().toList().filter { it !in active && all.getJSONObject(it).optLong("deadline") < System.currentTimeMillis() - 120000 }.forEach { all.remove(it) }
    save(c, all)
  }
  @Synchronized fun receive(c: Context, intent: Intent, finished: () -> Unit) {
    val owner = intent.getStringExtra("owner")
    val id = intent.getStringExtra("id")
    val record = if (id != null) records(c).optJSONObject(id) else null
    if (owner == null || id == null || record == null) { finished(); return }
    finish(c, owner, id, record.optLong("deadline"), true, finished)
  }
  @Synchronized fun start(c: Context, owner: String, id: String, deadline: Long, name: String) {
    if (prefs(c).getString("owner", "") != owner) return
    val all = records(c)
    if (all.optJSONObject(id)?.optBoolean("cancelled") == true) { all.remove(id); save(c, all) }
    val incoming = JSONArray()
    all.keys().forEach { key ->
      val record = all.getJSONObject(key)
      if (key != id && !record.optBoolean("fired") && record.optLong("deadline") > System.currentTimeMillis()) incoming.put(JSONObject().put("id", key).put("name", record.optString("name")).put("deadline", record.optLong("deadline")))
    }
    incoming.put(JSONObject().put("id", id).put("name", name).put("deadline", deadline))
    sync(c, owner, incoming)
  }
  @Synchronized fun cancelOne(c: Context, owner: String, id: String) {
    if (prefs(c).getString("owner", "") != owner) return
    cancel(c, owner, id)
    val all = records(c)
    all.optJSONObject(id)?.put("fired", true)?.put("cancelled", true)
    save(c, all)
  }
  @Synchronized fun clear(c: Context, owner: String) {
    if (prefs(c).getString("owner", "") != owner) return
    val all = records(c)
    all.keys().forEach { cancel(c, owner, it); all.getJSONObject(it).put("fired", true).put("cancelled", true) }
    save(c, all)
  }
}

/** Use the selected media output (headphones when in use, otherwise speaker).
 * Media volume, mute and Android DND remain under the user's control. */
private object RestGong {
  private val main = Handler(Looper.getMainLooper())
  private var stopActive: (() -> Unit)? = null
  fun stop() { main.post { stopActive?.invoke() } }
  fun play(c: Context, finished: () -> Unit) {
    main.post {
      stopActive?.invoke()
      val player = MediaPlayer()
      var released = false
      lateinit var timeout: Runnable
      val cleanup = {
        if (!released) {
          released = true
          main.removeCallbacks(timeout)
          try { player.release() } catch (_: Exception) { }
          stopActive = null
          finished()
        }
      }
      timeout = Runnable { cleanup() }
      stopActive = cleanup
      main.postDelayed(timeout, 8000)
      try {
        player.setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
        player.setWakeMode(c, PowerManager.PARTIAL_WAKE_LOCK)
        player.setDataSource(c, Uri.parse("android.resource://${c.packageName}/raw/rest_gong"))
        player.setOnPreparedListener { if (!released) { try { it.start() } catch (_: Exception) { cleanup() } } }
        player.setOnCompletionListener { cleanup() }
        player.setOnErrorListener { _, _, _ -> cleanup(); true }
        player.prepareAsync()
      } catch (_: Exception) { cleanup() }
    }
  }
}

class RestAlertReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pending = goAsync()
    RestAlerts.receive(context, intent) { pending.finish() }
  }
}

class RestAlertsModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "WorkoutRestAlerts"
  @ReactMethod fun setOwner(owner: String, promise: Promise) { try { RestAlerts.setOwner(context, owner); promise.resolve(null) } catch (e: Exception) { promise.reject("REST_ALERTS", e) } }
  @ReactMethod fun status(promise: Promise) {
    try { promise.resolve(Arguments.createMap().apply { putBoolean("notifications", RestAlerts.notificationsAllowed(context)); putBoolean("exact", RestAlerts.exactAllowed(context)); putString("soundPolicy", "media"); putBoolean("soundEnabled", RestAlerts.soundEnabled(context)); putBoolean("alertsEnabled", RestAlerts.alertsEnabled(context)) }) }
    catch (e: Exception) { promise.reject("REST_ALERTS", e) }
  }
  @ReactMethod fun setSoundEnabled(owner: String, enabled: Boolean, promise: Promise) { try { RestAlerts.setSoundEnabled(context, owner, enabled); promise.resolve(null) } catch (e: Exception) { promise.reject("REST_ALERTS", e) } }
  @ReactMethod fun setAlertsEnabled(owner: String, enabled: Boolean, promise: Promise) { try { RestAlerts.setAlertsEnabled(context, owner, enabled); promise.resolve(null) } catch (e: Exception) { promise.reject("REST_ALERTS", e) } }
  @ReactMethod fun sync(owner: String, entries: String, promise: Promise) { try { RestAlerts.sync(context, owner, JSONArray(entries)); promise.resolve(null) } catch (e: Exception) { promise.reject("REST_ALERTS", e) } }
  @ReactMethod fun start(owner: String, id: String, deadline: Double, name: String, promise: Promise) { try { RestAlerts.start(context, owner, id, deadline.toLong(), name); promise.resolve(null) } catch (e: Exception) { promise.reject("REST_ALERTS", e) } }
  @ReactMethod fun cancel(owner: String, id: String, promise: Promise) { try { RestAlerts.cancelOne(context, owner, id); promise.resolve(null) } catch (e: Exception) { promise.reject("REST_ALERTS", e) } }
  @ReactMethod fun clear(owner: String, promise: Promise) { try { RestAlerts.clear(context, owner); promise.resolve(null) } catch (e: Exception) { promise.reject("REST_ALERTS", e) } }
  @ReactMethod fun finish(owner: String, id: String, deadline: Double, promise: Promise) { try { promise.resolve(RestAlerts.finish(context, owner, id, deadline.toLong(), false)) } catch (e: Exception) { promise.reject("REST_ALERTS", e) } }
  @ReactMethod fun openExactSettings(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= 31) context.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      promise.resolve(null)
    } catch (e: Exception) { promise.reject("REST_ALERTS", e) }
  }
  @ReactMethod fun openNotificationSettings(promise: Promise) {
    try {
      context.startActivity(Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName).putExtra(Settings.EXTRA_CHANNEL_ID, RestAlerts.CHANNEL).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      promise.resolve(null)
    } catch (e: Exception) { promise.reject("REST_ALERTS", e) }
  }
}

class RestAlertsPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(RestAlertsModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
