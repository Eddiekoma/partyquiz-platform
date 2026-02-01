// ============================================
// RBAC: Role-Based Access Control
// ============================================

export enum WorkspaceRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  EDITOR = "EDITOR",
  CONTRIBUTOR = "CONTRIBUTOR",
  VIEWER = "VIEWER",
}

export enum Permission {
  // Workspace Management
  WORKSPACE_UPDATE = "WORKSPACE_UPDATE",
  WORKSPACE_DELETE = "WORKSPACE_DELETE",
  WORKSPACE_VIEW_AUDIT_LOG = "WORKSPACE_VIEW_AUDIT_LOG",

  // Member Management
  MEMBER_INVITE = "MEMBER_INVITE",
  MEMBER_UPDATE_ROLE = "MEMBER_UPDATE_ROLE",
  MEMBER_REMOVE = "MEMBER_REMOVE",

  // Question Management
  QUESTION_CREATE = "QUESTION_CREATE",
  QUESTION_UPDATE = "QUESTION_UPDATE",
  QUESTION_DELETE = "QUESTION_DELETE",
  QUESTION_VIEW = "QUESTION_VIEW",

  // Quiz Management
  QUIZ_CREATE = "QUIZ_CREATE",
  QUIZ_UPDATE = "QUIZ_UPDATE",
  QUIZ_DELETE = "QUIZ_DELETE",
  QUIZ_VIEW = "QUIZ_VIEW",
  QUIZ_PUBLISH = "QUIZ_PUBLISH",

  // Session Management
  SESSION_CREATE = "SESSION_CREATE",
  SESSION_UPDATE = "SESSION_UPDATE",
  SESSION_HOST = "SESSION_HOST",
  SESSION_DELETE = "SESSION_DELETE",
  SESSION_VIEW_RESULTS = "SESSION_VIEW_RESULTS",

  // Asset Management
  ASSET_UPLOAD = "ASSET_UPLOAD",
  ASSET_DELETE = "ASSET_DELETE",
  ASSET_VIEW = "ASSET_VIEW",

  // Spotify Integration
  SPOTIFY_CONNECT = "SPOTIFY_CONNECT",
  SPOTIFY_DISCONNECT = "SPOTIFY_DISCONNECT",
}

// Permission matrix: which roles have which permissions
const ROLE_PERMISSIONS: Record<WorkspaceRole, Set<Permission>> = {
  [WorkspaceRole.OWNER]: new Set([
    // All permissions
    Permission.WORKSPACE_UPDATE,
    Permission.WORKSPACE_DELETE,
    Permission.WORKSPACE_VIEW_AUDIT_LOG,
    Permission.MEMBER_INVITE,
    Permission.MEMBER_UPDATE_ROLE,
    Permission.MEMBER_REMOVE,
    Permission.QUESTION_CREATE,
    Permission.QUESTION_UPDATE,
    Permission.QUESTION_DELETE,
    Permission.QUESTION_VIEW,
    Permission.QUIZ_CREATE,
    Permission.QUIZ_UPDATE,
    Permission.QUIZ_DELETE,
    Permission.QUIZ_VIEW,
    Permission.QUIZ_PUBLISH,
    Permission.SESSION_CREATE,
    Permission.SESSION_UPDATE,
    Permission.SESSION_HOST,
    Permission.SESSION_DELETE,
    Permission.SESSION_VIEW_RESULTS,
    Permission.ASSET_UPLOAD,
    Permission.ASSET_DELETE,
    Permission.ASSET_VIEW,
    Permission.SPOTIFY_CONNECT,
    Permission.SPOTIFY_DISCONNECT,
  ]),

  [WorkspaceRole.ADMIN]: new Set([
    // All except workspace delete
    Permission.WORKSPACE_UPDATE,
    Permission.WORKSPACE_VIEW_AUDIT_LOG,
    Permission.MEMBER_INVITE,
    Permission.MEMBER_UPDATE_ROLE,
    Permission.MEMBER_REMOVE,
    Permission.QUESTION_CREATE,
    Permission.QUESTION_UPDATE,
    Permission.QUESTION_DELETE,
    Permission.QUESTION_VIEW,
    Permission.QUIZ_CREATE,
    Permission.QUIZ_UPDATE,
    Permission.QUIZ_DELETE,
    Permission.QUIZ_VIEW,
    Permission.QUIZ_PUBLISH,
    Permission.SESSION_CREATE,
    Permission.SESSION_UPDATE,
    Permission.SESSION_HOST,
    Permission.SESSION_DELETE,
    Permission.SESSION_VIEW_RESULTS,
    Permission.ASSET_UPLOAD,
    Permission.ASSET_DELETE,
    Permission.ASSET_VIEW,
    Permission.SPOTIFY_CONNECT,
    Permission.SPOTIFY_DISCONNECT,
  ]),

  [WorkspaceRole.EDITOR]: new Set([
    // Content creation and editing
    Permission.WORKSPACE_VIEW_AUDIT_LOG,
    Permission.QUESTION_CREATE,
    Permission.QUESTION_UPDATE,
    Permission.QUESTION_DELETE,
    Permission.QUESTION_VIEW,
    Permission.QUIZ_CREATE,
    Permission.QUIZ_UPDATE,
    Permission.QUIZ_DELETE,
    Permission.QUIZ_VIEW,
    Permission.QUIZ_PUBLISH,
    Permission.SESSION_CREATE,
    Permission.SESSION_UPDATE,
    Permission.SESSION_HOST,
    Permission.SESSION_VIEW_RESULTS,
    Permission.ASSET_UPLOAD,
    Permission.ASSET_DELETE,
    Permission.ASSET_VIEW,
    Permission.SPOTIFY_CONNECT,
  ]),

  [WorkspaceRole.CONTRIBUTOR]: new Set([
    // Create content but not delete
    Permission.QUESTION_CREATE,
    Permission.QUESTION_UPDATE,
    Permission.QUESTION_VIEW,
    Permission.QUIZ_CREATE,
    Permission.QUIZ_UPDATE,
    Permission.QUIZ_VIEW,
    Permission.SESSION_CREATE,
    Permission.SESSION_UPDATE,
    Permission.SESSION_HOST,
    Permission.SESSION_VIEW_RESULTS,
    Permission.ASSET_UPLOAD,
    Permission.ASSET_VIEW,
  ]),

  [WorkspaceRole.VIEWER]: new Set([
    // Read-only access
    Permission.QUESTION_VIEW,
    Permission.QUIZ_VIEW,
    Permission.SESSION_VIEW_RESULTS,
    Permission.ASSET_VIEW,
  ]),
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  role: WorkspaceRole,
  permission: Permission
): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/**
 * Check if a role has ANY of the specified permissions
 */
