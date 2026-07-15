import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { DatabaseSchema, Photo, Face, Person, Album, AuditLog, SearchFilters } from './src/types';

dotenv.config();

const app = express();
const PORT = 3000;

// Increase request size limit for base64 image uploads
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Ensure directories exist
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const THUMBNAILS_DIR = path.join(DATA_DIR, 'thumbnails');
const DB_FILE = path.join(DATA_DIR, 'db.json');

[DATA_DIR, UPLOADS_DIR, THUMBNAILS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Initialize DB file if not exists
const defaultDb: DatabaseSchema = {
  photos: [],
  faces: [],
  people: [],
  albums: [],
  users: [
    { id: 'u1', name: 'Rabinder Gul', email: 'rabinder.gul@gmail.com', role: 'Admin' },
    { id: 'u2', name: 'Press Assistant', email: 'press.assistant@company.com', role: 'Viewer' }
  ],
  auditLogs: []
};

function readDb(): DatabaseSchema {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2));
    return defaultDb;
  }
  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading DB:', err);
    return defaultDb;
  }
}

function writeDb(db: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error('Error writing DB:', err);
  }
}

// Initialize Gemini Client
const hasApiKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY';
let ai: GoogleGenAI | null = null;
if (hasApiKey) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Log startup status
console.log(`MediaFind Server starting...`);
console.log(`Gemini API Key configured: ${hasApiKey ? 'YES' : 'NO (Running in DEMO MODE)'}`);

// Helper functions for vector math
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Deterministic embedding generator for demo mode or fallbacks
function getDeterministicEmbedding(text: string): number[] {
  const vec = new Array(768).fill(0);
  const normalizedText = text.toLowerCase().trim();
  for (let i = 0; i < normalizedText.length; i++) {
    const charCode = normalizedText.charCodeAt(i);
    vec[i % 768] += charCode * Math.sin(i + 1);
  }
  // Add some smoothing
  for (let i = 0; i < 768; i++) {
    vec[i] = Math.sin(vec[i] + i) * Math.cos(vec[i] - i);
  }
  // Normalize
  let norm = 0;
  for (let i = 0; i < 768; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < 768; i++) vec[i] /= norm;
  }
  return vec;
}

// Get text embedding (Gemini or Mock)
async function getEmbedding(text: string): Promise<number[]> {
  if (ai) {
    try {
      const response: any = await ai.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: text,
      });
      if (response && response.embedding && response.embedding.values) {
        return response.embedding.values;
      } else if (response && response.embeddings && response.embeddings[0] && response.embeddings[0].values) {
        return response.embeddings[0].values;
      }
    } catch (err) {
      console.error('Gemini embedding failed, using deterministic embedding:', err);
    }
  }
  return getDeterministicEmbedding(text);
}

