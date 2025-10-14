import { prisma } from '../db/prisma.js';
import { FriendshipStatus, TransactionType } from '@prisma/client';
import logger from '../utils/logger.js';
import crypto from 'crypto';

/**
 * 社交系统服务
 */
class SocialService {
  // 每日助力次数限制
  private readonly MAX_DAILY_ASSISTS = 3;
  // 助力能量奖励
  private readonly ASSIST_ENERGY_REWARD = 5;
  // 邀请奖励（宝石）
  private readonly INVITE_REWARD_GEM = 100;

  /**
   * 生成唯一邀请码
   */
  private generateInviteCode(): string {
    // 生成6位随机码
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  /**
   * 为用户生成邀请码（如果还没有）
   */
  async ensureInviteCode(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { inviteCode: true },
    });

    if (user?.inviteCode) {
      return user.inviteCode;
    }

    // 生成新的邀请码，确保唯一性
    let inviteCode = this.generateInviteCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.user.findUnique({
        where: { inviteCode },
      });

      if (!existing) break;

      inviteCode = this.generateInviteCode();
      attempts++;
    }

    if (attempts >= 10) {
      throw new Error('生成邀请码失败，请稍后重试');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { inviteCode },
    });

    return inviteCode;
  }

  /**
   * 搜索用户（通过手机号或邀请码）
   */
  async searchUser(query: string) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: query },
          { inviteCode: query },
        ],
      },
      select: {
        id: true,
        phone: true,
        nickname: true,
        inviteCode: true,
        createdAt: true,
      },
    });

    if (!user) {
      return null;
    }

    // 隐藏部分手机号
    const maskedPhone = user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');

    return {
      ...user,
      phone: maskedPhone,
    };
  }

  /**
   * 发送好友请求
   */
  async sendFriendRequest(userId: string, friendId: string) {
    if (userId === friendId) {
      throw new Error('不能添加自己为好友');
    }

    // 检查是否已经是好友或已发送请求
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === FriendshipStatus.ACCEPTED) {
        throw new Error('已经是好友关系');
      } else if (existing.status === FriendshipStatus.PENDING) {
        throw new Error('已发送过好友请求');
      } else if (existing.status === FriendshipStatus.BLOCKED) {
        throw new Error('无法添加该用户');
      }
    }

    const friendship = await prisma.friendship.create({
      data: {
        userId,
        friendId,
        status: FriendshipStatus.PENDING,
      },
    });

    logger.info(`用户发送好友请求: ${userId} -> ${friendId}`);

    return friendship;
  }

  /**
   * 接受好友请求
   */
  async acceptFriendRequest(userId: string, friendshipId: string) {
    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      throw new Error('好友请求不存在');
    }

    if (friendship.friendId !== userId) {
      throw new Error('无权接受该请求');
    }

    if (friendship.status !== FriendshipStatus.PENDING) {
      throw new Error('该请求已处理');
    }

    const updated = await prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: FriendshipStatus.ACCEPTED },
    });

    logger.info(`用户接受好友请求: ${friendshipId}`);

    return updated;
  }

  /**
   * 拒绝好友请求
   */
  async rejectFriendRequest(userId: string, friendshipId: string) {
    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      throw new Error('好友请求不存在');
    }

    if (friendship.friendId !== userId) {
      throw new Error('无权拒绝该请求');
    }

    await prisma.friendship.delete({
      where: { id: friendshipId },
    });

    logger.info(`用户拒绝好友请求: ${friendshipId}`);

    return { success: true };
  }

  /**
   * 删除好友
   */
  async removeFriend(userId: string, friendId: string) {
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId, friendId, status: FriendshipStatus.ACCEPTED },
          { userId: friendId, friendId: userId, status: FriendshipStatus.ACCEPTED },
        ],
      },
    });

    if (!friendship) {
      throw new Error('好友关系不存在');
    }

    await prisma.friendship.delete({
      where: { id: friendship.id },
    });

    logger.info(`用户删除好友: ${userId} <-> ${friendId}`);

    return { success: true };
  }

  /**
   * 获取好友列表
   */
  async getFriendList(userId: string) {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId, status: FriendshipStatus.ACCEPTED },
          { friendId: userId, status: FriendshipStatus.ACCEPTED },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            nickname: true,
            inviteCode: true,
            createdAt: true,
          },
        },
        friend: {
          select: {
            id: true,
            phone: true,
            nickname: true,
            inviteCode: true,
            createdAt: true,
          },
        },
      },
    });

    return friendships.map((f) => {
      const friend = f.userId === userId ? f.friend : f.user;
      const maskedPhone = friend.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');

      return {
        friendshipId: f.id,
        friendId: friend.id,
        nickname: friend.nickname || maskedPhone,
        phone: maskedPhone,
        inviteCode: friend.inviteCode,
        friendSince: f.createdAt,
      };
    });
  }

  /**
   * 获取待处理的好友请求
   */
  async getPendingRequests(userId: string) {
    const requests = await prisma.friendship.findMany({
      where: {
        friendId: userId,
        status: FriendshipStatus.PENDING,
      },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            nickname: true,
            inviteCode: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return requests.map((r) => {
      const maskedPhone = r.user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');

      return {
        requestId: r.id,
        userId: r.user.id,
        nickname: r.user.nickname || maskedPhone,
        phone: maskedPhone,
        inviteCode: r.user.inviteCode,
        requestTime: r.createdAt,
      };
    });
  }

  /**
   * 助力好友（每日限3次）
   */
  async assistFriend(userId: string, friendId: string) {
    if (userId === friendId) {
      throw new Error('不能助力自己');
    }

    // 检查是否是好友
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId, friendId, status: FriendshipStatus.ACCEPTED },
          { userId: friendId, friendId: userId, status: FriendshipStatus.ACCEPTED },
        ],
      },
    });

    if (!friendship) {
      throw new Error('只能助力好友');
    }

    // 检查今日助力次数
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayAssists = await prisma.assistLog.count({
      where: {
        assisterId: userId,
        createdAt: {
          gte: today,
        },
      },
    });

    if (todayAssists >= this.MAX_DAILY_ASSISTS) {
      throw new Error(`每日最多助力${this.MAX_DAILY_ASSISTS}次`);
    }

    // 检查今天是否已经助力过该好友
    const alreadyAssisted = await prisma.assistLog.findFirst({
      where: {
        assisterId: userId,
        userId: friendId,
        createdAt: {
          gte: today,
        },
      },
    });

    if (alreadyAssisted) {
      throw new Error('今日已助力过该好友');
    }

    // 使用事务处理助力
    const result = await prisma.$transaction(async (tx) => {
      // 给被助力者增加能量
      await tx.wallet.update({
        where: { userId: friendId },
        data: {
          energy: {
            increment: this.ASSIST_ENERGY_REWARD,
          },
        },
      });

      // 记录能量变动
      await tx.energyLedger.create({
        data: {
          userId: friendId,
          amount: this.ASSIST_ENERGY_REWARD,
          source: 'ASSIST',
          target: `好友助力`,
        },
      });

      // 创建助力记录
      const assistLog = await tx.assistLog.create({
        data: {
          userId: friendId,
          assisterId: userId,
          energyGain: this.ASSIST_ENERGY_REWARD,
        },
      });

      // 助力者也获得少量能量奖励
      await tx.wallet.update({
        where: { userId },
        data: {
          energy: {
            increment: 2,
          },
        },
      });

      await tx.energyLedger.create({
        data: {
          userId,
          amount: 2,
          source: 'ASSIST',
          target: `助力好友奖励`,
        },
      });

      return assistLog;
    });

    logger.info(`用户助力好友: ${userId} -> ${friendId}`);

    return {
      success: true,
      energyGain: this.ASSIST_ENERGY_REWARD,
      remainingAssists: this.MAX_DAILY_ASSISTS - todayAssists - 1,
    };
  }

  /**
   * 获取今日助力次数
   */
  async getTodayAssistCount(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await prisma.assistLog.count({
      where: {
        assisterId: userId,
        createdAt: {
          gte: today,
        },
      },
    });

    return count;
  }

  /**
   * 绑定邀请码
   */
  async bindInviteCode(userId: string, code: string) {
    // 检查用户是否已经绑定过邀请码
    const existingInvitation = await prisma.invitation.findUnique({
      where: { inviteeId: userId },
    });

    if (existingInvitation) {
      throw new Error('已经绑定过邀请码');
    }

    // 查找邀请者
    const inviter = await prisma.user.findUnique({
      where: { inviteCode: code },
    });

    if (!inviter) {
      throw new Error('邀请码不存在');
    }

    if (inviter.id === userId) {
      throw new Error('不能使用自己的邀请码');
    }

    // 使用事务处理绑定和奖励
    const result = await prisma.$transaction(async (tx) => {
      // 创建邀请记录
      const invitation = await tx.invitation.create({
        data: {
          inviterId: inviter.id,
          inviteeId: userId,
          code,
          gemReward: this.INVITE_REWARD_GEM,
        },
      });

      // 给邀请者发放奖励
      await tx.wallet.update({
        where: { userId: inviter.id },
        data: {
          gemBalance: {
            increment: this.INVITE_REWARD_GEM,
          },
        },
      });

      await tx.transaction.create({
        data: {
          userId: inviter.id,
          type: TransactionType.EARN,
          amount: this.INVITE_REWARD_GEM,
          currency: 'GEM',
          source: '邀请奖励',
          description: `成功邀请新用户`,
        },
      });

      // 给被邀请者也发放少量奖励
      await tx.wallet.update({
        where: { userId },
        data: {
          gemBalance: {
            increment: 50,
          },
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.EARN,
          amount: 50,
          currency: 'GEM',
          source: '新人奖励',
          description: `使用邀请码注册`,
        },
      });

      return invitation;
    });

    logger.info(`用户绑定邀请码: ${userId} <- ${inviter.id}`);

    return {
      success: true,
      inviterReward: this.INVITE_REWARD_GEM,
      inviteeReward: 50,
    };
  }

  /**
   * 获取邀请记录
   */
  async getInvitationRecords(userId: string) {
    const invitations = await prisma.invitation.findMany({
      where: {
        inviterId: userId,
      },
      include: {
        invitee: {
          select: {
            id: true,
            phone: true,
            nickname: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    return invitations.map((inv) => {
      const maskedPhone = inv.invitee.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');

      return {
        invitationId: inv.id,
        inviteeNickname: inv.invitee.nickname || maskedPhone,
        inviteePhone: maskedPhone,
        gemReward: inv.gemReward,
        invitedAt: inv.timestamp,
      };
    });
  }

  /**
   * 获取邀请统计
   */
  async getInvitationStats(userId: string) {
    const count = await prisma.invitation.count({
      where: { inviterId: userId },
    });

    const totalRewards = await prisma.invitation.aggregate({
      where: { inviterId: userId },
      _sum: {
        gemReward: true,
      },
    });

    return {
      inviteCount: count,
      totalGemRewards: totalRewards._sum.gemReward || 0,
      inviteCode: await this.ensureInviteCode(userId),
    };
  }
}

export const socialService = new SocialService();

