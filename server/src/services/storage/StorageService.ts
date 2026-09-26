export interface StoredObject {
  key: string;
  url: string;
}

/** Image/object storage abstraction. Mongo only ever stores the returned url/key. */
export interface StorageService {
  put(key: string, data: Buffer, contentType: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
}