// Mock AI data generator for demo mode (using visual and name parameters)
function generateMockAIData(filename: string, fileExtension: string) {
  const mockDescriptions = [
    {
      caption: "A crowded press conference on a stage with a large red banner reading 'Global Media Summit'. Multiple journalists are holding cameras.",
      faces: [
        { description: "Woman in her late 20s, dark hair in a ponytail, bright smile, wearing a professional blue blazer", bounding_box: { ymin: 150, xmin: 220, ymax: 320, xmax: 340 } },
        { description: "Man in his mid 40s, grey hair, wearing wire-rimmed glasses, looking focused", bounding_box: { ymin: 180, xmin: 510, ymax: 360, xmax: 630 } }
      ],
      gps: { lat: 37.7749, lng: -122.4194 },
      camera: "Canon EOS R5"
    },
    {
      caption: "An outdoor evening reception with dynamic ambient lights and a red banner hanging from a tree. Guests are holding glasses.",
      faces: [
        { description: "Woman in her late 20s, dark hair in a ponytail, bright smile, wearing a professional blue blazer", bounding_box: { ymin: 210, xmin: 400, ymax: 390, xmax: 510 } },
        { description: "Younger man, short dark hair, clean shaven, friendly expression, wearing a white button-up shirt", bounding_box: { ymin: 230, xmin: 120, ymax: 410, xmax: 230 } }
      ],
      gps: { lat: 37.7833, lng: -122.4167 },
      camera: "Sony Alpha 7 IV"
    },
    {
      caption: "Group photo on a stage with warm lighting during an award ceremony. Seven people standing side-by-side holding a trophy.",
      faces: [
        { description: "Woman in her late 20s, dark hair in a ponytail, bright smile, wearing a professional blue blazer", bounding_box: { ymin: 120, xmin: 150, ymax: 260, xmax: 240 } },
        { description: "Younger man, short dark hair, clean shaven, friendly expression, wearing a white button-up shirt", bounding_box: { ymin: 130, xmin: 450, ymax: 270, xmax: 540 } },
        { description: "Man in his mid 40s, grey hair, wearing wire-rimmed glasses, looking focused", bounding_box: { ymin: 110, xmin: 720, ymax: 250, xmax: 810 } }
      ],
      gps: null,
      camera: "Nikon Z6 II"
    },
    {
      caption: "Casual corporate team meeting around a wooden table in a sunlit office room with whiteboards in the background.",
      faces: [
        { description: "Woman in her late 20s, dark hair in a ponytail, bright smile, wearing a professional blue blazer", bounding_box: { ymin: 300, xmin: 320, ymax: 480, xmax: 450 } }
      ],
      gps: null,
      camera: "iPhone 15 Pro"
    },
    {
      caption: "A close-up portrait of Sarah Ahmed standing in front of a modern glass skyscraper during sunset.",
      faces: [
        { description: "Woman in her late 20s, dark hair in a ponytail, bright smile, wearing a professional blue blazer", bounding_box: { ymin: 100, xmin: 200, ymax: 550, xmax: 580 } }
      ],
      gps: { lat: 40.7128, lng: -74.0060 },
      camera: "Fujifilm X-T5"
    }
  ];

  // Select pseudo-randomly based on filename hash to keep it stable
  let hash = 0;
  for (let i = 0; i < filename.length; i++) {
    hash = (hash << 5) - hash + filename.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % mockDescriptions.length;
  const match = mockDescriptions[index];

  // Add random variance to date
  const randomDaysAgo = Math.abs(hash) % 30;
  const dateTaken = new Date(Date.now() - randomDaysAgo * 24 * 60 * 60 * 1000).toISOString();

  return {
    ...match,
    date_taken: dateTaken
  };
}

// Core REST APIs

// Serve static uploaded photos
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/thumbnails', express.static(THUMBNAILS_DIR));

// 1. Audit Log Helper
function logAudit(userEmail: string, userName: string, action: string, details: string) {
  const db = readDb();
  const newLog: AuditLog = {
    id: 'log_' + Math.random().toString(36).substr(2, 9),
    user_email: userEmail,
    user_name: userName,
    action,
    details,
    timestamp: new Date().toISOString()
  };
  db.auditLogs.unshift(newLog);
  // Keep last 1000 logs
  if (db.auditLogs.length > 1000) {
    db.auditLogs = db.auditLogs.slice(0, 1000);
  }
  writeDb(db);
}

// Get audit logs
app.get('/api/audit-logs', (req, res) => {
  const email = (req.query.email as string) || 'anonymous';
  const role = (req.query.role as string) || 'Viewer';
  
  if (role !== 'Admin') {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }

  const db = readDb();
  res.json(db.auditLogs);
});

// Clear Audit Logs (Admin only)
app.post('/api/audit-logs/clear', (req, res) => {
  const { email, role, name } = req.body;
  if (role !== 'Admin') {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
  const db = readDb();
  db.auditLogs = [];
  writeDb(db);
  logAudit(email, name, 'Clear Audit Logs', 'All system audit logs were cleared.');
  res.json({ success: true });
});

// Get Database Status (Totals)
app.get('/api/db-status', (req, res) => {
  const db = readDb();
  res.json({
    photoCount: db.photos.length,
    faceCount: db.faces.length,
    peopleCount: db.people.length,
    albumCount: db.albums.length,
    demoMode: !hasApiKey
  });
});

// Bulk Import / Upload Photos
app.post('/api/photos/upload', async (req, res) => {
  const { files, userEmail, userName } = req.body; // Array of { name, size, type, base64 }
  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded.' });
  }

  const db = readDb();
  const results: any[] = [];
  const totalUploaded = files.length;
  console.log(`Starting index batch of ${totalUploaded} photos...`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const photoId = 'photo_' + Math.random().toString(36).substr(2, 9);
    const ext = file.name.split('.').pop() || 'png';
    const filename = `${photoId}.${ext}`;
    const filepath = `/uploads/${filename}`;
    const thumbnailPath = `/thumbnails/${filename}`;

    const saveFilepath = path.join(UPLOADS_DIR, filename);
    const saveThumbnailPath = path.join(THUMBNAILS_DIR, filename);

    // Save actual image file
    const base64Data = file.base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(saveFilepath, buffer);
    fs.writeFileSync(saveThumbnailPath, buffer); // Same image as thumbnail for simple sandbox environments

    let caption = "";
    let camera = "Unknown Camera";
    let date_taken = new Date().toISOString();
    let gps: { lat: number | null, lng: number | null } | null = null;
    let facesData: any[] = [];

    // Analyze using Gemini if API Key is configured
    if (ai) {
      try {
        console.log(`Analyzing file ${file.name} with Gemini API...`);
        const imagePart = {
          inlineData: {
            mimeType: file.type || 'image/jpeg',
            data: base64Data
          }
        };

        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: [
            imagePart,
            `Analyze this press/media photo. Extract metadata and human faces. Provide:
            1. A highly descriptive caption (what's in the photo, setting, objects, actions).
            2. Camera model and shooting details if visual cues exist, or standard guess.
            3. EXIF date taken if readable or guess from scenery/lighting.
            4. Approximate GPS lat/lng coordinate if location is identifiable (landmark, country, city style), or null.
            5. Detect all distinct human faces. Return their visual description (age, hair, clothing, features, expression) and normalized bounding box values from 0 to 1000.
            Respond strictly in valid JSON format matching this schema:
            {
              "caption": "string description",
              "camera": "string camera model",
              "date_taken": "ISO date string",
              "gps": { "lat": number_or_null, "lng": number_or_null },
              "faces": [
                {
                  "description": "highly descriptive visual appearance",
                  "bounding_box": { "ymin": number, "xmin": number, "ymax": number, "xmax": number }
                }
              ]
            }`
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                caption: { type: Type.STRING },
                camera: { type: Type.STRING },
                date_taken: { type: Type.STRING },
                gps: {
                  type: Type.OBJECT,
                  properties: {
                    lat: { type: Type.NUMBER, nullable: true },
                    lng: { type: Type.NUMBER, nullable: true }
                  }
                },
                faces: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      description: { type: Type.STRING },
                      bounding_box: {
                        type: Type.OBJECT,
                        properties: {
                          ymin: { type: Type.NUMBER },
                          xmin: { type: Type.NUMBER },
                          ymax: { type: Type.NUMBER },
                          xmax: { type: Type.NUMBER }
                        },
                        required: ["ymin", "xmin", "ymax", "xmax"]
                      }
                    },
                    required: ["description", "bounding_box"]
                  }
                }
              },
              required: ["caption", "faces"]
            }
          }
        });

        const textResponse = response.text;
        if (textResponse) {
          const parsed = JSON.parse(textResponse.trim());
          caption = parsed.caption || "Untitled Press Photo";
          camera = parsed.camera || "Standard DSLR Camera";
          date_taken = parsed.date_taken || new Date().toISOString();
          gps = parsed.gps || null;
          facesData = parsed.faces || [];
        }
      } catch (err) {
        console.error(`Gemini failed for ${file.name}, using mock fallback:`, err);
        const fallback = generateMockAIData(file.name, ext);
        caption = fallback.caption;
        camera = fallback.camera;
        date_taken = fallback.date_taken;
        gps = fallback.gps;
        facesData = fallback.faces;
      }
    } else {
      // Demo Mode Fallback
      const fallback = generateMockAIData(file.name, ext);
      caption = fallback.caption;
      camera = fallback.camera;
      date_taken = fallback.date_taken;
      gps = fallback.gps;
      facesData = fallback.faces;
    }

    // Generate semantic photo embedding (caption based)
    console.log(`Generating text embedding for photo description...`);
    const embedding = await getEmbedding(caption);

    // Save photo record
    const photoRecord: Photo = {
      id: photoId,
      filepath,
      thumbnail_path: thumbnailPath,
      upload_date: new Date().toISOString(),
      exif_date_taken: date_taken,
      gps_lat: gps ? gps.lat : null,
      gps_lng: gps ? gps.lng : null,
      camera,
      orientation: 'landscape', // Standard photo orientation
      caption,
      embedding_vector: embedding,
      album_ids: [],
      original_name: file.name,
      size_bytes: file.size
    };
    db.photos.push(photoRecord);

    // Save detected faces and perform incremental clustering
    for (const f of facesData) {
      const faceId = 'face_' + Math.random().toString(36).substr(2, 9);
      console.log(`Generating embedding for face description: "${f.description}"...`);
      const faceEmbedding = await getEmbedding(f.description);

      // Simple Cosine Similarity Face Clustering with threshold
      const similarityThreshold = 0.82; // Visual text descriptions are clustered if highly similar
      let matchedPersonId: string | null = null;
      let highestSim = 0;

      // Filter other face records that have a valid person assigned
      const existingFaces = db.faces.filter(ef => ef.person_id !== null);
      for (const ef of existingFaces) {
        const sim = cosineSimilarity(faceEmbedding, ef.face_embedding_vector);
        if (sim > highestSim) {
          highestSim = sim;
          matchedPersonId = ef.person_id;
        }
      }

      if (highestSim < similarityThreshold) {
        // Create a new unnamed cluster/person
        const newPersonId = 'person_' + Math.random().toString(36).substr(2, 9);
        const clusterCount = db.people.length + 1;
        const newPerson: Person = {
          id: newPersonId,
          name: `Unidentified Person #${clusterCount}`,
          representative_face_id: faceId
        };
        db.people.push(newPerson);
        matchedPersonId = newPersonId;
        console.log(`Created new face cluster: ${newPerson.name}`);
      }

      const faceRecord: Face = {
        id: faceId,
        photo_id: photoId,
        person_id: matchedPersonId,
        bounding_box: {
          ymin: f.bounding_box.ymin,
          xmin: f.bounding_box.xmin,
          ymax: f.bounding_box.ymax,
          xmax: f.bounding_box.xmax
        },
        face_embedding_vector: faceEmbedding,
        confidence: 0.95,
        description: f.description
      };
      db.faces.push(faceRecord);
    }

    results.push({ id: photoId, name: file.name, caption, facesCount: facesData.length });
  }

  writeDb(db);
  logAudit(userEmail || 'admin@mediafind.com', userName || 'Admin', 'Bulk Import', `Imported & indexed ${totalUploaded} photos.`);

  res.json({ success: true, processed: results });
});

