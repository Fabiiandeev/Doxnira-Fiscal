# FIN-00 Permissions

## Overview
Permissions govern access to financial and fiscal operations. Access is role‑based and enforced at the route level using a `viewerForbidden` middleware. This document maps roles, permissions, and enforcement points.

## Role Definitions
| Role | Description | Permissions |
|------|-------------|-------------|
| **Admin** | Full system administrator | All financial and fiscal operations; can modify schemas, run migrations, manage users. |
| **Accountant** | Handles accounting and financial processing | Create, read, update, delete Payable, Receivable, FinancialTransaction; view financial reports; generate payables. |
| **Operator** | Executes operational tasks | Create, read, update fiscal documents (NfeDocument, NfeEntry, CteEntry); view audit logs; trigger validations. |
| **Viewer** | Read‑only access | Read‑only access to all financial and fiscal models; cannot modify data. |
| **PlatformAdmin** | Platform‑level administrator | Manage users, roles, and system configuration; run migrations; manage infrastructure. |
| **PlatformSuperAdmin** | Super‑administrator | Full system control; can perform any operation, including administrative tasks. |

## Permission Matrix
| Operation | Allowed Roles (via `viewerForbidden`) | Middleware Check | Status |
|-----------|--------------------------------------|------------------|
| **Create Payable** | Admin, Accountant | `viewerForbidden` with whitelist `["Admin", "Accountant"]` | EXISTS |
| **Update Payable** | Admin, Accountant | `viewerForbidden` with whitelist `["Admin", "Accountant"]` | EXISTS |
| **Delete Payable** | Admin | `viewerForbidden` with whitelist `["Admin"]` | EXISTS |
| **Generate Payables from NFe** | Admin, Operator | `viewerForbidden` with whitelist `["Admin", "Operator"]` | EXISTS |
| **Create Receivable** | Admin, Accountant | `viewerForbidden` with whitelist `["Admin", "Accountant"]` | EXISTS |
| **Create NfeDocument** | Operator, PlatformAdmin, PlatformSuperAdmin | `viewerForbidden` with whitelist `["Operator", "PlatformAdmin", "PlatformSuperAdmin"]` | EXISTS |
| **Create CteEntry** | Operator, PlatformAdmin, PlatformSuperAdmin | `viewerForbidden` with whitelist `["Operator", "PlatformAdmin", "PlatformSuperAdmin"]` | EXISTS |
| **Allocate Freight** | Operator, PlatformAdmin, PlatformSuperAdmin | `viewerForbidden` with whitelist `["Operator", "PlatformAdmin", "PlatformSuperAdmin"]` | EXISTS |
| **View AuditLog** | Admin, Accountant, Operator, Viewer | `viewerForbidden` with whitelist `["Admin", "Accountant", "Operator", "Viewer"]` | EXISTS |
| **Run Migration** | PlatformAdmin, PlatformSuperAdmin | `viewerForbidden` with whitelist `["PlatformAdmin", "PlatformSuperAdmin"]` | EXISTS |
| **Access API Routes** | All roles (subject to `viewerForbidden`) | `viewerForbidden` middleware checks `UserRole` against allowed roles per endpoint. | EXISTS |

## Enforcement Mechanism
1. **Middleware (`viewerForbidden`)**  
   - Executes before any route handler.  
   - Checks `req.user.role` against a whitelist defined per endpoint (`allowedRoles`).  
   - If the role is not permitted, throws `ViewerForbiddenError` (HTTP 403).  

2. **Role Service (`UserRole` enum)**  
   - Defined in `prisma/schema.prisma` as an enum.  
   - Values: `OWNER`, `ADMIN`, `ACCOUNTANT`, `OPERATOR`, `VIEWER`, `PLATFORM_ADMIN`, `PLATFORM_SUPER_ADMIN`.  
   - Populated in the `User` model via a default role (`VIEWER`).  

3. **Permission Checks in Services**  
   - Mutating operations rely on `viewerForbidden` middleware for access control; there is no `requireRole` function in the codebase.  
   - If the check fails, an `AppError` (or `ViewerForbiddenError`) is thrown with a clear message.  

4. **Frontend Guard**  
   - `permissions-provider.tsx` consumes the `UserRole` from the auth context and renders UI components conditionally.  
   - Routes that require elevated permissions are wrapped with `<RequireRole role="Admin">` etc., but the underlying enforcement is still performed by `viewerForbidden`.  

## Role Assignment Workflow
1. **User Creation** – Admin creates a user record; default role is `VIEWER`.  
2. **Role Promotion** – Admin updates `UserRole` via admin UI or direct DB edit.  
3. **Permission Review** – Admin or PlatformAdmin reviews the promotion request.  
4. **Audit Logging** – Every role change writes an `AuditLog` entry with `action: 'ROLE_CHANGE'`.  

## Validation Checklist
- [ ] Run `pnpm lint` – no lint errors.  
- [ ] Run `pnpm typecheck` – no TypeScript errors.  
- [ ] Verify `viewerForbidden` middleware rejects unauthorized roles.  
- [ ] Confirm `UserRole` enum values match allowed roles in middleware.  
- [ ] Ensure all mutating API routes are protected by `viewerForbidden`.  
- [ ] Test frontend permission rendering with each role.  

---  
*End of document.*