import type { User, Task, Reminder } from "@prisma/client";
import { calendarFor, getUserOAuthClient } from "../lib/google";

/**
 * Buat (atau update) event di Google Calendar primary user.
 * Mengembalikan eventId untuk disimpan di reminder.
 */
export async function upsertCalendarEvent(
  recipient: User,
  task: Task,
  reminder: Reminder
): Promise<string | null> {
  const client = await getUserOAuthClient(recipient);
  const calendar = calendarFor(client);

  // Default durasi 30 menit; kalau ada task.dueAt, pakai itu, kalau tidak pakai remindAt.
  const start = reminder.remindAt;
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  const requestBody = {
    summary: `[Task] ${task.title}`,
    description:
      (reminder.message ? reminder.message + "\n\n" : "") +
      `Status: ${task.status}\nPrioritas: ${task.priority}\nDivisi: ${task.division}` +
      (task.dueAt ? `\nDeadline: ${new Date(task.dueAt).toLocaleString("id-ID")}` : ""),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 10 },
        { method: "email", minutes: 30 },
      ],
    },
  };

  if (reminder.googleCalendarEventId) {
    const res = await calendar.events.update({
      calendarId: "primary",
      eventId: reminder.googleCalendarEventId,
      requestBody,
    });
    return res.data.id ?? reminder.googleCalendarEventId;
  }

  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody,
  });
  return res.data.id ?? null;
}
