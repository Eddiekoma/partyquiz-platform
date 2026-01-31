import { WorkspaceRole } from "./types";

// Permission matrix
export const PERMISSIONS = {
  // Workspace permissions
  WORKSPACE_DELETE: [WorkspaceRole.OWNER],
  WORKSPACE_UPDATE: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
  WORKSPACE_VIEW: [
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.EDITOR,
    WorkspaceRole.CONTRIBUTOR,
    WorkspaceRole.VIEWER,
  ],

  // Member permissions
  MEMBER_INVITE: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
  MEMBER_REMOVE: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
  MEMBER_UPDATE_ROLE: [WorkspaceRole.OWNER],

  // Question permissions
  QUESTION_CREATE: [
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.EDITOR,
    WorkspaceRole.CONTRIBUTOR,
  ],
  QUESTION_UPDATE: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR],
  QUESTION_DELETE: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR],
  QUESTION_VIEW: [
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.EDITOR,
    WorkspaceRole.CONTRIBUTOR,
    WorkspaceRole.VIEWER,
  ],

  // Quiz permissions
  QUIZ_CREATE: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR],
  QUIZ_UPDATE: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR],
  QUIZ_DELETE: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
  QUIZ_PUBLISH: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],

  // Session permissions
  SESSION_CREATE: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
  SESSION_HOST: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
  SESSION_VIEW: [
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.EDITOR,
    WorkspaceRole.CONTRIBUTOR,
    WorkspaceRole.VIEWER,
  ],

  // Media permissions
  MEDIA_UPLOAD: [
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.EDITOR,
    WorkspaceRole.CONTRIBUTOR,
  ],
  MEDIA_DELETE: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: WorkspaceRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly WorkspaceRole[]).includes(role);
}

export function requirePermission(role: WorkspaceRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Permission denied: ${permission} requires ${PERMISSIONS[permission].join(", ")}`);
  }
}
