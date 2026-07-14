export interface BoundingBox {
  ymin: number; // 0 to 1000
  xmin: number; // 0 to 1000
  ymax: number; // 0 to 1000
  xmax: number; // 0 to 1000
}

export interface Face {
  id: string;
  photo_id: string;
  person_id: string | null; // null if unnamed
  bounding_box: BoundingBox;
  face_embedding_vector: number[]; // 768-dim embedding of the face description
  confidence: number;
  description: string; // e.g. "man in late 40s, grey hair, glasses"
}

export interface Photo {
  id: string;
  filepath: string;
  thumbnail_path: string;
  upload_date: string;
  exif_date_taken: string;
  gps_lat: number | null;
  gps_lng: number | null;
  camera: string | null;
  orientation: 'landscape' | 'portrait' | 'square';
  caption: string;
  embedding_vector: number[]; // 768-dim semantic text-image description embedding
  album_ids: string[];
  original_name: string;
  size_bytes: number;
}

export interface Person {
  id: string;
  name: string; // empty string or "Person Cluster #X" if unnamed
  representative_face_id: string | null;
}

export interface Album {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Viewer';
}

export interface AuditLog {
  id: string;
  user_email: string;
  user_name: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface SearchFilters {
  dateStart?: string;
  dateEnd?: string;
  personIds?: string[]; // multi-select
  location?: string;
  orientation?: 'landscape' | 'portrait' | 'square' | 'all';
  albumId?: string;
}

export interface DatabaseSchema {
  photos: Photo[];
  faces: Face[];
  people: Person[];
  albums: Album[];
  users: User[];
  auditLogs: AuditLog[];
}
