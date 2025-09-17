import { randomUUID } from 'crypto';

interface UIDMetadata {
  uid: string;
  timestamp: number;
}

export class UIDManager {
  private static currentUID: string | null = null;
  private uid: string | null = null;
  private metadata: UIDMetadata | null = null;

  static generateUID(): string {
    return randomUUID();
  }

  static setCurrentUID(uid: string): void {
    UIDManager.currentUID = uid;
  }

  static getCurrentUID(): string | null {
    return UIDManager.currentUID;
  }

  getUID(): string | null {
    return this.uid;
  }

  initialize(): string {
    this.uid = UIDManager.generateUID();
    this.metadata = {
      uid: this.uid,
      timestamp: Date.now(),
    };
    return this.uid;
  }

  getMetadata(): UIDMetadata {
    if (!this.metadata) {
      throw new Error('UIDManager not initialized');
    }
    return this.metadata;
  }
}