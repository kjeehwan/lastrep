package com.kjeehwan.lastrep.workoutnative

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
            marker = set.getStringOrEmpty("marker"),
            last = set.getStringOrEmpty("last"),
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

  @ReactProp(name = "weightLabel")
  fun setWeightLabel(view: WorkoutSetListView, value: String?) {
    view.setColumnLabels(
      weight = value ?: "Weight",
      reps = view.repsLabel,
      rpe = view.rpeLabel
    )
  }

  @ReactProp(name = "repsLabel")
  fun setRepsLabel(view: WorkoutSetListView, value: String?) {
    view.setColumnLabels(
      weight = view.weightLabel,
      reps = value ?: "Reps",
      rpe = view.rpeLabel
    )
  }

  @ReactProp(name = "rpeLabel")
  fun setRpeLabel(view: WorkoutSetListView, value: String?) {
    view.setColumnLabels(
      weight = view.weightLabel,
      reps = view.repsLabel,
      rpe = value ?: "RPE"
    )
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
    mutableMapOf(
      "topSetChange" to mapOf("registrationName" to "onSetChange"),
      "topToggleDone" to mapOf("registrationName" to "onToggleDone"),
      "topDeleteSet" to mapOf("registrationName" to "onDeleteSet"),
      "topSetLabelPress" to mapOf("registrationName" to "onSetLabelPress"),
      "topLastPress" to mapOf("registrationName" to "onLastPress")
    )

  private fun ReadableMap.getStringOrEmpty(key: String): String {
    return if (hasKey(key) && !isNull(key)) getString(key) ?: "" else ""
  }
}
