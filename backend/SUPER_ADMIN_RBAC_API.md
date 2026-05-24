# Super Admin RBAC API

Platform administrators use granular role-based access control. The primary **super admin** (owner) has full access. Delegated **admin staff** (`super_admin_staff` role) receive permissions via team membership.

## Authentication

Login via `POST /api/auth/login`. Response includes `adminAccess` for `super_admin` and `super_admin_staff`:

```json
{
  "adminAccess": {
    "role": "support",
    "roleLabel": "Support Agent",
    "permissions": ["dashboard:view", "users:view", "..."],
    "isOwner": false
  }
}
```

## Roles

| Role | Description |
|------|-------------|
| `owner` | Full access (seed super admin only, not assignable) |
| `admin` | Nearly full access (no `team:manage`) |
| `support` | Dashboard, approvals, users, doctors view, activity logs |
| `moderator` | Approvals, users/doctors/hospitals/DC view, doctor manage |
| `content_manager` | Banners and broadcast notifications |
| `viewer` | Read-only across view permissions |
| `custom` | Hand-picked permission list |

## Permissions

| Permission | Grants access to |
|------------|------------------|
| `dashboard:view` | Stats, user growth, recent registrations |
| `approvals:view` | List pending items |
| `approvals:manage` | Approve/reject doctors, hospitals, diagnostic centers |
| `users:view` / `users:manage` | Patient user list / edit / delete |
| `doctors:view` / `doctors:manage` | Doctor list / edit / delete |
| `hospitals:view` / `hospitals:manage` | Hospital CRUD |
| `diagnostic_centers:view` / `diagnostic_centers:manage` | Diagnostic center CRUD |
| `banners:view` / `banners:manage` | Banner management |
| `notifications:broadcast` | Broadcast notifications |
| `activity_logs:view` | Activity logs |
| `export:data` | Data export |
| `team:view` / `team:manage` | Admin team list / add, edit, remove |

## Team endpoints

All require `Authorization: Bearer <token>` and role `super_admin` or `super_admin_staff`.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/admin/team/access` | — | Current user's permissions |
| GET | `/api/admin/team/permissions` | `team:view` | Permission catalog & role templates |
| GET | `/api/admin/team` | `team:view` | List owners + staff |
| POST | `/api/admin/team` | `team:manage` | Add staff member |
| PUT | `/api/admin/team/:staffId` | `team:manage` | Update role/permissions/status |
| DELETE | `/api/admin/team/:staffId` | `team:manage` | Remove staff member |

### Create team member

```http
POST /api/admin/team
Content-Type: application/json

{
  "name": "Jane Support",
  "email": "jane@medify247.com",
  "phone": "+8801712345678",
  "password": "securepass123",
  "role": "support",
  "jobTitle": "Support Agent"
}
```

For `custom` role, include `permissions` array with valid permission keys.

## Bootstrap

Create the owner account:

```bash
cd backend && npm run seed
```

Default: `admin@medify247.com` / `admin123` with role `super_admin`.