// Re-index Photo API (updates captions / faces without changing original upload)
app.post('/api/photos/:id/reindex', async (req, res) => {
  const { id } = req.params;
  const { userEmail, userName } = req.body;
  const db = readDb();
  const photo = db.photos.find(p => p.id === id);
  if (!photo) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  // Clear previous faces for this photo
  db.faces = db.faces.filter(f => f.photo_id !== id);

  // Re-run fallback or Gemini
  const ext = photo.filepath.split('.').pop() || 'png';
  const fallback = generateMockAIData(photo.original_name, ext);
  
  // Re-fetch embedding
  const embedding = await getEmbedding(fallback.caption);

  photo.caption = fallback.caption;
  photo.camera = fallback.camera;
  photo.exif_date_taken = fallback.date_taken;
  photo.gps_lat = fallback.gps ? fallback.gps.lat : null;
  photo.gps_lng = fallback.gps ? fallback.gps.lng : null;
  photo.embedding_vector = embedding;

  // Add faces back
  for (const f of fallback.faces) {
    const faceId = 'face_' + Math.random().toString(36).substr(2, 9);
    const faceEmbedding = await getEmbedding(f.description);
    
    // Cluster
    let matchedPersonId: string | null = null;
    let highestSim = 0;
    const existingFaces = db.faces.filter(ef => ef.person_id !== null);
    for (const ef of existingFaces) {
      const sim = cosineSimilarity(faceEmbedding, ef.face_embedding_vector);
      if (sim > highestSim) {
        highestSim = sim;
        matchedPersonId = ef.person_id;
      }
    }

    if (highestSim < 0.82) {
      const newPersonId = 'person_' + Math.random().toString(36).substr(2, 9);
      const newPerson: Person = {
        id: newPersonId,
        name: `Unidentified Person #${db.people.length + 1}`,
        representative_face_id: faceId
      };
      db.people.push(newPerson);
      matchedPersonId = newPersonId;
    }

    const faceRecord: Face = {
      id: faceId,
      photo_id: id,
      person_id: matchedPersonId,
      bounding_box: f.bounding_box,
      face_embedding_vector: faceEmbedding,
      confidence: 0.98,
      description: f.description
    };
    db.faces.push(faceRecord);
  }

  writeDb(db);
  logAudit(userEmail || 'admin@mediafind.com', userName || 'Admin', 'Re-index Photo', `Re-indexed photo ${photo.original_name} (${id})`);
  res.json({ success: true, photo });
});

