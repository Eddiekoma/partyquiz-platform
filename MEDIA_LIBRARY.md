# Media Library - Hetzner Object Storage Integration

## Overview
The PartyQuiz Studio media library provides secure, scalable asset management using Hetzner Object Storage (S3-compatible). It supports direct browser uploads via presigned URLs, eliminating server bandwidth bottlenecks.

## Architecture

### Upload Flow
1. **Client** requests presigned upload URL from `/api/uploads/presign`
2. **Server** validates permissions, generates S3 presigned URL, creates Asset record
3. **Client** uploads file directly to Hetzner Object Storage using PUT request
4. **Client** confirms upload via `/api/uploads/{id}/confirm`
5. **Server** verifies file exists in S3, marks asset as confirmed

### Components

#### Backend
- **`/lib/storage.ts`** - S3 client configuration and utility functions
- **`/api/uploads/presign/route.ts`** - Generate presigned upload URLs
- **`/api/uploads/[id]/confirm/route.ts`** - Confirm successful uploads
- **`/api/workspaces/[id]/assets/route.ts`** - List workspace assets

#### Frontend
- **`FileUploader.tsx`** - Drag-and-drop file upload with progress
- **`MediaBrowser.tsx`** - Grid/list view of assets with search
- **`MediaLibrary.tsx`** - Complete media management interface

## Hetzner Object Storage Setup

### 1. Create Storage Bucket

