export type DateString = string;

export type TodoStatus = "open" | "done";

export type TodoDuration = 15 | 30 | 60;

export type TodoId = string;

export type CategoryId = string;

export type MinuteOfDay = number;

export type Todo = {
  id: TodoId;
  name: string;
  date: DateString;
  status: TodoStatus;
  order: number;
  createdAt: string;
  updatedAt: string;
  categoryId?: CategoryId;
  emoji?: string;
  scheduledTime?: MinuteOfDay;
  duration?: TodoDuration;
  completedAt?: string;
  deletedAt?: string;
};

export type Category = {
  id: CategoryId;
  name: string;
  createdAt: string;
  updatedAt: string;
  color?: string;
  emoji?: string;
};
