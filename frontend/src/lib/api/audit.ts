/**
 * Government-Standard Audit Logging Service
 * 
 * Features:
 * - Immutable audit trail
 * - Complete context capture (who, what, when, where, why)
 * - Session tracking
 * - Request correlation
 * - Before/after change tracking
 * - Severity levels
 * - Outcome tracking
 * - IP address and user agent logging
 * - Export capabilities
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { randomUUID } from 'crypto';

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AuditOutcome = 'success' | 'failure' | 'partial' | 'pending';

export interface AuditContext {
  userId: string;
  sessionId?: string;
  requestId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  vaultType?: 'account' | 'my_vault' | 'family_vault';
  vaultId?: string;
  vaultItemId?: string;
  familyMemberId?: string;
  myVaultMemberId?: string;
  nomineeId?: string;
}

export interface AuditEvent {
  action: string;
  description?: string;
  severity?: AuditSeverity;
  outcome?: AuditOutcome;
  metadata?: Record<string, any>;
  beforeState?: Record<string, any>; // State before change
  afterState?: Record<string, any>; // State after change
  errorMessage?: string;
  errorCode?: string;
  durationMs?: number; // Operation duration in milliseconds
}

/**
 * Extract audit context from request
 */
export function extractAuditContext(req: NextRequest, userId: string, additionalContext?: Partial<AuditContext>): AuditContext {
  const sessionId = req.headers.get('x-session-id') || undefined;
  const requestId = req.headers.get('x-request-id') || randomUUID();
  
  return {
    userId,
    sessionId,
    requestId,
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               req.headers.get('x-real-ip') || 
               null,
    userAgent: req.headers.get('user-agent') || null,
    ...additionalContext,
  };
}

/**
 * Create an audit log entry
 * This is the main function to use for logging audit events
 */
export async function createAuditLog(
  context: AuditContext,
  event: AuditEvent
): Promise<void> {
  try {
    const now = new Date();
    
    // Build comprehensive metadata
    const auditMetadata: Record<string, any> = {
      ...event.metadata,
      severity: event.severity || 'info',
      outcome: event.outcome || 'success',
      timestamp: now.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    // Add before/after state if provided
    if (event.beforeState) {
      auditMetadata.beforeState = event.beforeState;
    }
    if (event.afterState) {
      auditMetadata.afterState = event.afterState;
    }

    // Add error information if present
    if (event.errorMessage) {
      auditMetadata.error = {
        message: event.errorMessage,
        code: event.errorCode,
      };
    }

    // Add performance metrics if available
    if (event.durationMs !== undefined) {
      auditMetadata.performance = {
        durationMs: event.durationMs,
      };
    }

    // Add session and request tracking
    if (context.sessionId) {
      auditMetadata.sessionId = context.sessionId;
    }
    if (context.requestId) {
      auditMetadata.requestId = context.requestId;
    }

    await prisma.activityLog.create({
      data: {
        userId: context.userId,
        familyMemberId: context.familyMemberId || null,
        myVaultMemberId: context.myVaultMemberId || null,
        vaultType: context.vaultType || 'account',
        myVaultId: context.vaultType === 'my_vault' ? context.vaultId : null,
        familyVaultId: context.vaultType === 'family_vault' ? context.vaultId : null,
        vaultItemId: context.vaultItemId || null,
        action: event.action,
        description: event.description || null,
        ipAddress: context.ipAddress || null,
        userAgent: context.userAgent || null,
        metadata: auditMetadata,
        createdAt: now,
      },
    });
  } catch (error) {
    // Never fail the main operation due to audit logging failure
    // But log it to console for monitoring
    console.error('Failed to create audit log:', error);
    console.error('Audit context:', JSON.stringify(context, null, 2));
    console.error('Audit event:', JSON.stringify(event, null, 2));
  }
}

/**
 * Log a security event (login, logout, password changes, etc.)
 */
export async function logSecurityEvent(
  context: AuditContext,
  action: string,
  outcome: AuditOutcome,
  details?: {
    description?: string;
    errorMessage?: string;
    errorCode?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  await createAuditLog(context, {
    action,
    description: details?.description,
    severity: outcome === 'failure' ? 'error' : 'info',
    outcome,
    errorMessage: details?.errorMessage,
    errorCode: details?.errorCode,
    metadata: {
      eventType: 'security',
      ...details?.metadata,
    },
  });
}

/**
 * Log a data access event (view, download, etc.)
 */
export async function logDataAccess(
  context: AuditContext,
  action: string,
  resourceType: string,
  resourceId: string,
  details?: {
    description?: string;
    outcome?: AuditOutcome;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  await createAuditLog(context, {
    action,
    description: details?.description || `${resourceType} accessed`,
    severity: 'info',
    outcome: details?.outcome || 'success',
    metadata: {
      eventType: 'data_access',
      resourceType,
      resourceId,
      ...details?.metadata,
    },
  });
}

/**
 * Log a data modification event (create, update, delete)
 */
export async function logDataModification(
  context: AuditContext,
  action: string,
  resourceType: string,
  resourceId: string,
  details?: {
    description?: string;
    beforeState?: Record<string, any>;
    afterState?: Record<string, any>;
    outcome?: AuditOutcome;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  await createAuditLog(context, {
    action,
    description: details?.description || `${resourceType} modified`,
    severity: 'info',
    outcome: details?.outcome || 'success',
    beforeState: details?.beforeState,
    afterState: details?.afterState,
    metadata: {
      eventType: 'data_modification',
      resourceType,
      resourceId,
      ...details?.metadata,
    },
  });
}

/**
 * Log a configuration change (settings, permissions, etc.)
 */
export async function logConfigurationChange(
  context: AuditContext,
  action: string,
  configType: string,
  details?: {
    description?: string;
    beforeState?: Record<string, any>;
    afterState?: Record<string, any>;
    outcome?: AuditOutcome;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  await createAuditLog(context, {
    action,
    description: details?.description || `${configType} configuration changed`,
    severity: 'warning', // Configuration changes are typically more sensitive
    outcome: details?.outcome || 'success',
    beforeState: details?.beforeState,
    afterState: details?.afterState,
    metadata: {
      eventType: 'configuration',
      configType,
      ...details?.metadata,
    },
  });
}

/**
 * Log an error event
 */
export async function logError(
  context: AuditContext,
  action: string,
  error: Error | string,
  details?: {
    description?: string;
    errorCode?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorStack = typeof error === 'string' ? undefined : error.stack;

  await createAuditLog(context, {
    action,
    description: details?.description || 'Error occurred',
    severity: 'error',
    outcome: 'failure',
    errorMessage,
    errorCode: details?.errorCode,
    metadata: {
      eventType: 'error',
      errorStack,
      ...details?.metadata,
    },
  });
}

/**
 * Create a timer for measuring operation duration
 */
export function createAuditTimer() {
  const startTime = Date.now();
  
  return {
    end: (): number => {
      return Date.now() - startTime;
    },
  };
}

