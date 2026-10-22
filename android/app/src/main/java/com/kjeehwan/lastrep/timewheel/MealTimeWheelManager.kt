package com.kjeehwan.lastrep.timewheel

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

@ReactModule(name = MealTimeWheelManager.REACT_CLASS)
class MealTimeWheelManager : SimpleViewManager<MealTimeWheelView>() {
  companion object { const val REACT_CLASS = "MealTimeWheel" }
  override fun getName(): String = REACT_CLASS
  override fun createViewInstance(context: ThemedReactContext) = MealTimeWheelView(context)

  @ReactProp(name = "count", defaultInt = 24)
  fun setCount(view: MealTimeWheelView, count: Int) { view.setCount(count) }

  @ReactProp(name = "initialValue", defaultInt = 0)
  fun setInitialValue(view: MealTimeWheelView, selected: Int) { view.setInitialSelection(selected) }

  override fun onAfterUpdateTransaction(view: MealTimeWheelView) {
    super.onAfterUpdateTransaction(view)
    view.applyInitialSelection()
  }

  @ReactProp(name = "inkColor")
  fun setInk(view: MealTimeWheelView, color: String?) { view.setInk(color) }

  @ReactProp(name = "numberSize", defaultFloat = 18f)
  fun setNumberSize(view: MealTimeWheelView, size: Float) { view.setNumberSize(size) }

  @ReactProp(name = "enabled", defaultBoolean = true)
  fun setEnabled(view: MealTimeWheelView, enabled: Boolean) { view.isEnabled = enabled }

  @ReactProp(name = "partLabel")
  fun setPartLabel(view: MealTimeWheelView, label: String?) { view.setPartLabel(label) }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
    mutableMapOf("topWheelChange" to mapOf("registrationName" to "onWheelChange"))
}
