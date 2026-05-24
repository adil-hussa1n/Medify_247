# Individual Doctor Practice RBAC API

Role-based access control for **individual doctors** (no hospital or diagnostic center affiliation). The practicing doctor is the owner; additional users log in with the `doctor_staff` role.

## Roles

| Role | Description |
|------|-------------|
| `owner` | The doctor account (implicit, not assignable) |
| `admin` | Full access |
| `assistant` | Appointments, serials, prescriptions |
| `receptionist` | Appointments and serials (view) |
| `viewer` | Read-only |
| `custom` | Explicit permission checklist |

## Permissions

`dashboard:view`, `profile:view`, `profile:manage`, `appointments:view`, `appointments:manage`, `schedules:view`, `schedules:manage`, `prescriptions:manage`, `serials:view`, `serials:manage`, `date_serials:view`, `date_serials:manage`, `earnings:view`, `staff:view`, `staff:manage`

## Team management (`/api/doctor-practice`)

Requires `Authorization: Bearer <token>` and role `doctor`, `doctor_staff`, or `super_admin`.

| Method | Path | Permission |
|--------|------|------------|
| GET | `/:doctorId/access` | membership |
| GET | `/:doctorId/permissions` | `staff:view` |
| GET | `/:doctorId/staff` | `staff:view` |
| POST | `/:doctorId/staff` | `staff:manage` |
| PUT | `/:doctorId/staff/:staffId` | `staff:manage` |
| DELETE | `/:doctorId/staff/:staffId` | `staff:manage` |

### Create team member

```json
POST /api/doctor-practice/:doctorId/staff
{
  "name": "Jane Assistant",
  "email": "jane@example.com",
  "phone": "+8801712345678",
  "password": "securepass",
  "role": "assistant",
  "jobTitle": "Front desk"
}
```

Creates a `User` with `role: doctor_staff` and a `DoctorStaff` record.

## Doctor portal (`/api/doctor`)

Portal routes accept `doctor` (owner JWT) or `doctor_staff` (User JWT). Each route checks granular permissions via `doctorPortalGuard`.

Staff log in through `POST /api/auth/login` with their email/password (same as patients/hospital staff).
