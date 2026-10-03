import { openDB, IDBPDatabase } from 'idb';
import { LocalVideo } from '../types/camera';

const DB_NAME = 'akaso_controller_db';
const STORE_NAME = 'videos';

class VideoStorageService {
  private dbPromise: Promise<IDBPDatabase>;

  constructor() {
    this.dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('date', 'date');
        }
      },
    });
  }

  async saveVideo(video: LocalVideo): Promise<void> {
    const db = await this.dbPromise;
    await db.put(STORE_NAME, video);
  }

  async getAllVideos(): Promise<LocalVideo[]> {
    const db = await this.dbPromise;
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('date');
    const videos = await index.getAll();
    return videos.reverse(); // Newest first
  }

  async getVideo(id: string): Promise<LocalVideo | undefined> {
    const db = await this.dbPromise;
    return await db.get(STORE_NAME, id);
  }

  async deleteVideo(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(STORE_NAME, id);
  }
}

export const videoStorageService = new VideoStorageService();