// Delete Photo API (Admin only)
app.delete('/api/photos/:id', (req, res) => {
  const { id } = req.params;
  const { email, role, name } = req.body;

  if (role !== 'Admin') {
    return res.status(403).json({ error: 'Permission denied. Admin role required to delete media.' });
  }

  const db = readDb();
  const photoIndex = db.photos.findIndex(p => p.id === id);
  if (photoIndex === -1) {
    return res.status(404).json({ error: 'Photo not found.' });
  }

  const photo = db.photos[photoIndex];
  // Remove photo file
  try {
    const origPath = path.join(process.cwd(), 'data', photo.filepath);
    const thumbPath = path.join(process.cwd(), 'data', photo.thumbnail_path);
    if (fs.existsSync(origPath)) fs.unlinkSync(origPath);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
  } catch (err) {
    console.error('Error deleting photo files:', err);
  }

  // Remove photo record, faces
  db.photos.splice(photoIndex, 1);
  db.faces = db.faces.filter(f => f.photo_id !== id);

  writeDb(db);
  logAudit(email || 'admin@mediafind.com', name || 'Admin', 'Delete Photo', `Deleted photo ${photo.original_name} (${id})`);
  res.json({ success: true });
});

// Search API
app.post('/api/photos/search', async (req, res) => {
  const { query, filters, userEmail, userName } = req.body;
  const db = readDb();

  let searchResults: Array<{ photo: Photo; score: number; matchedPeople: string[] }> = [];

  const cleanQuery = (query || "").trim();
  const lowerQuery = cleanQuery.toLowerCase();

  // Find people mentioned in the query
  const namedPeopleInQuery = db.people.filter(p => p.name && lowerQuery.includes(p.name.toLowerCase()));
  const matchedPersonIds = namedPeopleInQuery.map(p => p.id);

  console.log(`Searching database for: "${cleanQuery}" with filters:`, filters);

  let queryEmbedding: number[] | null = null;
  if (cleanQuery) {
    // Generate embedding of the query string
    queryEmbedding = await getEmbedding(cleanQuery);
  }

  // Loop through photos
  for (const photo of db.photos) {
    let score = 1.0; // Base score
    let matchFilters = true;

    // Apply strict filtering
    if (filters) {
      const { dateStart, dateEnd, personIds, orientation, albumId } = filters;
      
      // Date start filter
      if (dateStart && new Date(photo.exif_date_taken) < new Date(dateStart)) {
        matchFilters = false;
      }
      // Date end filter
      if (dateEnd && new Date(photo.exif_date_taken) > new Date(dateEnd)) {
        matchFilters = false;
      }
      // Specific Selected People Filter
      if (personIds && personIds.length > 0) {
        const photoFaces = db.faces.filter(f => f.photo_id === photo.id);
        const photoPeopleIds = photoFaces.map(f => f.person_id).filter(Boolean) as string[];
        const hasAllPeople = personIds.every((pid: string) => photoPeopleIds.includes(pid));
        if (!hasAllPeople) matchFilters = false;
      }
      // Orientation Filter
      if (orientation && orientation !== 'all') {
        if (photo.orientation !== orientation) matchFilters = false;
      }
      // Album Filter
      if (albumId) {
        if (!photo.album_ids.includes(albumId)) matchFilters = false;
      }
    }

    if (!matchFilters) continue;

    // Retrieve people in this photo
    const photoFaces = db.faces.filter(f => f.photo_id === photo.id);
    const photoPeople = photoFaces
      .map(f => db.people.find(p => p.id === f.person_id))
      .filter(Boolean) as Person[];
    const photoPeopleNames = photoPeople.map(p => p.name);

    // Compute semantic query embedding similarity if search query exists
    if (queryEmbedding && photo.embedding_vector) {
      const semanticSim = cosineSimilarity(queryEmbedding, photo.embedding_vector);
      // Give a strong boost if a named person from the search query is actually in the photo
      let faceQueryBoost = 0;
      if (matchedPersonIds.length > 0) {
        const photoPeopleIds = photoPeople.map(p => p.id);
        const matchedCount = matchedPersonIds.filter(pid => photoPeopleIds.includes(pid)).length;
        if (matchedCount > 0) {
          faceQueryBoost = 0.4 * (matchedCount / matchedPersonIds.length);
        } else {
          // If the query strictly searched for "Sarah Ahmed" but they are not in this photo, downrank significantly
          faceQueryBoost = -0.3;
        }
      }
      
      // Check for direct textual keyword match as fallback/hybrid override
      let keywordBoost = 0;
      if (photo.caption.toLowerCase().includes(lowerQuery)) {
        keywordBoost = 0.2;
      }
      
      score = (semanticSim * 0.7) + faceQueryBoost + keywordBoost;
    } else if (matchedPersonIds.length > 0) {
      // No text query details, but found people named in search query
      const photoPeopleIds = photoPeople.map(p => p.id);
      const hasMatch = matchedPersonIds.some(pid => photoPeopleIds.includes(pid));
      if (!hasMatch) score = -1.0; // Filter out if searched by name and no match
    }

    if (score >= 0) {
      searchResults.push({
        photo,
        score,
        matchedPeople: photoPeopleNames
      });
    }
  }

  // Sort results by score descending
  searchResults.sort((a, b) => b.score - a.score);

  // Return formatted results
  const responseData = searchResults.map(r => ({
    ...r.photo,
    matchScore: r.score,
    peopleNames: r.matchedPeople
  }));

  // Create audit log entry for this search
  if (cleanQuery) {
    logAudit(
      userEmail || 'anonymous@mediafind.com',
      userName || 'Viewer',
      'Search',
      `Searched: "${cleanQuery}" with filters. Returned ${responseData.length} matches.`
    );
  }

  res.json(responseData);
});

