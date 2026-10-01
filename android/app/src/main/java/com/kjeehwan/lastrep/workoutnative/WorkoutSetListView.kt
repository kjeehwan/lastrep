package com.kjeehwan.lastrep.workoutnative

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
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
import android.widget.LinearLayout
import android.widget.FrameLayout
import android.widget.TextView
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

class WorkoutSetListView(context: Context) : LinearLayout(context) {
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

  var reactTagForEvents: Int = View.NO_ID
  var weightLabel: String = "Weight"
  var repsLabel: String = "Reps"
  var rpeLabel: String = "RPE"

  init {
    orientation = VERTICAL
    recyclerView.layoutManager = LinearLayoutManager(context, RecyclerView.VERTICAL, false)
    recyclerView.adapter = adapter
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
        if (changedIndices.size <= 3) {
          changedIndices.forEach { idx -> notifyItemChanged(idx) }
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
      weightHint = weight
      repsHint = reps
      rpeHint = rpe
      notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
      return WorkoutSetViewHolder(createRowView(parent.context))
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
      (holder as WorkoutSetViewHolder).bind(position, items[position])
    }

    override fun getItemCount(): Int = items.size

    private fun createRowView(context: Context): WorkoutSetRowBinding {
      val root = LinearLayout(context).apply {
        orientation = HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        layoutParams = RecyclerView.LayoutParams(
          RecyclerView.LayoutParams.MATCH_PARENT,
          RecyclerView.LayoutParams.WRAP_CONTENT
        ).apply {
          bottomMargin = dp(4f)
        }
        setPadding(dp(4f))
      }

      val setLabel = TextView(context).apply {
        setTextColor(Color.parseColor("#CDD0E0"))
        textSize = 13f
        gravity = Gravity.CENTER
        layoutParams = LayoutParams(dp(24f), dp(32f))
      }
      root.addView(setLabel)

      val checkHitbox = FrameLayout(context).apply {
        // Keep the visible checkbox compact while providing a reliable 40dp hit target.
        layoutParams = LayoutParams(dp(40f), dp(40f)).apply {
          marginEnd = dp(2f)
        }
      }
      val check = AppCompatTextView(context).apply {
        layoutParams = FrameLayout.LayoutParams(dp(24f), dp(24f), Gravity.CENTER)
        gravity = Gravity.CENTER
        textSize = 12f
        setTypeface(typeface, Typeface.BOLD)
        setPadding(dp(2f))
      }
      checkHitbox.addView(check)
      root.addView(checkHitbox)

      val last = TextView(context).apply {
        setTextColor(Color.parseColor("#AAB0CC"))
        textSize = 11f
        maxLines = 3
        minHeight = dp(40f)
        gravity = Gravity.CENTER_VERTICAL
        isClickable = true
        isFocusable = true
        setLineSpacing(0f, 1.05f)
      }
      root.addView(last, LayoutParams(dp(84f), LayoutParams.WRAP_CONTENT).apply { marginStart = dp(2f) })

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

      root.addView(weight, LayoutParams(0, dp(40f), 1f).apply { marginStart = dp(6f) })
      root.addView(reps, LayoutParams(0, dp(40f), 1f).apply { marginStart = dp(6f) })
      root.addView(rpe, LayoutParams(0, dp(40f), 0.8f).apply { marginStart = dp(6f) })

      return WorkoutSetRowBinding(root, setLabel, checkHitbox, check, last, weight, reps, rpe)
    }

    private fun createInput(context: Context, hint: String, inputType: Int): AppCompatEditText {
      val bg = GradientDrawable().apply {
        setColor(Color.parseColor("#14FFFFFF"))
        cornerRadius = dp(10f).toFloat()
      }
      return AppCompatEditText(context).apply {
        this.hint = hint
        setHintTextColor(Color.parseColor("#7A7A8C"))
        setTextColor(Color.WHITE)
        textSize = 14f
        gravity = Gravity.CENTER
        setSingleLine(true)
        this.inputType = inputType
        includeFontPadding = false
        background = bg
        setPadding(dp(8f), 0, dp(8f), 0)
        setTouchArbitration()
      }
    }

    private fun AppCompatEditText.setTouchArbitration() {
      val slop = ViewConfiguration.get(context).scaledTouchSlop
      var startX = 0f
      var startY = 0f
      setOnTouchListener { v, event ->
        when (event.actionMasked) {
          MotionEvent.ACTION_DOWN -> {
            startX = event.x
            startY = event.y
            v.parent?.requestDisallowInterceptTouchEvent(true)
          }
          MotionEvent.ACTION_MOVE -> {
            val dx = abs(event.x - startX)
            val dy = abs(event.y - startY)
            if (dx > slop || dy > slop) {
              v.parent?.requestDisallowInterceptTouchEvent(false)
              return@setOnTouchListener false
            }
          }
          MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
            v.parent?.requestDisallowInterceptTouchEvent(false)
          }
        }
        false
      }
    }

    private inner class WorkoutSetViewHolder(private val binding: WorkoutSetRowBinding) :
      RecyclerView.ViewHolder(binding.root) {
      private var weightWatcher: TextWatcher? = null
      private var repsWatcher: TextWatcher? = null
      private var rpeWatcher: TextWatcher? = null
      private var localDone: Boolean = false
      private var boundIndex: Int = -1

      fun bind(position: Int, item: WorkoutSetItem) {
        boundIndex = position
        binding.setLabel.text = item.marker.ifBlank { (position + 1).toString() }
        binding.setLabel.setOnClickListener {
          if (boundIndex >= 0) onSetLabelPress(boundIndex)
        }
        binding.last.text = item.last.ifBlank { "-" }
        binding.last.setOnClickListener {
          if (boundIndex >= 0) onLastPress(boundIndex)
        }
        localDone = item.done
        applyCheckStyle(localDone)
        binding.checkHitbox.setOnClickListener {
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
        binding.rpe.hint = rpeHint

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
      }

      private fun applyCheckStyle(done: Boolean) {
        val bg = GradientDrawable().apply {
          shape = GradientDrawable.RECTANGLE
          cornerRadius = dp(6f).toFloat()
          setStroke(dp(2f), if (done) Color.parseColor("#7B61FF") else Color.parseColor("#CDD0E0"))
          setColor(if (done) Color.parseColor("#7B61FF") else Color.TRANSPARENT)
        }
        binding.check.background = bg
        binding.check.text = if (done) "\u2713" else ""
        binding.check.setTextColor(if (done) Color.parseColor("#0D0D1A") else Color.TRANSPARENT)
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
