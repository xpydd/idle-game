import crypto from 'crypto';
import { prisma } from '../db/prisma.js';
import { KYCStatus } from '@prisma/client';
import logger from '../utils/logger.js';

/**
 * 实名认证服务
 */
class KYCService {
  /**
   * 身份证号加密
   */
  private encryptIdCard(idCard: string): string {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.ENCRYPTION_KEY || 'your-32-character-secret-key!!', 'utf-8');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(idCard, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * 身份证号解密（仅用于验证）
   */
  private decryptIdCard(encrypted: string): string {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.ENCRYPTION_KEY || 'your-32-character-secret-key!!', 'utf-8');
    
    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * 验证身份证号格式
   */
  private validateIdCard(idCard: string): boolean {
    // 18位身份证号正则
    const idCardRegex = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
    return idCardRegex.test(idCard);
  }

  /**
   * 验证姓名格式
   */
  private validateRealName(name: string): boolean {
    // 中文姓名，2-20个字符
    const nameRegex = /^[\u4e00-\u9fa5·]{2,20}$/;
    return nameRegex.test(name);
  }

  /**
   * 模拟调用第三方实名认证API
   * 生产环境需要对接真实的实名认证服务商（如阿里云、腾讯云等）
   */
  private async callThirdPartyKYC(realName: string, idCard: string): Promise<{
    success: boolean;
    message: string;
  }> {
    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 500));

    // 模拟认证结果（实际应调用真实API）
    // 这里简单判断：如果身份证号末位是偶数则通过
    const lastDigit = idCard.slice(-1);
    const isEven = lastDigit !== 'X' && lastDigit !== 'x' && parseInt(lastDigit) % 2 === 0;

    if (isEven) {
      return {
        success: true,
        message: '实名认证成功'
      };
    } else {
      return {
        success: false,
        message: '身份信息不匹配，请检查后重试'
      };
    }
  }

  /**
   * 执行实名认证
   */
  async verifyIdentity(userId: string, realName: string, idCard: string): Promise<{
    success: boolean;
    message: string;
    kycStatus: KYCStatus;
  }> {
    try {
      // 检查用户是否存在
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      // 检查是否已经认证
      if (user.kycStatus === KYCStatus.VERIFIED) {
        return {
          success: false,
          message: '您已完成实名认证',
          kycStatus: KYCStatus.VERIFIED
        };
      }

      // 验证姓名格式
      if (!this.validateRealName(realName)) {
        return {
          success: false,
          message: '姓名格式不正确，请输入2-20个中文字符',
          kycStatus: user.kycStatus
        };
      }

      // 验证身份证格式
      if (!this.validateIdCard(idCard)) {
        return {
          success: false,
          message: '身份证号格式不正确',
          kycStatus: user.kycStatus
        };
      }

      // 调用第三方认证服务
      logger.info(`开始实名认证：userId=${userId}, realName=${realName}`);
      const kycResult = await this.callThirdPartyKYC(realName, idCard);

      // 加密身份证号
      const encryptedIdCard = this.encryptIdCard(idCard);

      // 更新用户认证状态
      const newStatus = kycResult.success ? KYCStatus.VERIFIED : KYCStatus.REJECTED;
      await prisma.user.update({
        where: { id: userId },
        data: {
          realName,
          idCard: encryptedIdCard,
          kycStatus: newStatus,
          updatedAt: new Date()
        }
      });

      logger.info(`实名认证结果：userId=${userId}, status=${newStatus}`);

      return {
        success: kycResult.success,
        message: kycResult.message,
        kycStatus: newStatus
      };
    } catch (error: any) {
      logger.error('实名认证失败', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * 检查用户认证状态
   */
  async checkKYCStatus(userId: string): Promise<KYCStatus> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true }
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    return user.kycStatus;
  }

  /**
   * 获取用户认证信息（脱敏）
   */
  async getKYCInfo(userId: string): Promise<{
    kycStatus: KYCStatus;
    realName?: string;
    idCardMasked?: string;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        kycStatus: true,
        realName: true,
        idCard: true
      }
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    const result: any = {
      kycStatus: user.kycStatus
    };

    // 如果已认证，返回脱敏信息
    if (user.kycStatus === KYCStatus.VERIFIED && user.realName && user.idCard) {
      result.realName = user.realName.charAt(0) + '*'.repeat(user.realName.length - 1);
      
      // 身份证脱敏：显示前6位和后4位
      try {
        const decryptedIdCard = this.decryptIdCard(user.idCard);
        result.idCardMasked = decryptedIdCard.substring(0, 6) + '********' + decryptedIdCard.substring(14);
      } catch (error) {
        logger.error('身份证解密失败', { error, userId });
      }
    }

    return result;
  }
}

export const kycService = new KYCService();

