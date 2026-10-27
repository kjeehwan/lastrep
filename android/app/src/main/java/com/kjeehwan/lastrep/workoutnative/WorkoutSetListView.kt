package com.kjeehwan.lastrep.workoutnative

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Rect
import com.facebook.react.common.assets.ReactFontManager
import com.facebook.react.bridge.ReadableMap
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.LinearLayout
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.ScrollView
import androidx.appcompat.widget.AppCompatEditText
import androidx.appcompat.widget.AppCompatTextView
import androidx.core.view.setPadding
import androidx.recyclerview.widget.ItemTouchHelper
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.events.RCTEventEmitter
import kotlin.math.abs

data class WorkoutSetItem(
  val marker: String,
  val last: String,
  val weight: String,
  val reps: String,
  val rpe: String,
  val targetHint: String = "",
  val done: Boolean
)

private data class WorkoutSetRowBinding(
  val root: View,
  val setLabel: TextView,
  val checkHitbox: FrameLayout,
  val check: AppCompatTextView,
  val last: TextView,
  val weight: AppCompatEditText,
  val reps: AppCompatEditText,
  val rpe: AppCompatEditText
)

private data class ActiveWorkoutSetEditor(val position: Int, val field: String)

class WorkoutSetListView(context: Context) : LinearLayout(context) {
  private var previewMode = false
  private var planMode = false
  private var activeSetIndex = -1
  private var editingSuspended = false
  private val recyclerView = RecyclerView(context)
  private val adapter = WorkoutSetAdapter(::emitChange, ::emitToggleDone, ::emitSetLabelPress, ::emitLastPress)
  private val deletePaint = Paint().apply {
    color = Color.parseColor("#D94848")
    style = Paint.Style.FILL
  }
  private val deleteStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.parseColor("#F06A6A")
    style = Paint.Style.STROKE
    strokeWidth = dp(1f).toFloat()
  }
  private val deleteTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.WHITE
    textSize = sp(12f)
    textAlign = Paint.Align.CENTER
  }

  private var ink = Color.parseColor("#242720")
  private var muted = Color.parseColor("#625F55")
  private var surface = Color.parseColor("#FFFCF5")
  private var border = Color.parseColor("#817B6E")
  private var primary = Color.parseColor("#242720")
  private var onPrimary = Color.parseColor("#FFFCF5")
  private var accent = Color.parseColor("#A33F24")
  private var accentSoft = Color.parseColor("#F3E4D8")
  private var family = "NotebookSans"
  private val largeText get() = resources.configuration.fontScale >= 1.5f
  private var reportedContentHeight = -1
  private var relayoutPosted = false

  // React Native owns the outer bounds. RecyclerView still needs a native
  // measure/layout pass after adapter changes, including palette-only updates.
  override fun requestLayout() {
    super.requestLayout()
    if (relayoutPosted) return
    relayoutPosted = true
    post {
      relayoutPosted = false
      if (width > 0) {
        measure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY))
        layout(left, top, right, bottom)
      }
    }
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    recyclerView.measure(widthMeasureSpec, MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED))
    val contentHeight = recyclerView.measuredHeight
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), resolveSize(contentHeight, heightMeasureSpec))
    if (reactTagForEvents != View.NO_ID && reportedContentHeight != contentHeight) {
      reportedContentHeight = contentHeight
      val payload = Arguments.createMap().apply { putDouble("height", contentHeight / resources.displayMetrics.density.toDouble()) }
      post {
        (context as? com.facebook.react.bridge.ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(reactTagForEvents, "topContentSizeChange", payload)
      }
    }
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    recyclerView.layout(0, 0, right - left, recyclerView.measuredHeight)
  }

  private fun notebookFace(): Typeface = ReactFontManager.getInstance().getTypeface(family, Typeface.NORMAL, context.assets)
  fun setNotebookColors(colors: ReadableMap?) {
    if (colors == null) return
    fun color(key: String, fallback: Int) = if (colors.hasKey(key)) Color.parseColor(colors.getString(key)) else fallback
    val next = listOf(color("ink", ink), color("muted", muted), color("input", color("surface", surface)), color("border", border), color("primary", primary), color("onPrimary", onPrimary), color("accent", accent), color("accentSoft", accentSoft))
    if (next == listOf(ink, muted, surface, border, primary, onPrimary, accent, accentSoft)) return
    ink = next[0]; muted = next[1]; surface = next[2]; border = next[3]; primary = next[4]; onPrimary = next[5]
    accent = next[6]; accentSoft = next[7]
    adapter.refreshPalette()
    adapter.notifyDataSetChanged()
  }
  fun setNotebookFont(value: String?) { if (value != null && family != value) { family = value; adapter.notifyDataSetChanged() } }
  var reactTagForEvents: Int = View.NO_ID
  var weightLabel: String = "Weight"
  var repsLabel: String = "Reps"
  var rpeLabel: String = "RPE"

  fun setPlanMode(value: Boolean) { if (planMode != value) { planMode = value; adapter.notifyDataSetChanged(); requestLayout() } }

  fun setPreviewMode(value: Boolean) { if (previewMode != value) { previewMode = value; adapter.notifyDataSetChanged(); requestLayout() } }

  fun setActiveSetIndex(value: Int) {
    if (activeSetIndex == value) return
    activeSetIndex = value
    adapter.clearEditorOutside(value)
    adapter.refreshHighlights()
  }

  fun setEditingSuspended(value: Boolean) {
    if (editingSuspended == value) return
    editingSuspended = value
    if (value) {
      adapter.clearEditorOutside(-1)
      recyclerView.clearFocus()
    }
    recyclerView.descendantFocusability = if (value) ViewGroup.FOCUS_BLOCK_DESCENDANTS else ViewGroup.FOCUS_AFTER_DESCENDANTS
  }

  private fun activateSet(index: Int) {
    if (editingSuspended || index < 0) return
    setActiveSetIndex(index)
    if (reactTagForEvents == View.NO_ID) return
    val payload = Arguments.createMap().apply { putInt("index", index) }
    (context as? com.facebook.react.bridge.ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(reactTagForEvents, "topSetActivate", payload)
  }

  init {
    orientation = VERTICAL
    viewTreeObserver.addOnGlobalLayoutListener { if (hasFocus()) post { keepEditorVisible() } }
    recyclerView.layoutManager = LinearLayoutManager(context, RecyclerView.VERTICAL, false)
    recyclerView.adapter = adapter
    // Exact-field focus is owned here. RecyclerView's layout recovery otherwise
    // chooses the first focusable child (Weight) after a confirmed Reps/RPE tap.
    recyclerView.preserveFocusAfterLayout = false
    recyclerView.isNestedScrollingEnabled = false
    recyclerView.overScrollMode = RecyclerView.OVER_SCROLL_NEVER
    addView(
      recyclerView,
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
    )

    val touchHelper = ItemTouchHelper(
      object : ItemTouchHelper.SimpleCallback(0, ItemTouchHelper.LEFT) {
        override fun onMove(
          recyclerView: RecyclerView,
          viewHolder: RecyclerView.ViewHolder,
          target: RecyclerView.ViewHolder
        ): Boolean = false

        override fun onSwiped(viewHolder: RecyclerView.ViewHolder, direction: Int) {
          val position = viewHolder.bindingAdapterPosition
          if (position != RecyclerView.NO_POSITION) {
            emitDelete(position)
          }
        }

        override fun onChildDraw(
          c: Canvas,
          recyclerView: RecyclerView,
          viewHolder: RecyclerView.ViewHolder,
          dX: Float,
          dY: Float,
          actionState: Int,
          isCurrentlyActive: Boolean
        ) {
          if (actionState == ItemTouchHelper.ACTION_STATE_SWIPE && dX < 0) {
            val itemView = viewHolder.itemView
            val horizontalInset = dp(10f).toFloat()
            val verticalInset = dp(6f).toFloat()
            val left = (itemView.right + dX + horizontalInset).coerceAtLeast(itemView.left + horizontalInset)
            val top = itemView.top + verticalInset
            val right = itemView.right - horizontalInset
            val bottom = itemView.bottom - verticalInset
            val buttonRect = RectF(left, top, right, bottom)
            val radius = dp(10f).toFloat()

            c.drawRoundRect(buttonRect, radius, radius, deletePaint)
            c.drawRoundRect(buttonRect, radius, radius, deleteStrokePaint)

            val centerX = buttonRect.centerX()
            val centerY = buttonRect.centerY() - (deleteTextPaint.descent() + deleteTextPaint.ascent()) / 2f
            c.drawText("Delete", centerX, centerY, deleteTextPaint)
          }
          super.onChildDraw(c, recyclerView, viewHolder, dX, dY, actionState, isCurrentlyActive)
        }
      }
    )
    touchHelper.attachToRecyclerView(recyclerView)
  }

  private fun keepEditorVisible() {
    if (!isAttachedToWindow || editingSuspended || !adapter.hasActiveEditor()) return
    val input = findFocus() as? AppCompatEditText ?: return
    if (!input.isAttachedToWindow) return
    var ancestor = input.parent
    while (ancestor != null && ancestor !is ScrollView) ancestor = ancestor.parent
    val scroll = ancestor as? ScrollView ?: return
    val location = IntArray(2); input.getLocationOnScreen(location)
    val visible = Rect(); scroll.getGlobalVisibleRect(visible)
    val window = Rect(); getWindowVisibleDisplayFrame(window)
    val bottom = minOf(visible.bottom, window.bottom) - dp(16f)
    val delta = location[1] + input.height - bottom
    if (delta > 0) scroll.scrollTo(scroll.scrollX, scroll.scrollY + delta)
    else if (location[1] < visible.top + dp(8f)) scroll.scrollTo(scroll.scrollX, (scroll.scrollY + location[1] - visible.top - dp(8f)).coerceAtLeast(0))
  }

  fun setItems(items: List<WorkoutSetItem>) {
    adapter.setItems(items)
  }

  fun setColumnLabels(weight: String, reps: String, rpe: String) {
    weightLabel = weight
    repsLabel = reps
    rpeLabel = rpe
    adapter.setColumnLabels(weight, reps, rpe)
  }

  private fun emitChange(index: Int, field: String, value: String) {
    if (reactTagForEvents == View.NO_ID) return
    val payload = Arguments.createMap()
    payload.putInt("index", index)
    payload.putString("field", field)
    payload.putString("value", value)
    (context as? com.facebook.react.bridge.ReactContext)
      ?.getJSModule(RCTEventEmitter::class.java)
      ?.receiveEvent(reactTagForEvents, "topSetChange", payload)
  }

  private fun emitToggleDone(index: Int, done: Boolean) {
    if (reactTagForEvents == View.NO_ID) return
    val payload = Arguments.createMap()
    payload.putInt("index", index)
    payload.putBoolean("done", done)
    (context as? com.facebook.react.bridge.ReactContext)
      ?.getJSModule(RCTEventEmitter::class.java)
      ?.receiveEvent(reactTagForEvents, "topToggleDone", payload)
  }

  private fun emitDelete(index: Int) {
    if (reactTagForEvents == View.NO_ID) return
    val payload = Arguments.createMap()
    payload.putInt("index", index)
    (context as? com.facebook.react.bridge.ReactContext)
      ?.getJSModule(RCTEventEmitter::class.java)
      ?.receiveEvent(reactTagForEvents, "topDeleteSet", payload)
  }

  private fun emitSetLabelPress(index: Int) {
    if (reactTagForEvents == View.NO_ID) return
    val payload = Arguments.createMap()
    payload.putInt("index", index)
    (context as? com.facebook.react.bridge.ReactContext)
      ?.getJSModule(RCTEventEmitter::class.java)
      ?.receiveEvent(reactTagForEvents, "topSetLabelPress", payload)
  }

  private fun emitLastPress(index: Int) {
    if (reactTagForEvents == View.NO_ID) return
    val payload = Arguments.createMap()
    payload.putInt("index", index)
    (context as? com.facebook.react.bridge.ReactContext)
      ?.getJSModule(RCTEventEmitter::class.java)
      ?.receiveEvent(reactTagForEvents, "topLastPress", payload)
  }

  private fun dp(value: Float): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, resources.displayMetrics).toInt()

  private fun sp(value: Float): Float =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, value, resources.displayMetrics)

  private inner class WorkoutSetAdapter(
    private val onChange: (Int, String, String) -> Unit,
    private val onToggleDone: (Int, Boolean) -> Unit,
    private val onSetLabelPress: (Int) -> Unit,
    private val onLastPress: (Int) -> Unit
  ) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {
    private val items = mutableListOf<WorkoutSetItem>()
    private var weightHint: String = "Weight"
    private var repsHint: String = "Reps"
    private var rpeHint: String = "RPE"
    private var activeEditor: ActiveWorkoutSetEditor? = null

    fun hasActiveEditor() = activeEditor != null

    fun clearEditorOutside(index: Int) {
      if (activeEditor?.position != index) {
        activeEditor = null
        recyclerView.clearFocus()
      }
    }

    fun refreshHighlights() {
      for (i in 0 until recyclerView.childCount) {
        (recyclerView.getChildViewHolder(recyclerView.getChildAt(i)) as? WorkoutSetViewHolder)?.updateHighlight()
      }
    }

    fun refreshPalette() {
      for (i in 0 until recyclerView.childCount) {
        (recyclerView.getChildViewHolder(recyclerView.getChildAt(i)) as? WorkoutSetViewHolder)?.applyPalette()
      }
    }

    fun setItems(next: List<WorkoutSetItem>) {
      if (items.size == next.size) {
        val changedIndices = mutableListOf<Int>()
        for (i in next.indices) {
          val current = items[i]
          val incoming = next[i]
          if (
            current.marker != incoming.marker ||
            current.last != incoming.last ||
            current.weight != incoming.weight ||
            current.reps != incoming.reps ||
            current.rpe != incoming.rpe ||
            current.done != incoming.done
          ) {
            changedIndices.add(i)
          }
        }
        if (changedIndices.isEmpty()) return
        changedIndices.forEach { idx -> items[idx] = next[idx] }
        // The actively edited cell already contains the new text. Rebinding it after each
        // JS state update can make RecyclerView transfer focus to the first input in the row.
        val activePosition = activeEditor?.position
        val indicesToRebind = changedIndices.filter { it != activePosition }
        if (indicesToRebind.isEmpty()) return
        if (activePosition != null || indicesToRebind.size <= 3) {
          indicesToRebind.forEach { idx -> notifyItemChanged(idx) }
        } else {
          notifyDataSetChanged()
        }
        return
      }
      items.clear()
      items.addAll(next)
      notifyDataSetChanged()
    }

    fun setColumnLabels(weight: String, reps: String, rpe: String) {
      if (weightHint == weight && repsHint == reps && rpeHint == rpe) return
      weightHint = weight
      repsHint = reps
      rpeHint = rpe
      notifyDataSetChanged()
    }

    override fun getItemViewType(position: Int): Int = if (planMode) 2 else if (previewMode) 1 else 0

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
      return WorkoutSetViewHolder(createRowView(parent.context))
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
      (holder as WorkoutSetViewHolder).bind(position, items[position])
    }

    override fun getItemCount(): Int = items.size

    private fun createRowView(context: Context): WorkoutSetRowBinding {
      val root = object : LinearLayout(context) {
        override fun dispatchDraw(canvas: Canvas) {
          super.dispatchDraw(canvas)
          if (isSelected) canvas.drawRect(0f, 0f, dp(2f).toFloat(), height.toFloat(), Paint().apply { color = accent })
        }
      }.apply {
        orientation = if (largeText && !previewMode) VERTICAL else HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        descendantFocusability = ViewGroup.FOCUS_AFTER_DESCENDANTS
        layoutParams = RecyclerView.LayoutParams(
          RecyclerView.LayoutParams.MATCH_PARENT,
          RecyclerView.LayoutParams.WRAP_CONTENT
        ).apply {
          bottomMargin = dp(4f)
        }
        setPadding(0, dp(2f), 0, dp(2f))
      }

      val setLabel = TextView(context).apply {
        setTextColor(muted)
        textSize = 13f
        gravity = Gravity.CENTER
        layoutParams = LayoutParams(dp(if (previewMode) 40f else 24f), dp(44f))
      }
      val header = if (largeText && !previewMode) LinearLayout(context).apply { orientation = HORIZONTAL; gravity = Gravity.CENTER_VERTICAL } else root
      header.addView(setLabel)

      val checkHitbox = FrameLayout(context).apply {
        // Keep the visible checkbox compact while providing a reliable 40dp hit target.
        layoutParams = LayoutParams(dp(44f), dp(48f)).apply {
          marginEnd = dp(2f)
        }
      }
      val check = object : AppCompatTextView(context) {
        override fun onDraw(canvas: Canvas) {
          super.onDraw(canvas)
          if (!isActivated) return
          val scale = width / 20f
          val path = Path().apply { moveTo(5f * scale, 10f * scale); lineTo(9f * scale, 14f * scale); lineTo(15f * scale, 6f * scale) }
          canvas.drawPath(path, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = onPrimary; style = Paint.Style.STROKE; strokeWidth = 2f * scale; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND })
        }
      }.apply {
        layoutParams = FrameLayout.LayoutParams(dp(if (largeText) 36f else 20f), dp(if (largeText) 36f else 20f), Gravity.CENTER)
        gravity = Gravity.CENTER
        textSize = 12f
        setTypeface(typeface, Typeface.BOLD)
        setPadding(dp(2f))
      }
      checkHitbox.addView(check)

      val last = TextView(context).apply {
        setTextColor(muted)
        textSize = 12f
        maxLines = 3
        minHeight = dp(40f)
        gravity = Gravity.CENTER_VERTICAL
        isClickable = true
        isFocusable = true
        setLineSpacing(0f, 1.05f)
      }
      if (!previewMode && !planMode) header.addView(last, if (largeText) LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f) else LayoutParams(dp(96f), LayoutParams.WRAP_CONTENT).apply { marginStart = dp(4f) })
      setLabel.typeface = notebookFace(); last.typeface = notebookFace()

      val weight = createInput(
        context,
        "Weight",
        InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
      )
      val reps = createInput(context, "Reps", InputType.TYPE_CLASS_NUMBER)
      val rpe = createInput(
        context,
        "RPE",
        InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
      )

      if (previewMode) {
        val inputHeight = dp(if (largeText) 64f else 48f)
        root.addView(weight, LayoutParams(0, inputHeight, 1f).apply { marginStart = dp(4f) })
        root.addView(reps, LayoutParams(0, inputHeight, 1f).apply { marginStart = dp(4f) })
      } else if (largeText) {
        if (!planMode) header.addView(checkHitbox)
        root.addView(header, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
        for ((label, input) in listOf(weightHint to weight, repsHint to reps, (if (rpeHint == "0-4") "RIR" else "RPE") to rpe)) {
          val line = LinearLayout(context).apply { orientation = HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(0, dp(4f), 0, dp(4f)) }
          val text = TextView(context).apply { this.text = label; textSize = 14f; setTextColor(muted); typeface = notebookFace() }
          line.addView(text, LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
          line.addView(input, LayoutParams(dp(140f), dp(64f)))
          root.addView(line, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
        }
      } else {
        root.addView(weight, LayoutParams(0, dp(48f), 1f).apply { marginStart = dp(if (planMode) 12f else 4f) })
        root.addView(reps, LayoutParams(0, dp(48f), 1f).apply { marginStart = dp(if (planMode) 12f else 4f) })
        root.addView(rpe, LayoutParams(0, dp(48f), 1f).apply { marginStart = dp(if (planMode) 12f else 4f) })
        if (!planMode) root.addView(checkHitbox)
      }

      return WorkoutSetRowBinding(root, setLabel, checkHitbox, check, last, weight, reps, rpe)
    }

    private fun createInput(context: Context, hint: String, inputType: Int): AppCompatEditText {
      val bg = GradientDrawable().apply {
        setColor(surface)
        setStroke(dp(1f), border)
        cornerRadius = dp(4f).toFloat()
      }
      return AppCompatEditText(context).apply {
        this.hint = hint
        setHintTextColor(muted)
        setTextColor(ink)
        textSize = 16f
        gravity = Gravity.CENTER
        setSingleLine(true)
        this.inputType = inputType
        typeface = notebookFace()
        setSelectAllOnFocus(true)
        imeOptions = imeOptions or EditorInfo.IME_FLAG_NO_EXTRACT_UI or EditorInfo.IME_FLAG_NO_FULLSCREEN
        includeFontPadding = false
        background = bg
        setPadding(dp(3f), 0, dp(3f), 0)
      }
    }

    private inner class WorkoutSetViewHolder(private val binding: WorkoutSetRowBinding) :
      RecyclerView.ViewHolder(binding.root) {
      private var weightWatcher: TextWatcher? = null
      private var repsWatcher: TextWatcher? = null
      private var rpeWatcher: TextWatcher? = null
      private var localDone: Boolean = false
      private var boundIndex: Int = -1
      private val deferredTouches = mutableSetOf<String>()
      private val draggedTouches = mutableSetOf<String>()
      private val inputTouchStarts = mutableMapOf<String, Pair<Float, Float>>()

      fun bind(position: Int, item: WorkoutSetItem) {
        boundIndex = position
        applyPalette()
        binding.setLabel.text = item.marker.ifBlank { (position + 1).toString() }
        binding.setLabel.setOnClickListener {
          if (boundIndex >= 0) onSetLabelPress(boundIndex)
        }
        val warmup = item.marker == "W"
        val setDescription = if (warmup) "Warm-up set ${position + 1}" else "Set ${item.marker}"
        binding.setLabel.contentDescription = "$setDescription options"
        binding.last.text = if (warmup) "" else item.last.ifBlank { "-" }
        binding.last.isEnabled = !warmup && item.last.isNotBlank() && item.last != "-"
        binding.last.importantForAccessibility = if (warmup) View.IMPORTANT_FOR_ACCESSIBILITY_NO else View.IMPORTANT_FOR_ACCESSIBILITY_AUTO
        binding.last.contentDescription = if (warmup) null else if (binding.last.isEnabled) "Set ${item.marker}, copy Last: ${item.last}" else "Set ${item.marker}, no prior record"
        binding.weight.contentDescription = "$setDescription, $weightHint"
        binding.reps.contentDescription = "$setDescription, $repsHint"
        binding.rpe.contentDescription = "$setDescription, ${if (rpeHint == "0-4") "RIR" else "RPE"}"
        binding.checkHitbox.isFocusable = true
        binding.checkHitbox.contentDescription = "$setDescription completion"
        binding.checkHitbox.accessibilityDelegate = object : View.AccessibilityDelegate() {
          override fun onInitializeAccessibilityNodeInfo(host: View, info: android.view.accessibility.AccessibilityNodeInfo) {
            super.onInitializeAccessibilityNodeInfo(host, info)
            info.className = "android.widget.CheckBox"
            info.isCheckable = true
            info.isChecked = localDone
          }
        }
        binding.last.setOnClickListener {
          if (boundIndex >= 0) onLastPress(boundIndex)
        }
        localDone = item.done
        applyCheckStyle(localDone)
        binding.checkHitbox.setOnClickListener {
          activateSet(boundIndex)
          activeEditor = null
          recyclerView.clearFocus()
          localDone = !localDone
          applyCheckStyle(localDone)
          if (boundIndex >= 0) onToggleDone(boundIndex, localDone)
        }

        weightWatcher?.let { binding.weight.removeTextChangedListener(it) }
        repsWatcher?.let { binding.reps.removeTextChangedListener(it) }
        rpeWatcher?.let { binding.rpe.removeTextChangedListener(it) }

        if (!binding.weight.isFocused && (binding.weight.text?.toString() ?: "") != item.weight) {
          binding.weight.setText(item.weight)
        }
        if (!binding.reps.isFocused && (binding.reps.text?.toString() ?: "") != item.reps) {
          binding.reps.setText(item.reps)
        }
        if (!binding.rpe.isFocused && (binding.rpe.text?.toString() ?: "") != item.rpe) {
          binding.rpe.setText(item.rpe)
        }
        binding.weight.hint = weightHint
        binding.reps.hint = repsHint
        binding.rpe.hint = item.targetHint.ifBlank { rpeHint }

        bindFocusTracking(binding.weight, "weight")
        bindFocusTracking(binding.reps, "reps")
        bindFocusTracking(binding.rpe, "rpe")

        if (!binding.weight.isFocused) {
          binding.weight.setSelection((binding.weight.text?.length ?: 0).coerceAtLeast(0))
        }
        if (!binding.reps.isFocused) {
          binding.reps.setSelection((binding.reps.text?.length ?: 0).coerceAtLeast(0))
        }
        if (!binding.rpe.isFocused) {
          binding.rpe.setSelection((binding.rpe.text?.length ?: 0).coerceAtLeast(0))
        }

        weightWatcher = afterTextChanged { onChange(boundIndex, "weight", it) }
        repsWatcher = afterTextChanged { onChange(boundIndex, "reps", it) }
        rpeWatcher = afterTextChanged { onChange(boundIndex, "rpe", it) }

        binding.weight.addTextChangedListener(weightWatcher)
        binding.reps.addTextChangedListener(repsWatcher)
        binding.rpe.addTextChangedListener(rpeWatcher)

        // React state updates can rebind this RecyclerView row while the user is tapping.
        // Restore only the field that was explicitly touched, never the first input in the row.
        val editor = activeEditor
        if (editor?.position == position) {
          val input = when (editor.field) {
            "weight" -> binding.weight
            "reps" -> binding.reps
            else -> binding.rpe
          }
          input.post {
            if (!editingSuspended && activeSetIndex == position && activeEditor == editor && boundIndex == position && bindingAdapterPosition == position && input.isAttachedToWindow && !input.hasFocus()) {
              input.requestFocus()
              input.setSelection(input.text?.length ?: 0)
            }
          }
        }
      }

      fun updateHighlight() {
        binding.root.isSelected = boundIndex >= 0 && boundIndex == activeSetIndex
        binding.root.setBackgroundColor(if (binding.root.isSelected) accentSoft else Color.TRANSPARENT)
        binding.root.invalidate()
      }

      fun applyPalette() {
        updateHighlight()
        binding.setLabel.setTextColor(muted); binding.last.setTextColor(muted)
        for (input in listOf(binding.weight, binding.reps, binding.rpe)) {
          input.setTextColor(ink); input.setHintTextColor(muted); input.typeface = notebookFace()
          input.background = GradientDrawable().apply {
            setColor(surface); setStroke(dp(if (input.hasFocus()) 2f else 1f), if (input.hasFocus()) accent else border); cornerRadius = dp(4f).toFloat()
          }
        }
        applyCheckStyle(localDone)
      }

      private fun bindFocusTracking(input: AppCompatEditText, field: String) {
        input.setOnFocusChangeListener { _, hasFocus ->
          input.background = GradientDrawable().apply { setColor(surface); setStroke(dp(if (hasFocus) 2f else 1f), if (hasFocus) accent else border); cornerRadius = dp(4f).toFloat() }
          if (hasFocus && !editingSuspended && activeSetIndex == boundIndex) {
            activeEditor = ActiveWorkoutSetEditor(boundIndex, field)
            input.postDelayed({ keepEditorVisible() }, 120)
          } else if (!hasFocus && activeEditor == ActiveWorkoutSetEditor(boundIndex, field)) {
            activeEditor = null
          }
        }
        input.setOnTouchListener { view, event -> handleInputTouch(view as AppCompatEditText, event, field) }
      }

      private fun handleInputTouch(input: AppCompatEditText, event: MotionEvent, field: String): Boolean {
        if (editingSuspended) return true
        val slop = ViewConfiguration.get(context).scaledTouchSlop.toFloat()
        when (event.actionMasked) {
          MotionEvent.ACTION_DOWN -> {
            inputTouchStarts[field] = event.rawX to event.rawY
            draggedTouches.remove(field)
            // Do not let TextView or RecyclerView focus an untouched field before a tap is confirmed.
            if (!input.hasFocus()) deferredTouches.add(field)
            input.parent?.requestDisallowInterceptTouchEvent(true)
          }
          MotionEvent.ACTION_MOVE -> {
            val start = inputTouchStarts[field] ?: return false
            if (abs(event.rawX - start.first) > slop || abs(event.rawY - start.second) > slop) {
              draggedTouches.add(field)
              input.parent?.requestDisallowInterceptTouchEvent(false)
            }
          }
          MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
            val deferred = deferredTouches.remove(field)
            val tapped = event.actionMasked == MotionEvent.ACTION_UP && !draggedTouches.remove(field)
            inputTouchStarts.remove(field)
            input.parent?.requestDisallowInterceptTouchEvent(false)
            if (tapped && boundIndex >= 0 && bindingAdapterPosition == boundIndex && input.isAttachedToWindow) {
              activateSet(boundIndex)
              activeEditor = ActiveWorkoutSetEditor(boundIndex, field)
              if (deferred) {
                input.isFocusableInTouchMode = true
                input.requestFocus()
                // Replay TextView's tap only after slop detection; scrolling must never open the keyboard.
                val down = MotionEvent.obtain(event).apply { action = MotionEvent.ACTION_DOWN }
                input.onTouchEvent(down)
                down.recycle()
                input.onTouchEvent(event)
                input.selectAll()
                (context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager)?.showSoftInput(input, InputMethodManager.SHOW_IMPLICIT)
                input.postDelayed({ keepEditorVisible() }, 120)
              }
            }
            if (deferred) return true
          }
        }
        return field in deferredTouches
      }

      private fun applyCheckStyle(done: Boolean) {
        val bg = GradientDrawable().apply {
          shape = GradientDrawable.RECTANGLE
          cornerRadius = dp(if (largeText) 6f else 4f).toFloat()
          setStroke(dp(if (largeText) 2f else 1f), if (done) primary else border)
          setColor(if (done) primary else surface)
        }
        binding.check.background = bg
        binding.check.text = ""
        // Row selection cascades to child isSelected; completion must be independent.
        binding.check.isActivated = done
        binding.check.invalidate()
        binding.check.setTextColor(if (done) onPrimary else Color.TRANSPARENT)
      }

      private fun afterTextChanged(block: (String) -> Unit): TextWatcher =
        object : TextWatcher {
          override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
          override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
          override fun afterTextChanged(s: Editable?) {
            if (boundIndex < 0) return
            block(s?.toString() ?: "")
          }
        }
    }

  }
}
