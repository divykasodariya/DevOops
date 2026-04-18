import mongoose from 'mongoose';
import { Schedule } from '../models/Schedule.js';
import { Notification } from '../models/Notification.js';

const SCHEDULE_TYPES = ['class', 'exam', 'event', 'room_booking', 'club'];

const isOid = (v) =>
  mongoose.Types.ObjectId.isValid(v) && String(new mongoose.Types.ObjectId(v)) === String(v);

/** Map chatbot / loose client values to valid enum + safe refs */
function normalizeScheduleBody(body, userId) {
  let {
    title,
    type,
    course,
    room,
    location,
    department,
    start,
    end,
    audience,
    audienceIds,
  } = body;

  const rawType = String(type || '').toLowerCase().trim().replace(/-/g, '_');
  const typeAliases = {
    booking: 'room_booking',
    book: 'room_booking',
    reservation: 'room_booking',
    room: 'room_booking',
    room_booking: 'room_booking',
    study: 'room_booking',
  };
  let normType = typeAliases[rawType] || rawType;
  if (!SCHEDULE_TYPES.includes(normType)) {
    normType = room || location ? 'room_booking' : 'event';
  }

  if (!title || !String(title).trim()) {
    title = room ? `Booking — ${room}` : normType === 'class' ? 'Class session' : 'Campus booking';
  } else {
    title = String(title).trim();
  }

  if (!start || !end) {
    return { error: 'start and end are required (ISO 8601 datetime strings).' };
  }
  const startAt = new Date(start);
  const endAt = new Date(end);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return {
      error: 'Invalid start or end datetime. Use ISO 8601 (e.g. 2026-04-19T14:00:00.000Z).',
    };
  }
  if (endAt <= startAt) {
    return { error: 'end must be after start.' };
  }

  if (course != null && course !== '' && !isOid(course)) {
    course = undefined;
  }
  if (department != null && department !== '' && !isOid(department)) {
    department = undefined;
  }

  if (!audience || !String(audience).trim()) {
    if (normType === 'room_booking') audience = 'user';
    else if (normType === 'event') audience = 'all';
    else audience = 'course';
  }

  if (normType === 'room_booking') {
    if (!Array.isArray(audienceIds) || audienceIds.length === 0) {
      audienceIds = [userId];
    }
  }

  return {
    payload: {
      title,
      type: normType,
      course,
      room: room != null ? String(room).trim() : undefined,
      location: location != null ? String(location).trim() : undefined,
      department,
      start: startAt,
      end: endAt,
      audience,
      audienceIds,
    },
  };
}

// ─────────────────────────────────────────────
// POST /schedule — Create a schedule entry with clash detection
// ─────────────────────────────────────────────
export const createSchedule = async (req, res) => {
  try {
    const normalized = normalizeScheduleBody(req.body, req.user._id);
    if (normalized.error) {
      return res.status(400).json({ message: normalized.error });
    }

    const { title, type, course, room, location, department, start, end, audience, audienceIds } =
      normalized.payload;

    let clashConflicts = [];

    if (room) {
      const clashes = await Schedule.find({
        room,
        isActive: true,
        start: { $lt: end },
        end: { $gt: start },
      });

      clashConflicts = clashes.map((clash) => ({
        conflictingScheduleId: clash._id,
        reason: 'same room',
      }));
    }

    const schedule = await Schedule.create({
      title,
      type,
      course,
      room,
      location,
      department,
      start,
      end,
      audience,
      audienceIds,
      clashChecked: true,
      clashConflicts,
      createdBy: req.user._id,
    });

    if (clashConflicts.length > 0) {
      await Notification.create({
        recipient: req.user._id,
        title: 'Schedule clash detected',
        body: `${room} is already booked during your requested time (${clashConflicts.length} conflict${clashConflicts.length > 1 ? 's' : ''}).`,
        type: 'schedule_alert',
        refModel: 'Schedule',
        refId: schedule._id,
      });

      return res.status(201).json({
        warning: `Room ${room} has ${clashConflicts.length} clash(es) during this time slot.`,
        clashes: clashConflicts,
        schedule,
      });
    }

    res.status(201).json({ schedule });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /schedule/my — Returns schedule entries relevant to the logged-in user
// ─────────────────────────────────────────────
export const getMySchedule = async (req, res) => {
  try {
    const userId = req.user._id;

    const schedules = await Schedule.find({
      isActive: true,
      $or: [
        { audience: 'all' },
        { audienceIds: userId },
        { createdBy: userId },
      ],
    })
      .populate('course', 'name code')
      .sort({ start: 1 });

    res.json(schedules);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /schedule/conflicts?room=LIB-A&start=ISO&end=ISO
// Preflight: overlapping active bookings for the same room (no DB write)
// ─────────────────────────────────────────────
export const checkRoomConflict = async (req, res) => {
  try {
    const { room, start, end } = req.query;

    if (!room || !start || !end) {
      return res.status(400).json({
        message: 'room, start, and end query params are required (ISO 8601 strings).',
      });
    }

    const startAt = new Date(start);
    const endAt = new Date(end);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      return res.status(400).json({ message: 'Invalid start or end date.' });
    }
    if (endAt <= startAt) {
      return res.json({ hasConflict: false, clashes: [], invalidRange: true });
    }

    const clashes = await Schedule.find({
      room: String(room),
      isActive: true,
      start: { $lt: endAt },
      end: { $gt: startAt },
    })
      .select('_id start end title type')
      .sort({ start: 1 })
      .limit(20)
      .lean();

    res.json({
      hasConflict: clashes.length > 0,
      clashes,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /schedule/slots?room=LH-301&date=2025-04-18
// Returns free 1-hour slots for a room on a given day (8am–6pm)
// ─────────────────────────────────────────────
export const getFreeSlots = async (req, res) => {
  try {
    const { room, date } = req.query;

    if (!room || !date) {
      return res.status(400).json({ message: 'room and date query params are required' });
    }

    const dateStr = String(date).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ message: 'date must be YYYY-MM-DD (e.g. 2026-04-19).' });
    }

    const dayStart = new Date(`${dateStr}T08:00:00`);
    const dayEnd = new Date(`${dateStr}T18:00:00`);
    if (Number.isNaN(dayStart.getTime()) || Number.isNaN(dayEnd.getTime())) {
      return res.status(400).json({ message: 'Invalid date.' });
    }

    const bookings = await Schedule.find({
      room,
      isActive: true,
      start: { $lt: dayEnd },
      end: { $gt: dayStart },
    }).sort({ start: 1 });

    const freeSlots = [];
    let cursor = dayStart.getTime();
    const slotDuration = 60 * 60 * 1000;

    while (cursor + slotDuration <= dayEnd.getTime()) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor + slotDuration);

      const isOccupied = bookings.some((b) => b.start < slotEnd && b.end > slotStart);

      if (!isOccupied) {
        freeSlots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          label: `${slotStart.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })} – ${slotEnd.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`,
        });
      }

      cursor += slotDuration;
    }

    res.json({
      room,
      date,
      totalFreeSlots: freeSlots.length,
      freeSlots,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
