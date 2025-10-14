import { logger } from '../utils/logger.js';

/**
 * 短信验证码服务
 * 
 * 注意：这是模拟实现，生产环境需要对接真实的短信服务商
 * 如：阿里云短信、腾讯云短信、云片等
 */
class SMSService {
  // 模拟验证码存储（生产环境使用Redis）
  private codes: Map<string, { code: string; expires: number }> = new Map();
  // 简易发送冷却：同号码60秒
  private cooldowns: Map<string, number> = new Map();

  /**
   * 发送验证码
   */
  async sendVerificationCode(phone: string): Promise<boolean> {
    try {
      // 验证手机号格式
      if (!this.validatePhone(phone)) {
        throw new Error('Invalid phone number format');
      }

      // 发送频率限制：60秒内不可重复发送
      const now = Date.now();
      const nextAllowed = this.cooldowns.get(phone) || 0;
      if (now < nextAllowed) {
        const seconds = Math.ceil((nextAllowed - now) / 1000);
        logger.warn(`发送过于频繁: ${phone}, 需等待 ${seconds}s`);
        return false;
      }

      // 生成6位随机验证码
      const code = this.generateCode();
      
      // 设置5分钟过期
      const expires = Date.now() + 5 * 60 * 1000;
      
      // 存储验证码（生产环境存到Redis）
      this.codes.set(phone, { code, expires });
      // 设置60秒冷却
      this.cooldowns.set(phone, now + 60 * 1000);

      // TODO: 在生产环境中，这里调用短信服务商API发送验证码
      logger.info(`📱 发送验证码到 ${phone}: ${code} (开发模式)`);
      
      // 模拟API调用
      // await this.callSMSProvider(phone, code);

      return true;
    } catch (error) {
      logger.error('发送验证码失败:', error);
      throw error;
    }
  }

  /**
   * 检查当前是否允许发送验证码（用于上层速率提示）
   */
  canSendNow(phone: string): boolean {
    const now = Date.now();
    const nextAllowed = this.cooldowns.get(phone) || 0;
    return now >= nextAllowed;
  }

  /**
   * 验证验证码
   */
  async verifyCode(phone: string, code: string): Promise<boolean> {
    const stored = this.codes.get(phone);

    if (!stored) {
      logger.warn(`验证码不存在: ${phone}`);
      return false;
    }

    // 检查是否过期
    if (Date.now() > stored.expires) {
      this.codes.delete(phone);
      logger.warn(`验证码已过期: ${phone}`);
      return false;
    }

    // 验证码匹配
    if (stored.code === code) {
      this.codes.delete(phone); // 验证成功后删除
      logger.info(`验证码验证成功: ${phone}`);
      return true;
    }

    logger.warn(`验证码错误: ${phone}`);
    return false;
  }

  /**
   * 生成6位随机验证码
   */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 验证手机号格式（中国大陆）
   */
  private validatePhone(phone: string): boolean {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  }

  /**
   * 调用短信服务商API（示例）
   * 生产环境需要实现真实的API调用
   */
  private async callSMSProvider(phone: string, code: string): Promise<void> {
    // 示例：阿里云短信
    // const params = {
    //   PhoneNumbers: phone,
    //   SignName: '星宠挂机',
    //   TemplateCode: 'SMS_123456789',
    //   TemplateParam: JSON.stringify({ code })
    // };
    // await alicloudSMS.sendSMS(params);

    // 示例：腾讯云短信
    // await tencentSMS.send({
    //   to: phone,
    //   templateId: '123456',
    //   params: [code, '5']
    // });
  }

  /**
   * 清理过期验证码（定时任务调用）
   */
  cleanExpiredCodes(): void {
    const now = Date.now();
    for (const [phone, data] of this.codes.entries()) {
      if (now > data.expires) {
        this.codes.delete(phone);
      }
    }
  }
}

export const smsService = new SMSService();
export default smsService;