1. Go to [Hetzner Cloud Console](https://console.hetzner.cloud/)
2. Navigate to **Object Storage**
3. Click **Create Bucket**
4. Choose **Region**: `eu-central` (or closest to your users)
5. Enter **Bucket Name**: `partyquiz-media-production`
6. Leave bucket **Private** (recommended for security)
7. Click **Create**

### 2. Generate Access Keys

1. In the bucket settings, go to **Access Keys**
2. Click **Generate Access Key**
3. Save the **Access Key ID** and **Secret Access Key** securely
4. These will be used in your environment variables

### 3. Configure CORS (Critical!)

Without CORS configuration, browser uploads will fail with CORS errors.

**Option A: Via Hetzner Console (if available)**
1. Go to bucket settings → **CORS Configuration**
2. Add the following rule:

**Option B: Via AWS CLI (s3cmd or aws-cli)**

Install s3cmd:
```bash
brew install s3cmd  # macOS
apt-get install s3cmd  # Ubuntu
```

Configure s3cmd:
```bash
s3cmd --configure
```

Enter:
- Access Key: Your Hetzner access key
- Secret Key: Your Hetzner secret key
- Default Region: eu-central
- S3 Endpoint: fsn1.your-objectstorage.com (check Hetzner console)
- Use HTTPS: Yes

Create CORS configuration file `cors.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <CORSRule>
    <AllowedOrigin>https://partyquiz-platform.databridge360.com</AllowedOrigin>
    <AllowedOrigin>http://localhost:3000</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```

Apply CORS configuration:
```bash
s3cmd setcors cors.xml s3://partyquiz-media-production
```

Verify CORS:
```bash
s3cmd info s3://partyquiz-media-production
```

### 4. Environment Variables

Add to your `.env` file:

```bash
# Hetzner Object Storage
S3_ENDPOINT=https://fsn1.your-objectstorage.com
S3_REGION=eu-central
S3_BUCKET=partyquiz-media-production
S3_ACCESS_KEY=your_access_key_id
S3_SECRET_KEY=your_secret_access_key
```

**Important**: Replace `fsn1.your-objectstorage.com` with your actual Hetzner endpoint from the console.

### 5. Bucket Policy (Optional - Public Access)

If you want to serve images publicly (no presigned URLs needed):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::partyquiz-media-production/*"
    }
  ]
}
```

Apply via s3cmd:
```bash
s3cmd setpolicy policy.json s3://partyquiz-media-production
```

**⚠️ Security Note**: Public buckets expose all files. For sensitive content, keep bucket private and use presigned URLs.

## Usage

### Basic Upload

```tsx
import { MediaLibrary } from "@/components/media/MediaLibrary";

function MyComponent() {
  const workspaceId = "cuid...";

  return (
    <MediaLibrary
      workspaceId={workspaceId}
      category="images"
    />
  );
}
```

### With Selection Callback

```tsx
<MediaLibrary
  workspaceId={workspaceId}
  category="images"
  selectable
  onSelect={(asset) => {
    console.log("Selected:", asset);
    // Use asset.id, asset.url, etc.
  }}
/>
```

### Standalone Upload

```tsx
import { FileUploader } from "@/components/media/FileUploader";

<FileUploader
  workspaceId={workspaceId}
  category="audio"
  accept="audio/*"
  maxSize={10}
  onUploadComplete={(asset) => {
    console.log("Uploaded:", asset);
  }}
  onError={(error) => {
    alert(error);
  }}
/>
```

## Supported File Types

| Category | MIME Types | Max Size | Use Case |
|----------|-----------|----------|----------|
| **images** | image/jpeg, image/png, image/gif, image/webp, image/svg+xml | 10 MB | Photo questions, workspace branding |
| **audio** | audio/mpeg, audio/mp4, audio/ogg, audio/wav | 10 MB | Audio intro questions |
| **video** | video/mp4, video/webm, video/ogg | 50 MB | Video questions (future) |
| **other** | application/pdf, text/plain | 10 MB | Documents (future) |

## Security

### Access Control
- **Upload**: Requires `ASSET_UPLOAD` permission (CONTRIBUTOR or higher)
- **View**: All workspace members can view assets
- **Delete**: Requires ASSET_DELETE permission (EDITOR or higher)

### File Validation
- **Size limits**: Enforced server-side (10MB default, 50MB for video)
- **MIME type validation**: Enforced server-side
- **Filename sanitization**: Special characters removed
- **Presigned URL expiry**: 5 minutes for uploads, 1 hour for downloads

### Storage Keys
Format: `workspaces/{workspaceId}/{type}/{timestamp}-{random}-{filename}`

Example: `workspaces/cm123/images/1704067200000-a3f7k2-party.jpg`

This prevents:
- Filename collisions
- Path traversal attacks
- Predictable URLs (if bucket is public)

## Troubleshooting

### Upload fails with CORS error
**Symptoms**: Browser console shows `Access to fetch at 'https://...' has been blocked by CORS policy`

**Solution**: Verify CORS configuration on Hetzner bucket (see step 3 above). Ensure your domain is in `AllowedOrigin`.

### Upload succeeds but confirmation fails
**Symptoms**: File appears in S3 but not in media library

**Solution**: Check server logs. Likely issue: S3 credentials not configured or `objectExists()` failing. Verify environment variables.

### Images not loading
**Symptoms**: Broken image icons in media browser

**Solution**: 
1. Check if bucket is public OR presigned URLs are working
2. Verify `S3_ENDPOINT` in .env matches Hetzner console
3. Check browser console for 403 Forbidden errors

### "S3 storage not configured" error
**Symptoms**: Upload button disabled or error message

**Solution**: Environment variables missing. Verify `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` are set.

## Testing

### Manual Test
1. Start dev server: `pnpm dev`
2. Navigate to workspace → Questions → Create Question
3. Click "Upload Media"
4. Drag an image file
5. Verify upload progress bar reaches 100%
6. Check media browser shows uploaded image
7. Select image and verify it appears in question editor

### Check S3 Directly
```bash
# List files in bucket
s3cmd ls s3://partyquiz-media-production/

# Download a file
s3cmd get s3://partyquiz-media-production/workspaces/.../image.jpg

# Check CORS
s3cmd info s3://partyquiz-media-production | grep -i cors
```

## Performance Optimization

### CDN (Future Enhancement)
Use Cloudflare CDN in front of Hetzner Object Storage:
1. Add CNAME: `media.partyquiz.com` → `fsn1.your-objectstorage.com`
2. Enable Cloudflare caching for static assets
3. Update `S3_ENDPOINT` to use CDN URL
4. Result: Faster global delivery, reduced Hetzner bandwidth costs

### Image Optimization (Future)
- Add server-side image resizing (Sharp, ImageMagick)
- Generate thumbnails on upload
- Store multiple sizes: `thumb-`, `medium-`, `original-`
- Serve appropriate size based on context

## Database Schema

```prisma
model Asset {
  id          String   @id @default(cuid())
  workspaceId String
  filename    String
  type        String   // IMAGE, AUDIO, VIDEO, OTHER
  storageKey  String   // S3 object key
  mime        String   // MIME type
  size        Int      // bytes
  width       Int?     // for images
  height      Int?     // for images
  duration    Int?     // seconds for audio/video
  createdBy   String
  createdAt   DateTime @default(now())

  workspace Workspace @relation(...)
  creator   User      @relation(...)
}
```

## API Reference

### POST /api/uploads/presign
Generate presigned upload URL

**Request:**
```json
{
  "workspaceId": "cm123...",
  "filename": "party.jpg",
  "contentType": "image/jpeg",
  "size": 1048576,
  "category": "images"
}
```

**Response:**
```json
{
  "assetId": "cm456...",
  "uploadUrl": "https://fsn1.../partyquiz-media/workspaces/.../party.jpg?X-Amz-...",
  "storageKey": "workspaces/cm123/images/1704067200000-a3f7k2-party.jpg",
  "expiresIn": 300
}
```

### POST /api/uploads/[id]/confirm
Confirm successful upload

**Response:**
```json
{
  "success": true,
  "asset": {
    "id": "cm456...",
    "filename": "party.jpg",
    "storageKey": "workspaces/.../party.jpg",
    "url": "https://..."
  }
}
```

### GET /api/workspaces/[id]/assets
List workspace assets

**Query Params:**
- `type`: Filter by IMAGE, AUDIO, VIDEO, OTHER
- `cursor`: Pagination cursor (optional)
- `limit`: Items per page (default: 20, max: 100)

**Response:**
```json
{
  "assets": [
    {
      "id": "cm456...",
      "filename": "party.jpg",
      "type": "IMAGE",
      "mime": "image/jpeg",
      "size": 1048576,
      "url": "https://...",
      "createdAt": "2024-01-01T00:00:00Z",
      "creator": {
        "id": "cm789...",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ],
  "nextCursor": "cm460...",
  "hasMore": true
}
```

## Costs

**Hetzner Object Storage Pricing** (as of 2024):
- **Storage**: €0.0045/GB/month (~€4.50 for 1TB)
- **Traffic**: €1/GB (free up to 1TB/month)
- **Requests**: Included

**Example calculation** (100 quizzes, 50 images each):
- Storage: 5,000 images × 500KB = 2.5GB = €0.01/month
- Traffic: 1,000 players/month × 50 images × 500KB = 25GB = FREE (under 1TB)
- **Total**: ~€0.01/month

**Way cheaper than AWS S3!** 🎉

---

**Questions?** Check the [Hetzner Object Storage docs](https://docs.hetzner.com/storage/object-storage/) or open an issue.
