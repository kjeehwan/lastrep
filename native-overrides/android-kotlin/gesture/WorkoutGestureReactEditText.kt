package __PACKAGE__.gesture

import android.content.Context
import android.view.MotionEvent
import android.view.ViewConfiguration
import com.facebook.react.views.textinput.ReactEditText

class WorkoutGestureReactEditText(context: Context) : ReactEditText(context) {
  private val touchSlop: Int = ViewConfiguration.get(context).scaledTouchSlop
  private var downX = 0f
  private var downY = 0f
  private var handedDragToParent = false

  override fun onTouchEvent(event: MotionEvent): Boolean {
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        downX = event.x
        downY = event.y
        handedDragToParent = false
        parent?.requestDisallowInterceptTouchEvent(true)
      }
      MotionEvent.ACTION_MOVE -> {
        if (!handedDragToParent) {
          val dx = kotlin.math.abs(event.x - downX)
          val dy = kotlin.math.abs(event.y - downY)
          if (dx > touchSlop || dy > touchSlop) {
            handedDragToParent = true
            parent?.requestDisallowInterceptTouchEvent(false)
            return false
          }
        }
      }
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
        handedDragToParent = false
        parent?.requestDisallowInterceptTouchEvent(false)
      }
    }

    return if (handedDragToParent) false else super.onTouchEvent(event)
  }
}

