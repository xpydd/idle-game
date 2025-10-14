// 用户相关类型
export interface User {
  userId: string;
  phone: string;
  deviceId: string;
  kycStatus: KYCStatus;
  createdAt: Date;
  lastLoginAt: Date;
}

export enum KYCStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED'
}

// 星宠相关类型
export interface Pet {
  petId: string;
  userId: string;
  rarity: PetRarity;
  level: number;
  exp: number;
  bondTag?: string;
  createdAt: Date;
}

export enum PetRarity {
  COMMON = 'COMMON',       // 普通
  RARE = 'RARE',           // 稀有
  EPIC = 'EPIC',           // 史诗
  LEGENDARY = 'LEGENDARY', // 传说
  MYTHIC = 'MYTHIC'        // 神话
}

// 资产相关类型
export interface Wallet {
  userId: string;
  gemBalance: number;
  shellBalance: number;
  energy: number;
  lastEnergyUpdate: Date;
}

// 挂机产出记录
export interface ProductionLog {
  logId: string;
  userId: string;
  petId: string;
  startTime: Date;
  endTime: Date;
  isOnline: boolean;
  gemProduced: number;
  energyConsumed: number;
  createdAt: Date;
}

// 能量流水
export interface EnergyLedger {
  ledgerId: string;
  userId: string;
  amount: number;
  source: EnergySource;
  timestamp: Date;
}

export enum EnergySource {
  NATURAL_RECOVERY = 'NATURAL_RECOVERY',
  PURCHASE = 'PURCHASE',
  ASSIST = 'ASSIST',
  TASK_REWARD = 'TASK_REWARD'
}

// 商店商品
export interface ShopItem {
  sku: string;
  name: string;
  type: ItemType;
  price: number;
  currency: Currency;
  dailyLimit?: number;
  stock?: number;
  resetType?: ResetType;
}

export enum ItemType {
  PET_EGG = 'PET_EGG',
  ENERGY = 'ENERGY',
  TICKET = 'TICKET',
  MATERIAL = 'MATERIAL'
}

export enum Currency {
  GEM = 'GEM',
  SHELL = 'SHELL'
}

export enum ResetType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY'
}

// 融合记录
export interface FusionAttempt {
  attemptId: string;
  userId: string;
  materials: string[]; // petIds
  targetRarity: PetRarity;
  gemCost: number;
  success: boolean;
  resultPetId?: string;
  timestamp: Date;
}

// 矿点挑战
export interface MineChallenge {
  challengeId: string;
  userId: string;
  spotLevel: number;
  ticketCost: number;
  startTime: Date;
  endTime: Date;
  claimed: boolean;
  rewards?: Rewards;
}

export interface Rewards {
  gems?: number;
  shells?: number;
  items?: { itemId: string; quantity: number }[];
}

// 社交相关
export interface Friendship {
  userId: string;
  friendId: string;
  status: FriendshipStatus;
  createdAt: Date;
}

export enum FriendshipStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  BLOCKED = 'BLOCKED'
}

export interface InviteRecord {
  inviteId: string;
  inviterId: string;
  inviteeId: string;
  code: string;
  rewards: Rewards;
  timestamp: Date;
}

// 任务系统
export interface Task {
  taskId: string;
  type: TaskType;
  condition: TaskCondition;
  rewards: Rewards;
  resetType?: ResetType;
}

export enum TaskType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  ACHIEVEMENT = 'ACHIEVEMENT',
  NEWBIE = 'NEWBIE'
}

export interface TaskCondition {
  type: string;
  target: number;
  current?: number;
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  requestId?: string;
  serverTime?: string;
  signature?: string;
}

// JWT Payload
export interface JWTPayload {
  userId: string;
  deviceId: string;
  iat?: number;
  exp?: number;
}

// 请求扩展
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      requestId?: string;
    }
  }
}

