export type Role =
  | "ADMIN_PROJECT"
  | "NETWORK_ENGINEER"
  | "NETWORK_SECURITY_ENGINEER"
  | "SYSTEM_ENGINEER"
  | "SAFETY_DRIVER";

export type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "REVIEW"
  | "DONE"
  | "CANCELLED";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ProjectStatus =
  | "PLANNING"
  | "ACTIVE"
  | "ON_HOLD"
  | "COMPLETED"
  | "ARCHIVED";

export type ReminderChannel = "EMAIL" | "CALENDAR" | "BOTH";
export type ReminderStatus = "PENDING" | "SENT" | "FAILED" | "CANCELLED";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
  hasGoogleConnection?: boolean;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  status: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
  progress: number;
  ownerId: string;
  owner?: { id: string; name: string; email: string };
  _count?: { tasks: number; members: number };
  members?: { user: User; role: Role }[];
  tasks?: Task[];
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  division: Role;
  progress: number;
  startAt?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
  assignee?: User | null;
  project?: { id: string; name: string; code: string };
  _count?: { updates: number; reminders: number };
}

export interface TaskUpdate {
  id: string;
  taskId: string;
  note: string;
  progress?: number | null;
  status?: TaskStatus | null;
  createdAt: string;
  author: { id: string; name: string; avatarUrl?: string | null };
}

export interface Reminder {
  id: string;
  taskId: string;
  userId: string;
  remindAt: string;
  channel: ReminderChannel;
  status: ReminderStatus;
  message?: string | null;
  task?: { id: string; title: string };
  user?: { id: string; name: string; email: string };
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  isDone: boolean;
  assigneeId?: string | null;
  dueAt?: string | null;
  position: number;
  completedAt?: string | null;
  assignee?: { id: string; name: string; avatarUrl?: string | null } | null;
  createdAt: string;
}

export interface Attachment {
  id: string;
  taskId: string;
  uploaderId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
  uploader?: { id: string; name: string; avatarUrl?: string | null };
}

export type ActivityType =
  | "PROJECT_CREATED"
  | "PROJECT_UPDATED"
  | "MEMBER_ADDED"
  | "MEMBER_REMOVED"
  | "TASK_CREATED"
  | "TASK_UPDATED"
  | "TASK_STATUS_CHANGED"
  | "TASK_ASSIGNED"
  | "TASK_DELETED"
  | "SUBTASK_CREATED"
  | "SUBTASK_COMPLETED"
  | "SUBTASK_DELETED"
  | "ATTACHMENT_UPLOADED"
  | "ATTACHMENT_DELETED"
  | "COMMENT_ADDED"
  | "REMINDER_CREATED"
  | "REMINDER_SENT";

export interface ActivityLog {
  id: string;
  type: ActivityType;
  message: string;
  createdAt: string;
  actor: { id: string; name: string; avatarUrl?: string | null };
  project?: { id: string; name: string; code: string } | null;
  task?: { id: string; title: string } | null;
}

export type NotificationType =
  | "MENTION"
  | "CHAT_MESSAGE"
  | "TASK_ASSIGNED"
  | "TASK_STATUS_CHANGED"
  | "TASK_DUE_SOON"
  | "REMINDER"
  | "PROJECT_INVITE";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  projectId: string;
  authorId: string;
  body: string;
  embedTaskId?: string | null;
  isPinned: boolean;
  pinnedAt?: string | null;
  pinnedById?: string | null;
  editedAt?: string | null;
  createdAt: string;
  author: { id: string; name: string; avatarUrl?: string | null };
  embedTask?: {
    id: string;
    title: string;
    status: TaskStatus;
    progress: number;
  } | null;
  mentions?: { user: { id: string; name: string } }[];
}
