import "dotenv/config";
import cron from "node-cron";
import { ReminderChannel, ReminderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendReminderEmail } from "../services/email";
import { upsertCalendarEvent } from "../services/calendar";

/**
 * Worker reminder: setiap 1 menit cek reminder PENDING yang remindAt <= now,
 * lalu kirim email + buat calendar event sesuai channel.
 */
async function tick() {
  const now = new Date();
  const due = await prisma.reminder.findMany({
    where: { status: ReminderStatus.PENDING, remindAt: { lte: now } },
    include: { task: true, user: true },
    take: 50,
  });

  if (due.length === 0) return;
  console.log(`[worker] ${new Date().toISOString()} processing ${due.length} reminder(s)`);

  for (const r of due) {
    const recipient = r.user;
    const task = r.task;

    let calendarEventId: string | null = r.googleCalendarEventId;
    let errorMsg: string | null = null;
    let success = true;

    try {
      if (r.channel === ReminderChannel.EMAIL || r.channel === ReminderChannel.BOTH) {
        // Pakai recipient itu sendiri sebagai sender (kirim dari Gmail-nya)
        await sendReminderEmail(recipient, recipient, task, r);
      }
    } catch (err) {
      success = false;
      errorMsg = `email: ${(err as Error).message}`;
      console.error("[worker] email error", err);
    }

    try {
      if (r.channel === ReminderChannel.CALENDAR || r.channel === ReminderChannel.BOTH) {
        calendarEventId = await upsertCalendarEvent(recipient, task, r);
      }
    } catch (err) {
      success = false;
      errorMsg = (errorMsg ? errorMsg + " | " : "") + `calendar: ${(err as Error).message}`;
      console.error("[worker] calendar error", err);
    }

    await prisma.reminder.update({
      where: { id: r.id },
      data: {
        status: success ? ReminderStatus.SENT : ReminderStatus.FAILED,
        sentAt: success ? new Date() : null,
        errorMessage: errorMsg,
        googleCalendarEventId: calendarEventId,
      },
    });
  }
}

console.log("[worker] reminder worker started; ticking every minute");
cron.schedule("* * * * *", () => {
  tick().catch((err) => console.error("[worker] tick error", err));
});

// Jalankan sekali di awal supaya tidak menunggu satu menit penuh.
tick().catch((err) => console.error("[worker] initial tick error", err));