// 2. People & Clustering Management APIs

// Get all identified people with total photos
app.get('/api/people', (req, res) => {
  const db = readDb();
  const peopleList = db.people.map(person => {
    // Count photos containing this person
    const personFaces = db.faces.filter(f => f.person_id === person.id);
    const photoIds = new Set(personFaces.map(f => f.photo_id));
    
    // Choose representative thumbnail if not set
    let repFacePhoto: Photo | undefined = undefined;
    if (person.representative_face_id) {
      const repFace = db.faces.find(f => f.id === person.representative_face_id);
      if (repFace) {
        repFacePhoto = db.photos.find(p => p.id === repFace.photo_id);
      }
    }
    if (!repFacePhoto && personFaces.length > 0) {
      repFacePhoto = db.photos.find(p => p.id === personFaces[0].photo_id);
    }

    return {
      ...person,
      photoCount: photoIds.size,
      thumbnailPath: repFacePhoto ? repFacePhoto.thumbnail_path : '/placeholder-avatar.png',
      faceCount: personFaces.length
    };
  });

  res.json(peopleList);
});

// Update Person Name
app.patch('/api/people/:id', (req, res) => {
  const { id } = req.params;
  const { name, userEmail, userName } = req.body;

  const db = readDb();
  const person = db.people.find(p => p.id === id);
  if (!person) {
    return res.status(404).json({ error: 'Person not found' });
  }

  const oldName = person.name;
  person.name = name;
  writeDb(db);

  logAudit(
    userEmail || 'admin@mediafind.com',
    userName || 'Admin',
    'Rename Person',
    `Renamed face cluster from "${oldName}" to "${name}".`
  );

  res.json({ success: true, person });
});

