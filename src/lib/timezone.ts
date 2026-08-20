const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

export function getCurrentISTDate(): string {
  const now = new Date()
  const istTime = new Date(now.getTime() + IST_OFFSET_MS)
  return istTime.toISOString().split('T')[0]
}

export function formatISTHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

export function formatISTHourRange(openHour: number, closeHour: number): string {
  if (closeHour === 0 || closeHour === 24) {
    return `${formatISTHour(openHour)} — 00:00`
  }
  return `${formatISTHour(openHour)} — ${formatISTHour(closeHour)}`
}

export function istHourToUTCDate(istHour: number, istDateStr: string): Date {
  const dateObj = new Date(istDateStr + 'T00:00:00.000Z')
  const utcHour = istHour - 6
  const utcMinutes = 30
  dateObj.setUTCHours(utcHour, utcMinutes, 0, 0)
  return dateObj
}

export function getISTHourFromUTC(date: Date): number {
  const istTime = new Date(date.getTime() + IST_OFFSET_MS)
  return istTime.getUTCHours()
}

export function toISTDisplay(date: Date): { dateStr: string; timeStr: string } {
  const istTime = new Date(date.getTime() + IST_OFFSET_MS)
  const year = istTime.getUTCFullYear()
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(istTime.getUTCDate()).padStart(2, '0')
  const hour = istTime.getUTCHours()
  const minute = istTime.getUTCMinutes()

  const dateStr = `${year}-${month}-${day}`
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

  return { dateStr, timeStr }
}

export function toISTDateString(date: Date): string {
  const istTime = new Date(date.getTime() + IST_OFFSET_MS)
  const year = istTime.getUTCFullYear()
  const month = istTime.getUTCMonth()
  const day = istTime.getUTCDate()

  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ]
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const tempDate = new Date(Date.UTC(year, month, day))
  const weekday = weekdays[tempDate.getUTCDay()]

  return `${weekday}, ${months[month]} ${day}`
}

export function toISTTimeRange(start: Date, end: Date): string {
  const startIST = toISTDisplay(start)
  const endIST = toISTDisplay(end)
  return `${startIST.timeStr} — ${endIST.timeStr}`
}

export function generateISTSlots(
  openHour: number,
  closeHour: number,
  slotMinutes: number,
  dateStr: string
): Array<{ startTime: string; endTime: string }> {
  const slots: Array<{ startTime: string; endTime: string }> = []

  let currentISTHour = openHour
  let currentISTMinute = 0

  const shouldContinue = () => {
    if (closeHour === 0 || closeHour === 24) {
      const totalOpenMinutes = (24 - openHour) * 60
      const totalCurrentMinutes = currentISTHour * 60 + currentISTMinute - openHour * 60
      return totalCurrentMinutes < totalOpenMinutes
    }
    const currentTotal = currentISTHour * 60 + currentISTMinute
    const closeTotal = closeHour * 60
    return currentTotal < closeTotal
  }

  while (shouldContinue()) {
    const slotStartIST = istHourToUTCDate(currentISTHour, dateStr)
    slotStartIST.setUTCMinutes(slotStartIST.getUTCMinutes() + currentISTMinute)

    const slotEndIST = new Date(slotStartIST.getTime() + slotMinutes * 60 * 1000)

    slots.push({
      startTime: slotStartIST.toISOString(),
      endTime: slotEndIST.toISOString()
    })

    currentISTMinute += slotMinutes
    if (currentISTMinute >= 60) {
      currentISTHour += Math.floor(currentISTMinute / 60)
      currentISTMinute = currentISTMinute % 60
    }
  }

  return slots
}
