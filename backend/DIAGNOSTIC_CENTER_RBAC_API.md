# Diagnostic Center RBAC API

Role-based access control for diagnostic center admins. Mirrors the hospital RBAC pattern.

## Roles

| Role | Description |
|------|-------------|
| `owner` | Center creator; full access; cannot be removed |
| `admin` | Full access (assigned to legacy `admins[]` on first login) |
| `manager` | Operations: tests, orders, home services, doctors |
| `lab_staff` | Tests, orders, test serials |
| `receptionist` | Home services, requests, serials, orders (view) |
| `viewer` | Read-only (`*:view` permissions) |
| `custom` | Explicit permission list |

## Staff endpoints

All routes require `Authorization: Bearer <token>` and role `diagnostic_center_admin` (or `super_admin`).

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/diagnostic-centers/:centerId/access` | membership |
| GET | `/api/diagnostic-centers/:centerId/permissions` | `staff:view` |
| GET | `/api/diagnostic-centers/:centerId/staff` | `staff:view` |
| POST | `/api/diagnostic-centers/:centerId/staff` | `staff:manage` |
| PUT | `/api/diagnostic-centers/:centerId/staff/:staffId` | `staff:manage` |
| DELETE | `/api/diagnostic-centers/:centerId/staff/:staffId` | `staff:manage` |

### Create staff body

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+8801...",
  "password": "securepass",
  "role": "receptionist",
  "jobTitle": "Front desk",
  "permissions": []
}
```

Use `permissions` only when `role` is `custom`.

## Permission keys

- `dashboard:view`, `profile:view`, `profile:manage`
- `tests:view`, `tests:manage`, `test_serials:view`, `test_serials:manage`
- `orders:view`, `orders:manage`
- `home_services:view`, `home_services:manage`
- `home_requests:view`, `home_requests:manage`
- `home_serials:view`, `home_serials:manage`
- `doctors:view`, `doctors:manage`
- `staff:view`, `staff:manage`

## Legacy migration

On first authenticated request, users in `diagnosticCenter.admins[]` or `userId` (owner) receive an auto-created `DiagnosticCenterStaff` record.

## User profile

`GET /api/users/:id` includes `diagnosticCenterAccess`:

```json
{
  "centerId": "...",
  "role": "manager",
  "roleLabel": "Manager",
  "permissions": ["dashboard:view", "tests:view", ...],
  "isOwner": false
}
```