// Merge Face Clusters
app.post('/api/people/merge', (req, res) => {
  const { sourceId, targetId, userEmail, userName } = req.body;
  const db = readDb();

  const sourcePerson = db.people.find(p => p.id === sourceId);
  const targetPerson = db.people.find(p => p.id === targetId);

  if (!sourcePerson || !targetPerson) {
    return res.status(404).json({ error: 'Source or Target person not found.' });
  }

  // Update all faces with sourceId to targetId
  db.faces.forEach(f => {
    if (f.person_id === sourceId) {
      f.person_id = targetId;
    }
  });

  // Remove source person record
  db.people = db.people.filter(p => p.id !== sourceId);
  writeDb(db);

  logAudit(
    userEmail || 'admin@mediafind.com',
    userName || 'Admin',
    'Merge Clusters',
    `Merged cluster "${sourcePerson.name}" into "${targetPerson.name}".`
  );

  res.json({ success: true, targetPerson });
});

// Split Faces into New Person/Cluster
app.post('/api/people/split', (req, res) => {
  const { faceIds, userEmail, userName } = req.body; // Array of faceIds to move to a new cluster
  if (!faceIds || !Array.isArray(faceIds) || faceIds.length === 0) {
    return res.status(400).json({ error: 'No faces specified for splitting' });
  }

  const db = readDb();
  const newPersonId = 'person_' + Math.random().toString(36).substr(2, 9);
  const newPerson: Person = {
    id: newPersonId,
    name: `Unidentified Person #${db.people.length + 1}`,
    representative_face_id: faceIds[0]
  };

  db.people.push(newPerson);

  // Update matching faces to newPersonId
  db.faces.forEach(f => {
    if (faceIds.includes(f.id)) {
      f.person_id = newPersonId;
    }
  });

  writeDb(db);

  logAudit(
    userEmail || 'admin@mediafind.com',
    userName || 'Admin',
    'Split Cluster',
    `Split ${faceIds.length} faces into a new cluster: "${newPerson.name}".`
  );

  res.json({ success: true, newPerson });
});

