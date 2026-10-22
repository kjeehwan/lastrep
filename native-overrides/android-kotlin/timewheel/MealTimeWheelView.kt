package __PACKAGE__.timewheel

import android.graphics.Color
import android.util.TypedValue
import android.view.MotionEvent
import android.view.ViewGroup
import android.widget.NumberPicker
import android.widget.EditText
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import java.util.Locale

/** Android owns the fling, wrap and snap; JS receives only gesture boundaries. */
class MealTimeWheelView(context: ThemedReactContext) : NumberPicker(context) {
  private var scrollState = OnScrollListener.SCROLL_STATE_IDLE
  private var touching = false
  private var updating = false
  private var relayoutPosted = false
  private var initialSelection = 0
  private var initialized = false
  private var partLabel = ""

  init {
    minValue = 0
    maxValue = 23
    wrapSelectorWheel = true
    descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
    setBackgroundColor(Color.TRANSPARENT)
    setFormatter { number -> String.format(Locale.ROOT, "%02d", number) }
    selectionDividerHeight = 0
    setOnValueChangedListener { _, _, _ ->
      updateInputLabel()
      // Tap / accessibility changes can occur without a scroll-state transition.
      if (scrollState == OnScrollListener.SCROLL_STATE_IDLE && !touching) emit(false)
    }
    setOnScrollListener { _, state ->
      scrollState = state
      emit(state != OnScrollListener.SCROLL_STATE_IDLE)
    }
  }

  fun setCount(count: Int) {
    updating = true
    maxValue = (count - 1).coerceAtLeast(1)
    wrapSelectorWheel = true
    updating = false
  }

  fun setInitialSelection(number: Int) { initialSelection = number }

  fun applyInitialSelection() {
    // This wheel owns its live value. JS mirrors it for Save; a delayed render
    // must never send an earlier value back into an ongoing native gesture.
    if (initialized) return
    updating = true
    value = initialSelection.coerceIn(minValue, maxValue)
    updating = false
    initialized = true
    updateInputLabel()
  }

  fun setPartLabel(label: String?) {
    partLabel = label.orEmpty()
    contentDescription = partLabel
    updateInputLabel()
  }

  private fun updateInputLabel() {
    for (index in 0 until childCount) {
      (getChildAt(index) as? EditText)?.apply {
        contentDescription = "$partLabel, ${String.format(Locale.ROOT, "%02d", value)}"
        showSoftInputOnFocus = false
        isCursorVisible = false
      }
    }
  }

  fun setInk(color: String?) {
    textColor = runCatching { Color.parseColor(color) }.getOrDefault(Color.BLACK)
  }

  fun setNumberSize(size: Float) {
    textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, size, resources.displayMetrics)
  }

  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    if (event.actionMasked == MotionEvent.ACTION_DOWN && isEnabled) {
      touching = true
      parent?.requestDisallowInterceptTouchEvent(true)
      emit(true)
    }
    val handled = super.dispatchTouchEvent(event)
    if (event.actionMasked == MotionEvent.ACTION_UP || event.actionMasked == MotionEvent.ACTION_CANCEL) {
      touching = false
      parent?.requestDisallowInterceptTouchEvent(false)
      if (scrollState == OnScrollListener.SCROLL_STATE_IDLE) emit(false)
    }
    return handled
  }

  private fun emit(scrolling: Boolean) {
    if (updating || !initialized || id == NO_ID) return
    val data = Arguments.createMap().apply {
      putInt("value", value)
      putBoolean("scrolling", scrolling)
    }
    (context as ReactContext).getJSModule(RCTEventEmitter::class.java)
      .receiveEvent(id, "topWheelChange", data)
  }

  // NumberPicker owns its internal EditText layout, outside Yoga's child tree.
  override fun requestLayout() {
    super.requestLayout()
    if (relayoutPosted) return
    relayoutPosted = true
    post {
      relayoutPosted = false
      if (width > 0 && height > 0) {
        measure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY))
        layout(left, top, right, bottom)
      }
    }
  }
}
