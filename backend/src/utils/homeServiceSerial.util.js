/**
 * Build available even-numbered serial slots for a given date.
 */
export const buildAvailableSerials = (serialSettings, bookedSerialNumbers) => {
  const totalSerials = serialSettings.totalSerialsPerDay;
  const availableSerials = [];

  const [startHour, startMin] = serialSettings.serialTimeRange.startTime.split(':').map(Number);
  const [endHour, endMin] = serialSettings.serialTimeRange.endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const totalMinutes = endMinutes - startMinutes;
  const slotDuration = Math.floor(totalMinutes / totalSerials);

  for (let i = 1; i <= totalSerials; i++) {
    if (i % 2 !== 0) continue;

    const slotMinutes = startMinutes + (i - 1) * slotDuration;
    const slotHour = Math.floor(slotMinutes / 60);
    const slotMin = slotMinutes % 60;
    const timeString = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;

    const endSlotMinutes = slotMinutes + slotDuration;
    const endSlotHour = Math.floor(endSlotMinutes / 60);
    const endSlotMin = endSlotMinutes % 60;
    const endTimeString = `${String(endSlotHour).padStart(2, '0')}:${String(endSlotMin).padStart(2, '0')}`;

    if (!bookedSerialNumbers.includes(i)) {
      availableSerials.push({
        serialNumber: i,
        time: timeString,
        endTime: endTimeString,
        available: true
      });
    }
  }

  return { availableSerials, slotDuration };
};

export const calculateSerialTimeSlot = (serialSettings, serialNumber) => {
  const [startHour, startMin] = serialSettings.serialTimeRange.startTime.split(':').map(Number);
  const [endHour, endMin] = serialSettings.serialTimeRange.endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const totalMinutes = endMinutes - startMinutes;
  const slotDuration = Math.floor(totalMinutes / serialSettings.totalSerialsPerDay);

  const slotMinutes = startMinutes + (serialNumber - 1) * slotDuration;
  const slotHour = Math.floor(slotMinutes / 60);
  const slotMin = slotMinutes % 60;
  const timeString = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;

  const endSlotMinutes = slotMinutes + slotDuration;
  const endSlotHour = Math.floor(endSlotMinutes / 60);
  const endSlotMin = endSlotMinutes % 60;
  const endTimeString = `${String(endSlotHour).padStart(2, '0')}:${String(endSlotMin).padStart(2, '0')}`;

  return { startTime: timeString, endTime: endTimeString };
};

/** Convert home service offDays to availableDays (inverse). */
export const offDaysToAvailableDays = (offDays = []) => {
  const allDays = [0, 1, 2, 3, 4, 5, 6];
  return allDays.filter((d) => !offDays.includes(d));
};

/** Summary for home service details / patient API. */
export const buildSerialBookingSummary = (serialSettings, homeService = null) => {
  if (!serialSettings) return null;

  let availableDays = serialSettings.availableDays;
  if (!availableDays?.length) {
    availableDays = offDaysToAvailableDays(homeService?.offDays || []);
  }
  if (!availableDays?.length) {
    availableDays = [0, 1, 2, 3, 4, 5, 6];
  }

  return {
    enabled: Boolean(serialSettings.isActive),
    totalSerialsPerDay: serialSettings.totalSerialsPerDay,
    evenSerialsPerDay: Math.floor(serialSettings.totalSerialsPerDay / 2),
    serialTimeRange: serialSettings.serialTimeRange,
    servicePrice: serialSettings.servicePrice,
    availableDays: [...availableDays].sort((a, b) => a - b)
  };
};
