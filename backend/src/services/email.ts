import type { User, Task, Reminder } from "@prisma/client";
import { gmailFor, getUserOAuthClient } from "../lib/google";

function buildHtml(task: Task, reminder: Reminder, recipient: User) {
  const due = task.dueAt ? new Date(task.dueAt).toLocaleString("id-ID") : "tidak ada deadline";
  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto">
    <h2 style="color:#0f172a">Reminder Tugas</h2>
    <p>Halo <strong>${recipient.name}</strong>,</p>
    <p>${reminder.message ?? "Ini pengingat untuk task berikut:"}</p>
    <table style="border-collapse:collapse;width:100%;margin-top:12px">
      <tr><td style="padding:8px;background:#f1f5f9"><b>Task</b></td><td style="padding:8px">${task.title}</td></tr>
      <tr><td style="padding:8px;background:#f1f5f9"><b>Status</b></td><td style="padding:8px">${task.status}</td></tr>
      <tr><td style="padding:8px;background:#f1f5f9"><b>Prioritas</b></td><td style="padding:8px">${task.priority}</td></tr>
      <tr><td style="padding:8px;background:#f1f5f9"><b>Divisi</b></td><td style="padding:8px">${task.division}</td></tr>
      <tr><td style="padding:8px;background:#f1f5f9"><b>Deadline</b></td><td style="padding:8px">${due}</td></tr>
    </table>
    <p style="margin-top:16px;color:#64748b;font-size:12px">Email otomatis dari Task Manager.</p>
  </div>`;
}

function encodeMessage(from: string, to: string, subject: string, html: string) {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
  ];
  return Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendReminderEmail(
  sender: User,
  recipient: User,
  task: Task,
  reminder: Reminder
) {
  const client = await getUserOAuthClient(sender);
  const gmail = gmailFor(client);
  const subject = `[Reminder] ${task.title}`;
  const html = buildHtml(task, reminder, recipient);
  const raw = encodeMessage(sender.email, recipient.email, subject, html);
  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
}
