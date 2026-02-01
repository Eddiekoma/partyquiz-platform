# Workspace Branding Implementation

## ✅ Completed (M1.1 - M1.3)

### 1. Database Schema (M1.1) ✅

**File**: `apps/web/prisma/schema.prisma`

Added two new fields to the `Workspace` model:
- `logo String?` - URL to uploaded logo image (stored in S3)
- `themeColor String?` - Hex color code for brand theme (e.g., "#3B82F6")

**Migration**: `apps/web/prisma/migrations/20240115000000_add_workspace_branding/migration.sql`
```sql
ALTER TABLE "Workspace" 
  ADD COLUMN "logo" TEXT,
  ADD COLUMN "themeColor" TEXT;
```

⚠️ **Note**: Migration needs to be applied when database is running. Requires Docker/PostgreSQL running locally or in deployment.

---

### 2. API Endpoints (M1.2) ✅

**File**: `apps/web/src/app/api/workspaces/[id]/branding/route.ts`

#### GET /api/workspaces/[id]/branding
Returns workspace branding configuration:
```json
{
  "workspace": {
    "id": "cuid123",
    "name": "My Workspace",
    "logo": "https://s3.example.com/logos/workspace-logo.png",
    "themeColor": "#3B82F6"
  }
}
```

#### PATCH /api/workspaces/[id]/branding
Updates workspace branding:
```json
{
  "logo": "https://s3.example.com/logos/new-logo.png",
  "themeColor": "#10B981"
}
```

**Features**:
- ✅ Authentication required (NextAuth session)
- ✅ Permission check (WORKSPACE_UPDATE - Owner/Admin only)
- ✅ Zod validation (hex color regex `/^#[0-9A-Fa-f]{6}$/`, URL format)
- ✅ Audit logging (creates AuditLog entry)
- ✅ Error handling (400 validation, 401 unauthorized, 403 forbidden, 404 not found, 500 server error)

⚠️ **Note**: Has TypeScript errors until Prisma client is regenerated after schema changes.

---

### 3. Settings UI (M1.3) ✅

**File**: `apps/web/src/app/dashboard/workspaces/[id]/branding/page.tsx`

**Route**: `/dashboard/workspaces/[id]/branding`

#### Features Implemented:

**Logo Upload Section**:
- ✅ MediaLibrary integration for S3 upload
- ✅ Image preview (200x200px with border)
- ✅ "Remove Logo" button
- ✅ "Change Logo" / "Upload Logo" buttons
- ✅ Modal overlay for MediaLibrary

