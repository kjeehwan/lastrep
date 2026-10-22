package com.kjeehwan.lastrep.systembars

import android.os.Build
import android.view.View
import android.view.WindowInsetsController
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.uimanager.annotations.ReactProp

/** A Modal owns a separate window; Activity StatusBar updates do not style it. */
class NotebookSystemBarsView(context: ThemedReactContext) : View(context) {
  var darkIcons: Boolean = false
    set(value) {
      field = value
      if (isAttachedToWindow) post { applyAppearance() }
    }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    // Run after Dialog.show() copies the Activity's initial system appearance.
    post { applyAppearance() }
  }

  override fun onWindowFocusChanged(hasWindowFocus: Boolean) {
    super.onWindowFocusChanged(hasWindowFocus)
    if (hasWindowFocus) applyAppearance()
  }

  @Suppress("DEPRECATION")
  private fun applyAppearance() {
    if (!isAttachedToWindow) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      // This view's controller belongs to the Dialog, not the underlying Activity.
      windowInsetsController?.setSystemBarsAppearance(
        if (darkIcons) WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS else 0,
        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS,
      )
    } else {
      val decor = rootView
      decor.systemUiVisibility = if (darkIcons) {
        decor.systemUiVisibility or SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
      } else {
        decor.systemUiVisibility and SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
      }
    }
  }
}

class NotebookSystemBarsManager : SimpleViewManager<NotebookSystemBarsView>() {
  override fun getName() = "NotebookSystemBars"
  override fun createViewInstance(context: ThemedReactContext) = NotebookSystemBarsView(context)

  @ReactProp(name = "darkIcons", defaultBoolean = false)
  fun setDarkIcons(view: NotebookSystemBarsView, darkIcons: Boolean) { view.darkIcons = darkIcons }
}

class NotebookSystemBarsPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = emptyList()
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = listOf(NotebookSystemBarsManager())
}
