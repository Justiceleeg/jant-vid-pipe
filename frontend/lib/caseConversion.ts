/**
 * Case Conversion Utilities
 *
 * Convert between snake_case (backend/Firestore) and camelCase (frontend)
 */

/**
 * Convert a string from snake_case to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert a string from camelCase to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Deep convert object keys from snake_case to camelCase
 */
export function snakeCaseKeys<T = any>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => snakeCaseKeys(item)) as any;
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const converted: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const camelKey = snakeToCamel(key);
        converted[camelKey] = snakeCaseKeys(obj[key]);
      }
    }
    return converted;
  }

  return obj;
}

/**
 * Deep convert object keys from camelCase to snake_case
 */
export function camelCaseKeys<T = any>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => camelCaseKeys(item)) as any;
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const converted: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const snakeKey = camelToSnake(key);
        converted[snakeKey] = camelCaseKeys(obj[key]);
      }
    }
    return converted;
  }

  return obj;
}

/**
 * Convert Firestore Timestamp to ISO string
 */
export function timestampToISO(timestamp: any): string {
  if (!timestamp) return '';

  // If it's already a string, return it
  if (typeof timestamp === 'string') return timestamp;

  // If it has a toDate method (Firestore Timestamp)
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }

  // If it has seconds property (raw Firestore timestamp)
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000).toISOString();
  }

  // If it's a Date object
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }

  // Default fallback
  return new Date(timestamp).toISOString();
}

/**
 * Convert ISO string to Firestore Timestamp-like object
 */
export function isoToTimestamp(isoString: string): { seconds: number; nanoseconds: number } {
  const date = new Date(isoString);
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0
  };
}

/**
 * Convert backend response to frontend format
 * Handles both case conversion and timestamp conversion
 */
export function convertBackendToFrontend<T = any>(data: any): T {
  const converted = snakeCaseKeys(data);

  // Convert any timestamp fields
  const timestampFields = ['createdAt', 'updatedAt', 'startedAt', 'lastUpdate', 'generatedAt', 'lastActivity'];

  const processTimestamps = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(processTimestamps);
    }

    const result = { ...obj };
    for (const field of timestampFields) {
      if (result[field]) {
        result[field] = timestampToISO(result[field]);
      }
    }

    // Recursively process nested objects
    for (const key in result) {
      if (typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
        result[key] = processTimestamps(result[key]);
      } else if (Array.isArray(result[key])) {
        result[key] = result[key].map(processTimestamps);
      }
    }

    return result;
  };

  return processTimestamps(converted);
}

/**
 * Convert frontend data to backend format
 * Handles both case conversion and timestamp conversion
 */
export function convertFrontendToBackend<T = any>(data: any): T {
  const converted = camelCaseKeys(data);

  // Convert any timestamp fields from ISO strings to timestamp objects if needed
  const timestampFields = ['created_at', 'updated_at', 'started_at', 'last_update', 'generated_at', 'last_activity'];

  const processTimestamps = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(processTimestamps);
    }

    const result = { ...obj };
    for (const field of timestampFields) {
      if (result[field] && typeof result[field] === 'string') {
        // For now, keep as ISO string - backend will handle conversion
        // result[field] = isoToTimestamp(result[field]);
      }
    }

    // Recursively process nested objects
    for (const key in result) {
      if (typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
        result[key] = processTimestamps(result[key]);
      } else if (Array.isArray(result[key])) {
        result[key] = result[key].map(processTimestamps);
      }
    }

    return result;
  };

  return processTimestamps(converted);
}