**Theme Color Picker**:
- ✅ HTML5 color input (`<input type="color">`)
- ✅ Hex code text input with validation (`/^#[0-9A-Fa-f]{0,6}$/`)
- ✅ 5 preset color swatches: Blue (#3B82F6), Purple (#8B5CF6), Green (#10B981), Amber (#F59E0B), Red (#EF4444)
- ✅ Live color preview

**Live Preview Mockup**:
- ✅ Player lobby mockup with gradient background
- ✅ Logo display (or placeholder if not set)
- ✅ Session code display (DEMO123)
- ✅ Mock player list (Alice, Bob, Charlie)
- ✅ Theme color applied via gradient

**Form Handling**:
- ✅ Optimistic UI updates
- ✅ Success/error alerts
- ✅ Loading states (disabled buttons while saving)
- ✅ API call to PATCH /api/workspaces/[id]/branding
- ✅ Auto-refresh after save

**Navigation**:
- ✅ Back button to workspace dashboard
- ✅ Cancel button
- ✅ Save button

---

## ⏸️ Pending (M1.4)

### 4. Apply Branding to Live Screens

Need to inject `workspace.logo` and `workspace.themeColor` into the following pages:

#### a) Player Lobby Page
**File**: `apps/web/src/app/(player)/play/[code]/lobby/page.tsx`

**Changes Needed**:
1. Fetch workspace data via session API (add workspace include to session response)
2. Replace hardcoded gradient with `workspace.themeColor` gradient
3. Add workspace logo at the top (with fallback to PartyQuiz logo)
4. Use CSS variables: `style={{ '--brand-color': workspace.themeColor }}`

**Before**:
```tsx
<div className="bg-gradient-to-br from-blue-600 to-purple-600">
```

**After**:
```tsx
<div style={{ 
  background: `linear-gradient(135deg, ${workspace.themeColor || '#3B82F6'} 0%, ${workspace.themeColor || '#3B82F6'}dd 100%)` 
}}>
  {workspace.logo && (
    <img src={workspace.logo} alt="Logo" className="h-16 mb-4" />
  )}
</div>
```

---

#### b) Host Session View
**File**: `apps/web/src/app/(app)/workspaces/[id]/sessions/[sessionId]/page.tsx`

**Changes Needed**:
1. Fetch workspace branding in session page
2. Apply theme color to host control panel header
3. Show workspace logo in corner

---

#### c) Leaderboard Screen
**File**: TBD (might be part of SessionControl.tsx or separate component)

**Changes Needed**:
1. Apply workspace theme color to leaderboard background
2. Show workspace logo at top
3. Use brand color for podium highlights

---

## Implementation Steps for M1.4

```bash
# Step 1: Update Session API to include workspace branding
# File: apps/web/src/app/api/sessions/[id]/route.ts
# Add: include: { workspace: { select: { logo: true, themeColor: true } } }

# Step 2: Update Player Lobby
# File: apps/web/src/app/(player)/play/[code]/lobby/page.tsx
# Fetch workspace branding from session state
# Apply theme color gradient
# Add logo display

# Step 3: Update Host View
# File: apps/web/src/app/(app)/workspaces/[id]/sessions/[sessionId]/page.tsx
# Apply theme color to header
# Add logo display

# Step 4: Create/Update Leaderboard Component
# Apply branding to leaderboard
```

---

## Technical Notes

### When Database Is Running:
1. Run migration: `cd apps/web && pnpm prisma migrate dev --name add-workspace-branding`
2. Generate Prisma client: `pnpm prisma generate`
3. TypeScript errors in API route will resolve
4. Test branding page: Navigate to `/dashboard/workspaces/[id]/branding`

### Default Values:
- **Default logo**: None (or PartyQuiz logo as fallback in UI)
- **Default theme color**: `#3B82F6` (blue)

### S3 Storage:
- Logo images uploaded via MediaLibrary go to Hetzner S3
- Presigned URLs used for secure access
- URLs stored in `workspace.logo` field

### Audit Trail:
Every branding update creates an `AuditLog` entry:
```json
{
  "action": "workspace.branding.updated",
  "entityType": "workspace",
  "entityId": "workspace_id",
  "payloadJson": {
    "logo": "https://...",
    "themeColor": "#3B82F6"
  }
}
```

---

## Testing Checklist (Once DB is running)

- [ ] Run migration successfully
- [ ] Navigate to `/dashboard/workspaces/[id]/branding`
- [ ] Upload logo via MediaLibrary
- [ ] Change theme color with picker
- [ ] Save branding (check success message)
- [ ] Verify branding saved in database
- [ ] Check audit log created
- [ ] Test color validation (invalid hex codes rejected)
- [ ] Test permission (only owner/admin can update)
- [ ] Preview mockup updates in real-time
- [ ] Apply branding to player lobby (M1.4)
- [ ] Apply branding to host view (M1.4)
- [ ] Apply branding to leaderboard (M1.4)

---

## Completion Status

| Task | Status | File(s) Created/Modified | Notes |
|------|--------|-------------------------|-------|
| M1.1 Schema | ✅ Done | `schema.prisma`, migration SQL | Needs DB to apply |
| M1.2 API | ✅ Done | `/api/workspaces/[id]/branding/route.ts` | Needs Prisma regen |
| M1.3 Settings UI | ✅ Done | `/dashboard/workspaces/[id]/branding/page.tsx` | Complete with preview |
| M1.4 Apply Branding | ⏸️ Next | Player lobby, Host view, Leaderboard | Inject theme + logo |

**Time Invested**: ~1.5 hours  
**Estimated Remaining (M1.4)**: 30-45 minutes  
**Total Branding Feature**: ~2-2.5 hours
