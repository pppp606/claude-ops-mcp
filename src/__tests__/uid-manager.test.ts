import { UIDManager } from '../uid-manager';

describe('UIDManager', () => {
  describe('UID generation', () => {
    it('should generate a unique identifier', () => {
      const uid = UIDManager.generateUID();
      expect(uid).toBeDefined();
      expect(typeof uid).toBe('string');
      expect(uid.length).toBeGreaterThan(0);
    });

    it('should generate different UIDs on each call', () => {
      const uid1 = UIDManager.generateUID();
      const uid2 = UIDManager.generateUID();
      expect(uid1).not.toBe(uid2);
    });

    it('should follow UUID v4 format', () => {
      const uid = UIDManager.generateUID();
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uid).toMatch(uuidV4Regex);
    });
  });

  describe('UID storage', () => {
    it('should store the current UID', () => {
      const uid = UIDManager.generateUID();
      UIDManager.setCurrentUID(uid);
      expect(UIDManager.getCurrentUID()).toBe(uid);
    });

    it('should return null if no UID is set', () => {
      const manager = new UIDManager();
      expect(manager.getUID()).toBeNull();
    });

    it('should update the current UID', () => {
      const uid1 = UIDManager.generateUID();
      const uid2 = UIDManager.generateUID();

      UIDManager.setCurrentUID(uid1);
      expect(UIDManager.getCurrentUID()).toBe(uid1);

      UIDManager.setCurrentUID(uid2);
      expect(UIDManager.getCurrentUID()).toBe(uid2);
    });
  });

  describe('UID in initialization response', () => {
    it('should include UID in the server metadata', () => {
      const manager = new UIDManager();
      const uid = manager.initialize();
      const metadata = manager.getMetadata();

      expect(metadata.uid).toBe(uid);
      expect(metadata.timestamp).toBeDefined();
    });

    it('should generate a new UID on initialization', () => {
      const manager = new UIDManager();
      const uid1 = manager.initialize();

      const manager2 = new UIDManager();
      const uid2 = manager2.initialize();

      expect(uid1).not.toBe(uid2);
    });
  });
});