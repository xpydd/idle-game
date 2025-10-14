import { prisma } from '../db/prisma.js';
import { TaskType, ResetType } from '@prisma/client';
import { walletService } from './wallet.service.js';
import logger from '../utils/logger.js';

/**
 * 任务条件类型
 */
interface TaskCondition {
  type: 'afk_duration' | 'pet_count' | 'fusion_count' | 'shop_purchase' | 'login_days';
  target: number;
}

/**
 * 任务奖励类型
 */
interface TaskReward {
  type: 'gem' | 'shell' | 'energy' | 'pet_egg';
  amount: number;
  rarity?: string;
}

/**
 * 任务服务
 */
class TaskService {
  /**
   * 获取用户任务列表
   */
  async getUserTasks(userId: string): Promise<any[]> {
    try {
      // 获取所有激活的任务
      const tasks = await prisma.task.findMany({
        where: {
          isActive: true
        },
        include: {
          userTasks: {
            where: {
              userId
            }
          }
        },
        orderBy: [
          { type: 'asc' },
          { createdAt: 'asc' }
        ]
      });

      // 格式化任务数据
      return tasks.map(task => {
        const userTask = task.userTasks[0];
        const condition = task.condition as TaskCondition;
        const rewards = task.rewards as TaskReward[];

        return {
          id: task.id,
          type: task.type,
          name: task.name,
          description: task.description,
          condition,
          rewards,
          resetType: task.resetType,
          progress: userTask?.progress || 0,
          target: condition.target,
          completed: userTask?.completed || false,
          claimed: userTask?.claimed || false,
          userTaskId: userTask?.id
        };
      });
    } catch (error: any) {
      logger.error('获取用户任务列表失败', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * 更新任务进度
   */
  async updateTaskProgress(
    userId: string,
    conditionType: string,
    increment: number = 1
  ): Promise<void> {
    try {
      // 查找匹配条件类型的任务
      const tasks = await prisma.task.findMany({
        where: {
          isActive: true,
          condition: {
            path: ['type'],
            equals: conditionType
          }
        }
      });

      for (const task of tasks) {
        // 查找或创建用户任务记录
        let userTask = await prisma.userTask.findFirst({
          where: {
            userId,
            taskId: task.id
          }
        });

        if (!userTask) {
          userTask = await prisma.userTask.create({
            data: {
              userId,
              taskId: task.id,
              progress: 0,
              completed: false,
              claimed: false
            }
          });
        }

        // 如果已完成，跳过
        if (userTask.completed) {
          continue;
        }

        // 更新进度
        const condition = task.condition as TaskCondition;
        const newProgress = userTask.progress + increment;
        const isCompleted = newProgress >= condition.target;

        await prisma.userTask.update({
          where: {
            id: userTask.id
          },
          data: {
            progress: newProgress,
            completed: isCompleted
          }
        });

        if (isCompleted) {
          logger.info(`任务完成：userId=${userId}, taskId=${task.id}, name=${task.name}`);
        }
      }
    } catch (error: any) {
      logger.error('更新任务进度失败', { error: error.message, userId, conditionType });
      throw error;
    }
  }

  /**
   * 领取任务奖励
   */
  async claimTaskReward(userId: string, userTaskId: string): Promise<{
    success: boolean;
    message: string;
    rewards?: TaskReward[];
  }> {
    try {
      // 查询用户任务记录
      const userTask = await prisma.userTask.findUnique({
        where: {
          id: userTaskId
        },
        include: {
          task: true
        }
      });

      if (!userTask) {
        return {
          success: false,
          message: '任务不存在'
        };
      }

      if (userTask.userId !== userId) {
        return {
          success: false,
          message: '无权领取此任务奖励'
        };
      }

      if (!userTask.completed) {
        return {
          success: false,
          message: '任务未完成'
        };
      }

      if (userTask.claimed) {
        return {
          success: false,
          message: '奖励已领取'
        };
      }

      // 发放奖励
      const rewards = userTask.task.rewards as TaskReward[];
      await prisma.$transaction(async (tx) => {
        // 标记为已领取
        await tx.userTask.update({
          where: {
            id: userTaskId
          },
          data: {
            claimed: true
          }
        });

        // 发放奖励
        for (const reward of rewards) {
          switch (reward.type) {
            case 'gem':
              await walletService.updateGems(
                userId,
                reward.amount,
                'EARN',
                '任务奖励',
                `完成任务：${userTask.task.name}`
              );
              break;

            case 'shell':
              await walletService.updateShells(
                userId,
                reward.amount,
                'EARN',
                '任务奖励',
                `完成任务：${userTask.task.name}`
              );
              break;

            case 'energy':
              await tx.wallet.update({
                where: { userId },
                data: {
                  energy: {
                    increment: reward.amount
                  }
                }
              });
              break;

            // 星宠蛋奖励
            case 'pet_egg': {
              const rarity = reward.rarity || 'COMMON';
              // 简化实现：直接创建一只对应稀有度的1级星宠，作为“开蛋”结果
              const pet = await tx.pet.create({
                data: {
                  userId,
                  rarity: rarity as any,
                  level: 1,
                  exp: 0,
                  name: `新生·${Math.random().toString(36).substring(2, 6)}`
                }
              });
              logger.info(`发放星宠蛋奖励：userId=${userId}, rarity=${rarity}, petId=${pet.id}`);
              break;
            }
          }
        }
      });

      logger.info(`任务奖励领取成功：userId=${userId}, taskId=${userTask.taskId}`);

      return {
        success: true,
        message: '奖励领取成功',
        rewards
      };
    } catch (error: any) {
      logger.error('领取任务奖励失败', { error: error.message, userId, userTaskId });
      throw error;
    }
  }

  /**
   * 重置每日任务
   */
  async resetDailyTasks(): Promise<void> {
    try {
      // 删除所有每日任务的进度记录
      const dailyTasks = await prisma.task.findMany({
        where: {
          type: TaskType.DAILY,
          isActive: true
        },
        select: {
          id: true
        }
      });

      const taskIds = dailyTasks.map(t => t.id);

      await prisma.userTask.deleteMany({
        where: {
          taskId: {
            in: taskIds
          }
        }
      });

      logger.info(`每日任务已重置，共${dailyTasks.length}个任务`);
    } catch (error: any) {
      logger.error('重置每日任务失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 初始化默认任务（仅首次运行）
   */
  async initializeTasks(): Promise<void> {
    try {
      const count = await prisma.task.count();
      if (count > 0) {
        logger.info('任务已初始化，跳过');
        return;
      }

      const tasks = [
        // 每日任务
        {
          type: TaskType.DAILY,
          name: '每日挂机',
          description: '累计挂机1小时',
          condition: {
            type: 'afk_duration',
            target: 3600 // 秒
          },
          rewards: [
            { type: 'gem', amount: 50 },
            { type: 'shell', amount: 100 }
          ],
          resetType: ResetType.DAILY
        },
        {
          type: TaskType.DAILY,
          name: '商城购物',
          description: '在商城兑换1次',
          condition: {
            type: 'shop_purchase',
            target: 1
          },
          rewards: [
            { type: 'shell', amount: 50 },
            { type: 'energy', amount: 10 }
          ],
          resetType: ResetType.DAILY
        },
        // 成就任务
        {
          type: TaskType.ACHIEVEMENT,
          name: '星宠收藏家',
          description: '拥有5只星宠',
          condition: {
            type: 'pet_count',
            target: 5
          },
          rewards: [
            { type: 'gem', amount: 200 },
            { type: 'shell', amount: 500 }
          ],
          resetType: ResetType.NEVER
        },
        {
          type: TaskType.ACHIEVEMENT,
          name: '融合大师',
          description: '成功融合3次',
          condition: {
            type: 'fusion_count',
            target: 3
          },
          rewards: [
            { type: 'gem', amount: 300 },
            { type: 'shell', amount: 1000 }
          ],
          resetType: ResetType.NEVER
        },
        // 新手任务
        {
          type: TaskType.NEWBIE,
          name: '新手挂机',
          description: '首次挂机30分钟',
          condition: {
            type: 'afk_duration',
            target: 1800
          },
          rewards: [
            { type: 'gem', amount: 100 },
            { type: 'shell', amount: 200 }
          ],
          resetType: ResetType.NEVER
        }
      ];

      await prisma.task.createMany({
        data: tasks as any
      });

      logger.info(`任务初始化完成，共${tasks.length}个任务`);
    } catch (error: any) {
      logger.error('初始化任务失败', { error: error.message });
      throw error;
    }
  }
}

export const taskService = new TaskService();