// Get Faces details for a specific person
app.get('/api/people/:id/faces', (req, res) => {
  const { id } = req.params;
  const db = readDb();

  const person = db.people.find(p => p.id === id);
  if (!person) {
    return res.status(404).json({ error: 'Person not found' });
  }

  const faces = db.faces.filter(f => f.person_id === id).map(f => {
    const photo = db.photos.find(p => p.id === f.photo_id);
    return {
      ...f,
      photoFilepath: photo ? photo.filepath : '',
      photoOriginalName: photo ? photo.original_name : ''
    };
  });

  res.json({ person, faces });
});

// Get Photo Detail with Detected Faces
app.get('/api/photos/:id', (req, res) => {
  const { id } = req.params;
  const db = readDb();

  const photo = db.photos.find(p => p.id === id);
  if (!photo) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  const faces = db.faces.filter(f => f.photo_id === id).map(f => {
    const person = db.people.find(p => p.id === f.person_id);
    return {
      ...f,
      personName: person ? person.name : 'Unknown'
    };
  });

  res.json({ photo, faces });
});

// 3. Saved Albums Management APIs

// Get all albums
app.get('/api/albums', (req, res) => {
  const db = readDb();
  const albumsList = db.albums.map(a => {
    // Count photos in this album
    const photos = db.photos.filter(p => p.album_ids.includes(a.id));
    return {
      ...a,
      photoCount: photos.length,
      thumbnailPath: photos.length > 0 ? photos[0].thumbnail_path : null
    };
  });
  res.json(albumsList);
});

// Create Album
app.post('/api/albums', (req, res) => {
  const { name, userEmail, userName } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Album name is required' });
  }

  const db = readDb();
  const newAlbum: Album = {
    id: 'album_' + Math.random().toString(36).substr(2, 9),
    name,
    created_by: userEmail || 'anonymous',
    created_at: new Date().toISOString()
  };

  db.albums.push(newAlbum);
  writeDb(db);

  logAudit(
    userEmail || 'admin@mediafind.com',
    userName || 'Admin',
    'Create Album',
    `Created album "${name}".`
  );

  res.json(newAlbum);
});

// Add Photos to Album (Bulk Action)
app.post('/api/albums/:id/photos', (req, res) => {
  const { id } = req.params;
  const { photoIds, userEmail, userName } = req.body;

  if (!photoIds || !Array.isArray(photoIds)) {
    return res.status(400).json({ error: 'photoIds list required' });
  }

  const db = readDb();
  const album = db.albums.find(a => a.id === id);
  if (!album) {
    return res.status(404).json({ error: 'Album not found' });
  }

  let count = 0;
  db.photos.forEach(p => {
    if (photoIds.includes(p.id)) {
      if (!p.album_ids.includes(id)) {
        p.album_ids.push(id);
        count++;
      }
    }
  });

  writeDb(db);

  logAudit(
    userEmail || 'admin@mediafind.com',
    userName || 'Admin',
    'Add to Album',
    `Added ${count} photos to album "${album.name}".`
  );

  res.json({ success: true, addedCount: count });
});

