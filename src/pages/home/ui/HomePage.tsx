"use client"

import { useMemo, useRef, useState } from "react"


type RepeatOption = "none" | "daily" | "weekly" | "monthly" | "yearly"

type CalendarEvent = {
  id: string
  title: string
  allDay: boolean
  start: string
  end: string
  color: string
  repeat: RepeatOption
}

type ScheduleMap = Record<string, CalendarEvent[]>

const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"]
const COLOR_PRESETS = ["#111827", "#ef4444", "#3b82f6", "#10b981", "#a855f7", "#f59e0b"]

function pad2(value: number) {
  return String(value).padStart(2, "0")
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function formatDateForInput(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function formatDayHeadline(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEK_DAYS[date.getDay()]})`
}

function getMonthGrid(viewDate: Date) {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const start = new Date(firstDay)
  start.setDate(1 - firstDay.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

function shiftMonth(base: Date, delta: number) {
  const next = new Date(base)
  next.setMonth(base.getMonth() + delta, 1)
  return next
}

function parseDateTimeParts(dateText: string, timeText: string) {
  return new Date(`${dateText}T${timeText || "00:00"}`)
}

function formatTimeRange(event: CalendarEvent) {
  if (event.allDay) return "종일"
  const start = new Date(event.start)
  const end = new Date(event.end)
  return `${pad2(start.getHours())}:${pad2(start.getMinutes())}-${pad2(end.getHours())}:${pad2(end.getMinutes())}`
}

export function HomePage() {
  const now = new Date()
  const [viewDate, setViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(new Date(now))
  const [selectedDateKey, setSelectedDateKey] = useState(dateKey(now))
  const [showPicker, setShowPicker] = useState(false)
  const [showDayView, setShowDayView] = useState(false)
  const [showCreateView, setShowCreateView] = useState(false)
  const [pickerYear, setPickerYear] = useState(viewDate.getFullYear())
  const [pickerMonth, setPickerMonth] = useState(viewDate.getMonth() + 1)
  const [schedules, setSchedules] = useState<ScheduleMap>({})

  const [title, setTitle] = useState("")
  const [allDay, setAllDay] = useState(false)
  const [startDateInput, setStartDateInput] = useState(formatDateForInput(selectedDate))
  const [startTimeInput, setStartTimeInput] = useState("09:00")
  const [endDateInput, setEndDateInput] = useState(formatDateForInput(selectedDate))
  const [endTimeInput, setEndTimeInput] = useState("10:00")
  const [textColor, setTextColor] = useState(COLOR_PRESETS[0])
  const [repeat, setRepeat] = useState<RepeatOption>("none")

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggeredRef = useRef(false)
  const lastTapRef = useRef<{ key: string; at: number } | null>(null)
  const swipeStartXRef = useRef<number | null>(null)

  const days = useMemo(() => getMonthGrid(viewDate), [viewDate])
  const years = useMemo(() => Array.from({ length: 101 }, (_, i) => 1970 + i), [])
  const eventsForSelectedDay = useMemo(() => {
    return [...(schedules[selectedDateKey] ?? [])].sort((a, b) => {
      if (a.allDay && !b.allDay) return -1
      if (!a.allDay && b.allDay) return 1
      return new Date(a.start).getTime() - new Date(b.start).getTime()
    })
  }, [schedules, selectedDateKey])

  function moveMonth(delta: number) {
    setViewDate((prev) => shiftMonth(prev, delta))
  }

  function openDayView(date: Date) {
    const key = dateKey(date)
    setSelectedDate(new Date(date))
    setSelectedDateKey(key)
    setShowDayView(true)
  }

  function openCreateView(date: Date) {
    const next = new Date(date)
    next.setHours(10, 0, 0, 0)

    setSelectedDate(new Date(date))
    setSelectedDateKey(dateKey(date))
    setTitle("")
    setAllDay(false)
    setStartDateInput(formatDateForInput(date))
    setStartTimeInput("09:00")
    setEndDateInput(formatDateForInput(next))
    setEndTimeInput("10:00")
    setTextColor(COLOR_PRESETS[0])
    setRepeat("none")
    setShowCreateView(true)
  }

  function handleTap(targetDate: Date, at: number) {
    const key = dateKey(targetDate)
    const lastTap = lastTapRef.current

    setSelectedDate(new Date(targetDate))
    setSelectedDateKey(key)

    if (lastTap && lastTap.key === key && at - lastTap.at < 300) {
      openDayView(targetDate)
      lastTapRef.current = null
      return
    }

    lastTapRef.current = { key, at }
  }

  function startPress(targetDate: Date) {
    longPressTriggeredRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true
      openCreateView(targetDate)
    }, 520)
  }

  function endPress(targetDate: Date, at: number) {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    if (!longPressTriggeredRef.current) {
      handleTap(targetDate, at)
    }
  }

  function cancelPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  function applyYearMonth() {
    setViewDate(new Date(pickerYear, pickerMonth - 1, 1))
    setShowPicker(false)
  }

  function saveSchedule() {
    const trimmed = title.trim()
    if (!trimmed) return

    const start = allDay
      ? new Date(`${startDateInput}T00:00`)
      : parseDateTimeParts(startDateInput, startTimeInput)
    const end = allDay
      ? new Date(`${endDateInput || startDateInput}T23:59`)
      : parseDateTimeParts(endDateInput, endTimeInput)

    const key = dateKey(start)
    const newEvent: CalendarEvent = {
      id: `${Date.now()}`,
      title: trimmed,
      allDay,
      start: start.toISOString(),
      end: end.toISOString(),
      color: textColor,
      repeat,
    }

    setSchedules((prev) => ({
      ...prev,
      [key]: [...(prev[key] ?? []), newEvent],
    }))

    setSelectedDate(start)
    setSelectedDateKey(key)
    setShowCreateView(false)
    setShowDayView(true)
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col bg-white px-4 pb-5 pt-6 text-zinc-900">
      <header className="relative">
        <button
          type="button"
          onClick={() => {
            setPickerYear(viewDate.getFullYear())
            setPickerMonth(viewDate.getMonth() + 1)
            setShowPicker((prev) => !prev)
          }}
          className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-lg font-semibold"
        >
          {viewDate.getFullYear()}년 {viewDate.getMonth() + 1}월
        </button>

        {showPicker ? (
          <div className="absolute left-0 right-0 top-14 z-20 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl">
            <p className="mb-3 text-sm text-zinc-500">연도와 월을 각각 선택해 먼 날짜로 이동하세요.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="max-h-52 overflow-y-auto rounded-lg border border-zinc-200 p-1">
                {years.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => setPickerYear(year)}
                    className={`block w-full rounded-md px-3 py-2 text-left text-sm ${
                      pickerYear === year ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"
                    }`}
                  >
                    {year}년
                  </button>
                ))}
              </div>
              <div className="max-h-52 overflow-y-auto rounded-lg border border-zinc-200 p-1">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <button
                    key={month}
                    type="button"
                    onClick={() => setPickerMonth(month)}
                    className={`block w-full rounded-md px-3 py-2 text-left text-sm ${
                      pickerMonth === month ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"
                    }`}
                  >
                    {month}월
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              >
                취소
              </button>
              <button
                type="button"
                onClick={applyYearMonth}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white"
              >
                이동
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <section
        className="mt-5 flex-1"
        onTouchStart={(event) => {
          swipeStartXRef.current = event.changedTouches[0]?.clientX ?? null
        }}
        onTouchEnd={(event) => {
          const startX = swipeStartXRef.current
          const endX = event.changedTouches[0]?.clientX
          if (startX == null || endX == null) return
          const delta = endX - startX
          if (delta > 55) moveMonth(-1)
          if (delta < -55) moveMonth(1)
          swipeStartXRef.current = null
        }}
      >
        <div className="grid grid-cols-7 gap-1">
          {WEEK_DAYS.map((day, index) => (
            <div
              key={day}
              className={`py-2 text-center text-sm font-semibold ${
                index === 0 ? "text-red-500" : index === 6 ? "text-blue-500" : "text-zinc-700"
              }`}
            >
              {day}
            </div>
          ))}

          {days.map((date) => {
            const key = dateKey(date)
            const isCurrentMonth = date.getMonth() === viewDate.getMonth()
            const isSelected = selectedDateKey === key
            const weekDay = date.getDay()
            const colorClass = weekDay === 0 ? "text-red-500" : weekDay === 6 ? "text-blue-500" : "text-zinc-900"

            return (
              <button
                key={key}
                type="button"
                onPointerDown={() => startPress(date)}
                onPointerUp={(event) => endPress(date, event.timeStamp)}
                onPointerLeave={cancelPress}
                onPointerCancel={cancelPress}
                className={`relative min-h-14 rounded-lg border text-left transition ${
                  isCurrentMonth ? "border-zinc-100 bg-white" : "border-zinc-100 bg-zinc-50/70 text-zinc-400"
                } ${isSelected ? "ring-2 ring-zinc-900/40" : "active:bg-zinc-100"}`}
              >
                <span className={`absolute left-2 top-2 text-sm ${isCurrentMonth ? colorClass : "text-zinc-400"}`}>
                  {date.getDate()}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {showDayView ? (
        <div className="fixed inset-0 z-30 bg-white px-4 pb-6 pt-5">
          <div className="mx-auto flex h-full w-full max-w-md flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 pb-3">
              <div>
                <p className="text-base font-semibold">오늘 {formatDayHeadline(now)}</p>
                <p className="mt-1 text-sm text-zinc-500">선택 날짜: {formatDayHeadline(selectedDate)}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowDayView(false)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              >
                닫기
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto">
              {eventsForSelectedDay.length > 0 ? (
                <div className="space-y-2">
                  {eventsForSelectedDay.map((event) => (
                    <div key={event.id} className="grid grid-cols-[110px_1fr] gap-3 rounded-xl border border-zinc-200 p-3">
                      <div className="text-sm font-medium text-zinc-700">{formatTimeRange(event)}</div>
                      <div className="text-sm font-semibold" style={{ color: event.color }}>
                        {event.title}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">등록된 일정이 없습니다.</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => openCreateView(selectedDate)}
              className="mt-4 rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white"
            >
              일정 생성
            </button>
          </div>
        </div>
      ) : null}

      {showCreateView ? (
        <div className="fixed inset-0 z-40 bg-white px-4 pb-6 pt-5">
          <div className="mx-auto flex h-full w-full max-w-md flex-col">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <p className="text-base font-semibold">일정 생성</p>
              <button
                type="button"
                onClick={() => setShowCreateView(false)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              >
                닫기
              </button>
            </div>

            <div className="mt-4 space-y-4 overflow-y-auto">
              <div>
                <label htmlFor="title" className="mb-1 block text-sm font-medium">
                  제목
                </label>
                <input
                  id="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="일정 제목"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">종일</span>
                  <button
                    type="button"
                    onClick={() => setAllDay((prev) => !prev)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      allDay ? "bg-zinc-900 text-white" : "border border-zinc-300 text-zinc-700"
                    }`}
                  >
                    {allDay ? "켜짐" : "꺼짐"}
                  </button>
                </div>

                {allDay ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={startDateInput}
                      onChange={(event) => setStartDateInput(event.target.value)}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="date"
                      value={endDateInput}
                      onChange={(event) => setEndDateInput(event.target.value)}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={startDateInput}
                        onChange={(event) => setStartDateInput(event.target.value)}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                      />
                      <input
                        type="time"
                        value={startTimeInput}
                        onChange={(event) => setStartTimeInput(event.target.value)}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={endDateInput}
                        onChange={(event) => setEndDateInput(event.target.value)}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                      />
                      <input
                        type="time"
                        value={endTimeInput}
                        onChange={(event) => setEndTimeInput(event.target.value)}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="color" className="mb-1 block text-sm font-medium">
                  일정 텍스트 색상
                </label>
                <div className="mb-2 flex gap-2">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setTextColor(color)}
                      className={`h-7 w-7 rounded-full border ${textColor === color ? "ring-2 ring-zinc-900" : ""}`}
                      style={{ backgroundColor: color }}
                      aria-label={`색상 ${color}`}
                    />
                  ))}
                </div>
                <input
                  id="color"
                  type="color"
                  value={textColor}
                  onChange={(event) => setTextColor(event.target.value)}
                  className="h-10 w-full rounded-lg border border-zinc-300"
                />
              </div>

              <div>
                <label htmlFor="repeat" className="mb-1 block text-sm font-medium">
                  반복 기능
                </label>
                <select
                  id="repeat"
                  value={repeat}
                  onChange={(event) => setRepeat(event.target.value as RepeatOption)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="yearly">매년</option>
                  <option value="monthly">매월</option>
                  <option value="weekly">매주</option>
                  <option value="daily">매일</option>
                  <option value="none">반복 안 함</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={saveSchedule}
              className="mt-4 rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white"
            >
              저장하기
            </button>
          </div>
        </div>
      ) : null}
    </main>
  )
}
