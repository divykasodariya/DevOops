import { Schedule } from '../models/Schedule.js';
import { Notification } from '../models/Notification.js';

// ─────────────────────────────────────────────
// POST /schedule — Create a schedule entry with clash detection
// ─────────────────────────────────────────────
export const createSchedule = async (req, res) => {
  try {
    const { title, type, course, room, location, department, start, end, audience, audienceIds } = req.body;

    // Run clash detection query BEFORE saving
    let clashConflicts = [];

    if (room) {
      const clashes = await Schedule.find({
        room,
        isActive: true,
        start: { $lt: new Date(end) },
        end: { $gt: new Date(start) },
      });

      clashConflicts = clashes.map(clash => ({
        conflictingScheduleId: clash._id,
        reason: 'same room',
      }));
    }

    // Save anyway — let the user decide
    const schedule = await Schedule.create({
      title,
      type,
      course,
      room,
      location,
      department,
      start: new Date(start),
      end: new Date(end),
      audience,
      audienceIds,
      clashChecked: true,
      clashConflicts,
      createdBy: req.user._id,
    });

    // If clashes exist, return a warning alongside the saved document
    if (clashConflicts.length > 0) {
      // Notify the creator about the clash
      await Notification.create({
        recipient: req.user._id,
        title: '⚠️ Schedule Clash Detected',
        body: `${room} is already booked during your requested time (${clashConflicts.length} conflict${clashConflicts.length > 1 ? 's' : ''}).`,
        type: 'schedule_alert',
        refModel: 'Schedule',
        refId: schedule._id,
      });

      return res.status(201).json({
        warning: `⚠️ Room ${room} has ${clashConflicts.length} clash(es) during this time slot.`,
        clashes: clashConflicts,
        schedule,
      });
    }

    res.status(201).json({ schedule });
  } catch (error) {
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
// GET /schedule/slots?room=LH-301&date=2025-04-18
// Returns free 1-hour slots for a room on a given day (8am–6pm)
// ─────────────────────────────────────────────
export const getFreeSlots = async (req, res) => {
  try {
    const { room, date } = req.query;

    if (!room || !date) {
      return res.status(400).json({ message: 'room and date query params are required' });
    }

    // Build the day boundaries: 8am to 6pm
    const dayStart = new Date(`${date}T08:00:00`);
    const dayEnd = new Date(`${date}T18:00:00`);

    // Get all bookings for this room on this day
    const bookings = await Schedule.find({
      room,
      isActive: true,
      start: { $lt: dayEnd },
      end: { $gt: dayStart },
    }).sort({ start: 1 });

    // Gap-finding logic: walk from 8am to 6pm in 1-hour increments
    const freeSlots = [];
    let cursor = dayStart.getTime();
    const slotDuration = 60 * 60 * 1000; // 1 hour in ms

    while (cursor + slotDuration <= dayEnd.getTime()) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor + slotDuration);

      // Check if this slot overlaps any existing booking
      const isOccupied = bookings.some(
        b => b.start < slotEnd && b.end > slotStart
      );

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
