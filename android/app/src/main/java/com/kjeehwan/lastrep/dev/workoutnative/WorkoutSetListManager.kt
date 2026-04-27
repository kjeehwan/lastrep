package com.kjeehwan.lastrep.dev.workoutnative

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

@ReactModule(name = WorkoutSetListManager.REACT_CLASS)
class WorkoutSetListManager : SimpleViewManager<WorkoutSetListView>() {
  companion object {
    const val REACT_CLASS = "WorkoutSetList"
  }

  override fun getName(): String = REACT_CLASS

  override fun createViewInstance(reactContext: ThemedReactContext): WorkoutSetListView =
    WorkoutSetListView(reactContext)

  override fun onAfterUpdateTransaction(view: WorkoutSetListView) {
    super.onAfterUpdateTransaction(view)
    view.reactTagForEvents = view.id
  }

  @ReactProp(name = "sets")
  fun setSets(view: WorkoutSetListView, sets: ReadableArray?) {
    val items = mutableListOf<WorkoutSetItem>()
    if (sets != null) {
      for (i in 0 until sets.size()) {
        val set = sets.getMap(i) ?: continue
        items.add(
          WorkoutSetItem(
            weight = set.getStringOrEmpty("weight"),
            reps = set.getStringOrEmpty("reps"),
            rpe = set.getStringOrEmpty("rpe"),
            done = if (set.hasKey("done") && !set.isNull("done")) set.getBoolean("done") else false
          )
        )
      }
    }
    view.setItems(items)
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
    mutableMapOf(
      "topSetChange" to mapOf("registrationName" to "onSetChange"),
      "topToggleDone" to mapOf("registrationName" to "onToggleDone"),
      "topDeleteSet" to mapOf("registrationName" to "onDeleteSet"),
      "topSetLabelPress" to mapOf("registrationName" to "onSetLabelPress")
    )

  private fun ReadableMap.getStringOrEmpty(key: String): String {
    return if (hasKey(key) && !isNull(key)) getString(key) ?: "" else ""
  }
}

