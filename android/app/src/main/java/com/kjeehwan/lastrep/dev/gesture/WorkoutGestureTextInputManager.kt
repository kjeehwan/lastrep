package com.kjeehwan.lastrep.dev.gesture

import android.text.InputType
import android.view.ViewGroup
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.views.textinput.ReactEditText
import com.facebook.react.views.textinput.ReactTextInputManager

@ReactModule(name = WorkoutGestureTextInputManager.REACT_CLASS)
class WorkoutGestureTextInputManager : ReactTextInputManager() {
  companion object {
    const val REACT_CLASS = "WorkoutGestureTextInput"
  }

  override fun getName(): String = REACT_CLASS

  override fun createViewInstance(context: ThemedReactContext): ReactEditText {
    val editText = WorkoutGestureReactEditText(context)
    val inputType = editText.inputType
    editText.inputType = inputType and InputType.TYPE_TEXT_FLAG_MULTI_LINE.inv()
    editText.returnKeyType = "done"
    editText.includeFontPadding = false
    // Remove Android's default EditText underline; RN style handles visual container.
    editText.background = null
    editText.layoutParams =
      ViewGroup.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    return editText
  }
}
