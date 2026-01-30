/**
 * Task Service
 *
 * Abstraction for task management: creating tasks, reminders, and follow-ups.
 * V1 uses mock implementation; future versions can integrate with
 * Todoist, Asana, Linear, or other task management tools.
 *
 * @module @atlas/gateway/services/task-service
 */

import { v4 as uuid } from 'uuid';
import pino from 'pino';
import type {
  ServiceResult,
  ServiceConfig,
  ServiceHealth,
  TaskItem,
  TaskReminder,
} from './types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = (pino as any)({
  name: 'task-service',
  level: process.env.LOG_LEVEL || 'info',
});

/**
 * Task service interface
 */
export interface ITaskService {
  /**
   * Create a new task
   */
  createTask(task: Omit<TaskItem, 'id'>): Promise<ServiceResult<TaskItem>>;

  /**
   * Update an existing task
   */
  updateTask(taskId: string, updates: Partial<TaskItem>): Promise<ServiceResult<TaskItem>>;

  /**
   * Delete a task
   */
  deleteTask(taskId: string): Promise<ServiceResult>;

  /**
   * Get a task by ID
   */
  getTask(taskId: string): Promise<ServiceResult<TaskItem>>;

  /**
   * Create a reminder
   */
  createReminder(reminder: Omit<TaskReminder, 'id'>): Promise<ServiceResult<TaskReminder>>;

  /**
   * Delete a reminder
   */
  deleteReminder(reminderId: string): Promise<ServiceResult>;

  /**
   * Get service health status
   */
  getHealth(): Promise<ServiceHealth>;
}

/**
 * Mock task service for V1 development
 * Simulates task operations without actual task manager access
 */
class MockTaskService implements ITaskService {
  private tasks: Map<string, TaskItem> = new Map();
  private reminders: Map<string, TaskReminder> = new Map();

  async createTask(taskData: Omit<TaskItem, 'id'>): Promise<ServiceResult<TaskItem>> {
    const taskId = `mock_task_${uuid()}`;
    const task: TaskItem = {
      id: taskId,
      status: 'pending',
      priority: 'medium',
      ...taskData,
    };

    log.info({
      action: 'create_task',
      taskId,
      title: task.title,
      priority: task.priority,
      dueDate: task.dueDate,
      mock: true,
    });

    this.tasks.set(taskId, task);

    return {
      success: true,
      data: task,
    };
  }

  async updateTask(taskId: string, updates: Partial<TaskItem>): Promise<ServiceResult<TaskItem>> {
    const task = this.tasks.get(taskId);

    if (!task) {
      return {
        success: false,
        error: 'Task not found',
        errorCode: 'TASK_NOT_FOUND',
      };
    }

    const updatedTask: TaskItem = { ...task, ...updates, id: taskId };

    log.info({
      action: 'update_task',
      taskId,
      updates: Object.keys(updates),
      mock: true,
    });

    this.tasks.set(taskId, updatedTask);

    return {
      success: true,
      data: updatedTask,
    };
  }

  async deleteTask(taskId: string): Promise<ServiceResult> {
    if (!this.tasks.has(taskId)) {
      return {
        success: false,
        error: 'Task not found',
        errorCode: 'TASK_NOT_FOUND',
      };
    }

    log.info({
      action: 'delete_task',
      taskId,
      mock: true,
    });

    this.tasks.delete(taskId);

    return { success: true };
  }

  async getTask(taskId: string): Promise<ServiceResult<TaskItem>> {
    const task = this.tasks.get(taskId);

    if (!task) {
      return {
        success: false,
        error: 'Task not found',
        errorCode: 'TASK_NOT_FOUND',
      };
    }

    return {
      success: true,
      data: task,
    };
  }

  async createReminder(reminderData: Omit<TaskReminder, 'id'>): Promise<ServiceResult<TaskReminder>> {
    const reminderId = `mock_reminder_${uuid()}`;
    const reminder: TaskReminder = {
      id: reminderId,
      ...reminderData,
    };

    log.info({
      action: 'create_reminder',
      reminderId,
      title: reminder.title,
      remindAt: reminder.remindAt,
      taskId: reminder.taskId,
      mock: true,
    });

    this.reminders.set(reminderId, reminder);

    return {
      success: true,
      data: reminder,
    };
  }

  async deleteReminder(reminderId: string): Promise<ServiceResult> {
    if (!this.reminders.has(reminderId)) {
      return {
        success: false,
        error: 'Reminder not found',
        errorCode: 'REMINDER_NOT_FOUND',
      };
    }

    log.info({
      action: 'delete_reminder',
      reminderId,
      mock: true,
    });

    this.reminders.delete(reminderId);

    return { success: true };
  }

  async getHealth(): Promise<ServiceHealth> {
    return {
      service: 'task',
      status: 'healthy',
      lastCheck: new Date().toISOString(),
      latencyMs: 6, // Mock latency
    };
  }
}

/**
 * Todoist API implementation placeholder
 * TODO: Implement when ready for real Todoist integration
 */
// class TodoistTaskService implements ITaskService { ... }

/**
 * Get task service instance
 */
let taskServiceInstance: ITaskService | null = null;

export function getTaskService(config?: ServiceConfig): ITaskService {
  if (!taskServiceInstance) {
    // For V1, always use mock service
    taskServiceInstance = new MockTaskService();
    log.info('Task service initialized (mock mode)');
  }
  return taskServiceInstance;
}

/**
 * Reset task service (for testing)
 */
export function resetTaskService(): void {
  taskServiceInstance = null;
}