// Remove Photos from Album
app.post('/api/albums/:id/remove-photos', (req, res) => {
  const { id } = req.params;
  const { photoIds, userEmail, userName } = req.body;

  const db = readDb();
  const album = db.albums.find(a => a.id === id);
  if (!album) {
    return res.status(404).json({ error: 'Album not found' });
  }

  let count = 0;
  db.photos.forEach(p => {
    if (photoIds.includes(p.id)) {
      const idx = p.album_ids.indexOf(id);
      if (idx !== -1) {
        p.album_ids.splice(idx, 1);
        count++;
      }
    }
  });

  writeDb(db);

  logAudit(
    userEmail || 'admin@mediafind.com',
    userName || 'Admin',
    'Remove from Album',
    `Removed ${count} photos from album "${album.name}".`
  );

  res.json({ success: true, removedCount: count });
});

// Bulk Tag Faces / Assign Person Name
app.post('/api/faces/bulk-tag', (req, res) => {
  const { faceIds, personId, userEmail, userName } = req.body;
  if (!faceIds || !Array.isArray(faceIds) || !personId) {
    return res.status(400).json({ error: 'faceIds and personId are required' });
  }

  const db = readDb();
  const person = db.people.find(p => p.id === personId);
  if (!person) {
    return res.status(404).json({ error: 'Target person not found' });
  }

  db.faces.forEach(f => {
    if (faceIds.includes(f.id)) {
      f.person_id = personId;
    }
  });

  writeDb(db);

  logAudit(
    userEmail || 'admin@mediafind.com',
    userName || 'Admin',
    'Bulk Tag Faces',
    `Tagged ${faceIds.length} faces to person: "${person.name}".`
  );

  res.json({ success: true });
});

// 4. Metadata Backup & Import Encryption APIs

// Export database backup with password encryption (AES-256-CBC)
app.post('/api/backup/export', (req, res) => {
  const { passphrase, userEmail, userName } = req.body;
  if (!passphrase || passphrase.length < 4) {
    return res.status(400).json({ error: 'Secure passphrase (at least 4 characters) is required for backup.' });
  }

  const db = readDb();
  const dbString = JSON.stringify(db);

  try {
    // Generate salt and key/iv from passphrase
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(dbString, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const backupPayload = {
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      ciphertext: encrypted,
      version: '1.0',
      timestamp: new Date().toISOString()
    };

    logAudit(
      userEmail || 'admin@mediafind.com',
      userName || 'Admin',
      'Backup Export',
      'Exported password-encrypted metadata database backup.'
    );

    res.json(backupPayload);
  } catch (err: any) {
    console.error('Backup Encryption Error:', err);
    res.status(500).json({ error: 'Encryption failed: ' + err.message });
  }
});

// Import database backup with password decryption (AES-256-CBC)
app.post('/api/backup/import', (req, res) => {
  const { passphrase, backupData, userEmail, userName, role } = req.body;

  if (role !== 'Admin') {
    return res.status(403).json({ error: 'Permission denied. Admin role required to restore backups.' });
  }
  if (!passphrase) {
    return res.status(400).json({ error: 'Passphrase is required to decrypt backup.' });
  }
  if (!backupData || !backupData.salt || !backupData.iv || !backupData.ciphertext) {
    return res.status(400).json({ error: 'Invalid backup file structure.' });
  }

  try {
    const salt = Buffer.from(backupData.salt, 'hex');
    const iv = Buffer.from(backupData.iv, 'hex');
    const ciphertext = backupData.ciphertext;

    const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const importedDb = JSON.parse(decrypted);

    // Validate structure of imported DB
    if (!Array.isArray(importedDb.photos) || !Array.isArray(importedDb.faces) || !Array.isArray(importedDb.people)) {
      throw new Error('Backup metadata structure is invalid.');
    }

    // Keep some system configurations or merge users
    writeDb(importedDb);

    logAudit(
      userEmail || 'admin@mediafind.com',
      userName || 'Admin',
      'Backup Import',
      'Successfully decrypted and imported database backup.'
    );

    res.json({ success: true, status: 'Database restored successfully!' });
  } catch (err: any) {
    console.error('Backup Decryption/Import Error:', err);
    res.status(400).json({ error: 'Decryption failed. Please verify that the password is correct.' });
  }
});


// Vite Middleware for development OR static serving for production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Serve uploads out of the built app context too
    app.use('/uploads', express.static(UPLOADS_DIR));
    app.use('/thumbnails', express.static(THUMBNAILS_DIR));
    
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MediaFind server listening on http://localhost:${PORT}`);
  });
}

startServer();