export function hasAnyPermission(
  role: WorkspaceRole,
  permissions: Permission[]
): boolean {
  return permissions.some((perm) => hasPermission(role, perm));
}

/**
 * Check if a role has ALL of the specified permissions
 */
export function hasAllPermissions(
  role: WorkspaceRole,
  permissions: Permission[]
): boolean {
  return permissions.every((perm) => hasPermission(role, perm));
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: WorkspaceRole): Permission[] {
  return Array.from(ROLE_PERMISSIONS[role] ?? []);
}

/**
 * Check if a role is at least a certain level
 */
export function hasRoleLevel(
  role: WorkspaceRole,
  minimumRole: WorkspaceRole
): boolean {
  const hierarchy = [
    WorkspaceRole.VIEWER,
    WorkspaceRole.CONTRIBUTOR,
    WorkspaceRole.EDITOR,
    WorkspaceRole.ADMIN,
    WorkspaceRole.OWNER,
  ];

  const roleLevel = hierarchy.indexOf(role);
  const minimumLevel = hierarchy.indexOf(minimumRole);

  return roleLevel >= minimumLevel;
}

// ============================================
// Audit Actions & Entity Types
// ============================================

export enum AuditAction {
  // Workspace
  WORKSPACE_CREATED = "WORKSPACE_CREATED",
  WORKSPACE_UPDATED = "WORKSPACE_UPDATED",
  WORKSPACE_DELETED = "WORKSPACE_DELETED",

  // Members
  MEMBER_INVITED = "MEMBER_INVITED",
  MEMBER_JOINED = "MEMBER_JOINED",
  MEMBER_ROLE_UPDATED = "MEMBER_ROLE_UPDATED",
  MEMBER_REMOVED = "MEMBER_REMOVED",

  // Questions
  QUESTION_CREATED = "QUESTION_CREATED",
  QUESTION_UPDATED = "QUESTION_UPDATED",
  QUESTION_DELETED = "QUESTION_DELETED",

  // Quizzes
  QUIZ_CREATED = "QUIZ_CREATED",
  QUIZ_UPDATED = "QUIZ_UPDATED",
  QUIZ_DELETED = "QUIZ_DELETED",
  QUIZ_PUBLISHED = "QUIZ_PUBLISHED",

  // Sessions
  SESSION_CREATED = "SESSION_CREATED",
  SESSION_STARTED = "SESSION_STARTED",
  SESSION_ENDED = "SESSION_ENDED",
  SESSION_DELETED = "SESSION_DELETED",

  // Assets
  ASSET_UPLOADED = "ASSET_UPLOADED",
  ASSET_DELETED = "ASSET_DELETED",

  // Spotify
  SPOTIFY_CONNECTED = "SPOTIFY_CONNECTED",
  SPOTIFY_DISCONNECTED = "SPOTIFY_DISCONNECTED",

  // Data Management
  DATA_EXPORTED = "DATA_EXPORTED",
  DATA_IMPORTED = "DATA_IMPORTED",
}

export enum EntityType {
  WORKSPACE = "WORKSPACE",
  MEMBER = "MEMBER",
  QUESTION = "QUESTION",
  QUIZ = "QUIZ",
  SESSION = "SESSION",
  ASSET = "ASSET",
  SPOTIFY = "SPOTIFY",
}
