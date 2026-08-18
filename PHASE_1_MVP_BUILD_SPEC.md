# Medify247 — Phase 1 MVP Build Specification (Corrected & Upgraded)

> **Last Updated**: 2026-08-18
> **Status**: Corrected against live codebase — reconciled spec vs. reality

Use this as a single prompt for an AI coding agent to scaffold or refactor the project. This document deliberately tells the agent what **not** to build yet — that restraint is the point, not a gap. Keep future phases in separate docs (`PHASE_2_PAYMENTS.md`, `PHASE_3_TELEMEDICINE.md`, `PHASE_4_MOBILE.md`) so the agent never sees 40 future features and decides to scaffold half of them.

---

## 1. Project Vision & Philosophy

Medify247 is a multi-tenant healthcare SaaS platform for South Asian medical ecosystems, unifying Patients, Doctors, Hospitals, and Diagnostic Centers under a Super Admin governance layer.

**Simplicity wins over completeness.** Build the smallest complete healthcare workflow first. Do not build infrastructure for hypothetical features. Every feature must justify its complexity by solving a real, current user problem — not a future one.

> [!IMPORTANT]
> **Corrections Applied**: The original spec contained 28 schema models and several subsystems that directly contradict the "simplicity first" philosophy. This revision trims back to the 18 collections that Phase 1 actually needs (including the new `SerialCounter` and `AuditLog`) and identifies 13 pre-ship gaps (4 critical, 4 high, 5 medium) in the current codebase that must be fixed before shipping.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 7, React Router v7, Axios |
| **UI System** | Glassmorphism design system (vanilla CSS, CSS variables) |
| **Backend** | Node.js (ES Modules), Express 4 |
| **Database** | MongoDB Atlas, Mongoose 8 |
| **Real-time** | Socket.IO (room-scoped: `user-{id}`, `hospital-{id}`, `center-{id}`) |
| **Auth** | JWT + bcryptjs |
| **File Storage** | Multer (local staging) → Cloudinary CDN |
| **PDF Generation** | PDFKit |
| **Deployment** | Vercel (frontend), single Dockerized backend on Render or Hostinger VPS |

> [!WARNING]
> **Bcrypt Salt Factor**: The spec states salt factor 10, but the codebase uses factor 12 in both `User.model.js` and `Doctor.model.js`. **Pick one and enforce it everywhere.** Recommendation: standardize on 12 (the current implementation) — it's marginally more secure and already deployed. Update the spec to match, not the other way around.

---

## 3. User Roles & Authorization Model

Keep this simple — no complex permission matrix in Phase 1.

### 3.1 Role Distribution

| Collection | Roles |
|---|---|
| **`User`** | `patient`, `hospital_admin`, `diagnostic_center_admin`, `super_admin`, `super_admin_staff` |
| **`Doctor`** | `doctor`, `doctor_staff` |

> [!CAUTION]
> **Current Bug**: The `User.role` enum includes `doctor` and `doctor_staff`, but the architectural intent is that doctors live exclusively in the `Doctor` collection. The `User.role` enum should contain only: `patient`, `hospital_admin`, `diagnostic_center_admin`, `super_admin`, `super_admin_staff`. Remove `doctor` and `doctor_staff` from the `User` model enum to prevent accidental misrouting in the auth middleware.

### 3.2 Staff Roles (Predefined, Not Configurable)

| Institution Type | Staff Roles |
|---|---|
| Hospital | `admin`, `receptionist`, `staff` |
| Diagnostic Center | `admin`, `lab_staff`, `receptionist` |
| Doctor Practice | `assistant` |

### 3.3 Registration Rules

- **Patient**: phone, password, name — no KYC, no per-institution registration. **A patient has exactly one account across the whole platform**, regardless of how many institutions they interact with.
- **Doctor / Hospital / Diagnostic Center**: registration goes through Super Admin approval queue (`status: pending_super_admin → approved`).

---

## 4. Multi-Tenant Isolation

- Every institutional resource (`Test`, `Order`, `Appointment`, `HospitalStaff`) carries an indexed `hospitalId` or `diagnosticCenterId`.
- `hospitalGuard` / `diagnosticCenterGuard` middleware verifies the requester is the tenant owner or an authorized staff member scoped to that exact tenant. Cross-tenant requests return `403`.

> [!CAUTION]
> **Critical Gap — No Integration Tests Exist**: The spec mandates writing tenant guard integration tests *before building anything else*. The current codebase has **zero test files** — no `test/`, no `__tests__/`, no test runner in `package.json`. A guard bug here is a patient-data leak. This is the **#1 priority fix** in this revised spec.

### 4.1 Tenant Guard Contract

```
Request Flow:
  authenticate(JWT) → extract user identity
  → hospitalGuard(requiredPermission) → extract hospitalId from req.params
  → verify: is user the tenant owner OR active staff with permission?
  → cross-tenant? → 403 Forbidden
  → authorized? → next()
```

### 4.2 Required Integration Tests (Build First)

- Staff from Hospital A requests data from Hospital B → `403`
- Staff from Hospital A requests data from Hospital A → `200`
- Patient requests their own appointment → `200`
- Patient requests another patient's appointment → `403`
- Diagnostic Center staff accesses Hospital data → `403`
- Deactivated staff member attempts any request → `403`

---

## 5. Serial Booking — Corrected Architecture

> [!WARNING]
> **Critical Design Fix**: The current codebase uses a count-based serial calculation (`existingCount + 1`) with a compound unique index for collision detection. This is **incorrect** — it causes serial reuse after cancellations and race conditions under concurrent load. Replace with atomic monotonic allocation.

### 5.1 Allocation (Corrected)

Atomic, monotonically increasing per (doctor, chamber, date). **Never reused after allocation.**

Create a **dedicated `SerialCounter` collection**. Do not implement the counter as in-memory state or inline mutable controller state.

```js
// SerialCounter model — dedicated collection, one document per (doctor, chamber, date)
const serialCounterSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  chamberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chamber', required: true },
  appointmentDate: { type: Date, required: true },
  lastSerial: { type: Number, default: 0 },
  dailyPatientLimit: { type: Number, required: true }  // copied from Chamber at booking time
});
serialCounterSchema.index({ doctorId: 1, chamberId: 1, appointmentDate: 1 }, { unique: true });
```

### 5.1.1 Atomic Allocation with Daily-Cap Enforcement

The atomic counter operation **must refuse allocation** when `lastSerial >= dailyPatientLimit`. Capacity checking and serial allocation must occur atomically — never as two separate queries:

```js
const counter = await SerialCounter.findOneAndUpdate(
  {
    doctorId,
    chamberId,
    appointmentDate,
    $expr: { $lt: ['$lastSerial', '$dailyPatientLimit'] }  // atomic capacity check
  },
  { $inc: { lastSerial: 1 } },
  {
    upsert: false,  // document must be pre-created with dailyPatientLimit from Chamber
    new: true
  }
);

if (!counter) {
  // Either no counter exists (chamber not set up) or daily limit reached
  throw new AppError('No available serials for this date. The daily patient limit has been reached.', 400);
}

const serialNumber = counter.lastSerial;
```

> [!IMPORTANT]
> The `SerialCounter` document must be pre-created (or upserted with `dailyPatientLimit` from the `Chamber` model) when the first booking for a (doctor, chamber, date) tuple is requested. The `dailyPatientLimit` field is copied from `Chamber.dailyPatientLimit` at counter creation time — it is not re-read on every booking.

Cancellation/rejection releases the **appointment slot**, not the serial number. Gaps in the serial sequence are expected and fine.

### 5.1.2 Appointment Compound Unique Index (Safety Net)

The `SerialCounter` is the normal allocation mechanism. The Appointment compound unique index is the **database invariant / final safety net** — it guarantees that even if the application has a bug, two appointments can never share the same serial for the same (doctor, chamber, date):

```js
// Appointment model — keep this unique index
appointmentSchema.index(
  { doctorId: 1, chamberId: 1, appointmentDate: 1, serialNumber: 1 },
  { unique: true }
);
```

Do **not** remove this index. It is the invariant, not the allocation mechanism.

### 5.2 Serial Number ≠ Queue Position

Expose both, separately:

```
Serial: #25
Patients ahead: 3
Estimated wait: ~45 minutes
```

- **Serial**: permanent, monotonically assigned at booking
- **Patients ahead**: `count(appointments WHERE serial < mySerial AND status IN ('booked'))` — cancelled/rejected/no_show serials don't count
- **Wait time (MVP)**: `patientsAhead × fixedConsultationMinutes` using a fixed per-chamber duration (default: 20 min). No prediction engine.

### 5.3 Indexes Required

```js
// Compound unique index for atomic counter (defined on SerialCounter schema)
SerialCounter: { doctorId: 1, chamberId: 1, appointmentDate: 1 } // unique

// Appointment safety-net unique index (prevents duplicate serials even if app has bugs)
Appointment: { doctorId: 1, chamberId: 1, appointmentDate: 1, serialNumber: 1 } // unique

// Appointment query optimization
Appointment: { doctorId: 1, appointmentDate: 1, status: 1 } // for queue position calc
```

---

## 6. Appointment Status Model

### 6.0 Booking Semantics Decision

> [!IMPORTANT]
> **Does booking itself mean the appointment is confirmed?** This must be explicitly settled.
>
> **Phase 1 answer: Yes.** Booking assigns a serial and the appointment is immediately `BOOKED`. The doctor does not need to manually "accept" ordinary appointment bookings — the serial system handles capacity. If your actual hospitals genuinely need an approval step before confirming appointments, introduce it as an opt-in per-chamber setting in Phase 2 (`Chamber.requireDoctorApproval: Boolean`), not as a default workflow.

### 6.1 Status Transitions

Explicit, backend-enforced transitions only — no arbitrary status changes:

```
BOOKED → COMPLETED
BOOKED → CANCELLED
BOOKED → REJECTED
BOOKED → NO_SHOW
```

```js
// Status enum (simplified from the current 6-state model)
status: {
  type: String,
  enum: ['booked', 'completed', 'cancelled', 'rejected', 'no_show'],
  default: 'booked'
}
```

> [!IMPORTANT]
> **Add a Status Transition Guard**: The current codebase allows arbitrary status changes via `PUT /api/doctor/appointments/:id/status`. Add a transition validation function that checks if `(currentStatus, requestedStatus)` is in the allowed transition map above. Reject invalid transitions with `400 Bad Request`.

> [!NOTE]
> **Migration note**: The current schema uses `pending` and `accepted` states. These must be migrated: `pending → booked`, `accepted → booked`. Existing appointments in those states should be bulk-updated before deploying the new enum.

### 6.2 Payment Status

Schema-ready only for Phase 1 (cash-only):

```js
paymentStatus: {
  type: String,
  enum: ['unpaid', 'paid'],
  default: 'unpaid'
}
```

> [!NOTE]
> The current schema uses `enum: ['pending', 'paid', 'refunded']`. Simplify to `unpaid | paid` for Phase 1 — there's no automated payment to refund under cash-only. Add `refunded` back when online payments ship.

---

## 7. Core MVP Features by Role

### 7.1 Patient

| Feature | Status |
|---|---|
| Register / Login | ✅ Implemented |
| Find doctors (filter: specialty, location, hospital, available today) | ✅ Implemented |
| Find diagnostic tests | ✅ Implemented |
| View doctor profile (name, photo, specialization, qualifications, experience, fee, chamber, availability) | ✅ Implemented |
| Book a serial | ✅ Implemented (⚠️ needs atomic counter fix) |
| View queue position + wait estimate | ❌ **Not Implemented** |
| Cancel appointment | ✅ Implemented |
| Receive in-app appointment reminder | ⚠️ Schema field exists (`reminderSent`), no cron/scheduler implemented |
| View/download prescriptions | ✅ Implemented |
| Book diagnostic test | ✅ Implemented |
| View/download diagnostic report | ✅ Implemented |
| Appointment history | ✅ Implemented |
| Profile management | ✅ Implemented |

### 7.2 Doctor

| Feature | Status |
|---|---|
| Login | ✅ Implemented |
| Today's appointments | ✅ Implemented |
| Manage / reject appointment | ✅ Implemented (⚠️ needs transition guard — booking is now auto-confirmed) |
| Start consultation | ✅ Implemented |
| Enter vitals / diagnosis / medicines | ✅ Implemented |
| Generate prescription PDF | ✅ Implemented |
| View basic patient history | ⚠️ Partial |
| Earnings dashboard | ✅ Implemented |

### 7.3 Hospital

| Feature | Status |
|---|---|
| Register → approval | ✅ Implemented |
| Manage profile | ✅ Implemented |
| Add / link doctors | ✅ Implemented |
| Manage chambers | ✅ Implemented |
| Manage schedules | ✅ Implemented |
| Manage appointments | ✅ Implemented |
| Manage staff | ✅ Implemented |

### 7.4 Diagnostic Center

| Feature | Status |
|---|---|
| Register → approval | ✅ Implemented |
| Manage tests / packages | ✅ Implemented |
| Receive orders | ✅ Implemented |
| Walk-in / home collection | ✅ Implemented |
| Upload report | ✅ Implemented |
| Notify patient | ✅ Implemented |

### 7.5 Super Admin

| Feature | Status |
|---|---|
| Approve institutions | ✅ Implemented |
| Manage users / institutions | ✅ Implemented |
| View audit logs | ⚠️ `Approval` model exists, but no `AuditLog` collection |
| Basic platform overview | ✅ Implemented |

### 7.6 Diagnostic Order Flow (Kept Intentionally Flat)

```
Choose Center → Choose Test/Package → Choose Walk-in/Home →
Create Order → Order Accepted → Sample Collected → Processing →
Report Uploaded → Patient Notified
```

Home collection is an `Order` attribute, not a separate subsystem:

```js
Order {
  collectionType: "walk_in" | "home_collection",  // Note: current schema uses "home_collection"
  address: { street, city, state, zipCode, country, coordinates, contactPhone },
  status: "pending" | "sample_collected" | "in_progress" | "completed" | "cancelled"
}
```

> [!NOTE]
> The current Order schema correctly implements the flat model with `collectionType` and inline `address`. The `collectionStatus` field from the original spec is unnecessary — the `Order.status` progression already tracks collection implicitly. Don't add it.

---

## 8. Explicitly Deferred to Later Phases

> [!IMPORTANT]
> **12 existing models/subsystems should be removed or frozen for Phase 1.** The current codebase has 28 schemas; Phase 1 needs 18 (including the new `SerialCounter` and `AuditLog`). The extras add maintenance burden, test surface, and migration risk for features nobody is using yet.

| Deferred Item | Phase | Current Status |
|---|---|---|
| Mobile banking / card gateway (bKash, Nagad, SSLCommerz) | Phase 2 | Schema-ready only |
| SMS / WhatsApp reminders | Phase 1.5 | ❌ Not started (correct) |
| Telemedicine / WebRTC video calls | Phase 3 | ❌ Not started |
| AI prescription assistant, ICD-10 autocomplete, drug-interaction | Phase 4 | ❌ Not started |
| HL7/FHIR / EHR interoperability | Phase 4 | ❌ Not started |
| Native mobile app | Phase 4 | ❌ Not started |
| Multi-language UI | Phase 2 | ❌ Not started |
| `SerialSettings` / `DateSerialSettings` | Phase 2 | ⚠️ Models exist — **freeze, don't use** |
| `TestSerialSettings` / `TestSerialBooking` | Phase 2 | ⚠️ Models exist — **freeze, don't use** |
| `HomeService*` subsystem (4 models) | Phase 2 | ⚠️ Models exist — **freeze, don't use** |
| `Specialization` as managed collection | Phase 2 | ⚠️ Model exists — **hardcode list instead** |
| `Banner` | Phase 2 | ⚠️ Model exists — **don't use yet** |
| `SuperAdminStaff` | Phase 2 | ⚠️ Model exists — **don't use yet** |
| `HospitalSchedule` | Phase 2 | ⚠️ Model exists — **use `Schedule` only** |

> [!TIP]
> **Don't delete deferred models** — they represent future work. Just don't import them, don't route to them, and don't write controllers for them. Mark them with a `// DEFERRED: Phase 2` comment at the top of each file.

---

## 9. Database Schema — Phase 1 (18 Collections)

### 9.1 Active Collections

| # | Collection | Purpose |
|---|---|---|
| 1 | `User` | Patients, hospital admins, diagnostic admins, super admin, staff accounts |
| 2 | `Doctor` | Physicians (separate collection with medical license, specialization) |
| 3 | `DoctorStaff` | Staff sub-accounts for doctor practices |
| 4 | `Hospital` | Institutional profile, registration, `associatedDoctors[]` |
| 5 | `DiagnosticCenter` | Diagnostic center profile, `associatedDoctors[]` |
| 6 | `HospitalStaff` | Staff sub-accounts scoped per hospital |
| 7 | `DiagnosticCenterStaff` | Staff sub-accounts scoped per center |
| 8 | `Chamber` | Consultation locations operated by doctors (includes `dailyPatientLimit`) |
| 9 | `Schedule` | Doctor weekly recurring timetable |
| 10 | `Appointment` | Consultation records with serial, status, payment tracking |
| 11 | `Prescription` | Digital prescriptions with vitals, diagnosis, medicines, PDF link |
| 12 | `Test` | Diagnostic test/package catalog |
| 13 | `Order` | Lab test orders with collection type and report tracking |
| 14 | `Earning` | Per-appointment earnings ledger |
| 15 | `Approval` | Institutional approval audit trail |
| 16 | `Notification` | In-app real-time notification log |
| 17 | **`AuditLog`** | ← **NEW: Append-only audit log** (see §11.4) |
| 18 | **`SerialCounter`** | ← **NEW: Atomic serial allocation with daily-cap** (see §5.1) |

### 9.2 Frozen Collections (Exist but Unused in Phase 1)

`SerialSettings`, `DateSerialSettings`, `TestSerialSettings`, `TestSerialBooking`, `HomeService`, `HomeServiceRequest`, `HomeServiceSerialSettings`, `HomeServiceSerialBooking`, `HospitalSchedule`, `Specialization`, `Banner`, `SuperAdminStaff`

---

## 10. API Design Rules

### 10.1 URL Structure

REST under `/api/v1/{role}/...` and `/api/v1/shared/...` for public search.

> [!WARNING]
> **Current codebase uses unversioned routes** (`/api/auth/...`, `/api/patient/...`). The spec calls for `/api/v1/...` from day one. **Decision required**: either migrate all routes to `/api/v1/` now (breaking change), or accept unversioned for Phase 1 and version from Phase 2. Recommendation: **version now** — it's a one-time mechanical change before any external consumers exist.

### 10.2 Standard Error Contract

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "phone", "msg": "Valid phone number is required" }]
}
```

### 10.3 Tiered Rate Limiting

> [!CAUTION]
> **Not Implemented**: The current codebase has no rate limiting at all. This is a **security requirement**, not a nice-to-have.

| Tier | Routes | Limit |
|---|---|---|
| Strict | `/api/auth/*`, password reset, OTP | 5 req/min per IP |
| Moderate | Appointment creation, prescription creation, report upload | 20 req/min per user |
| Upload | File uploads | Size (5MB max) + type validation |
| General | All other API routes | 100 req/min per IP |

Implementation: use `express-rate-limit` with `rate-limit-redis` (or in-memory for Phase 1).

---

## 11. Security & Compliance (Build Alongside MVP, Not After)

### 11.1 Tenant Guard Middleware ✅ (Exists, Needs Tests)

See §4.

### 11.2 Token Versioning ❌ (Not Implemented — Must Add)

```js
// Add to User and Doctor schemas:
tokenVersion: {
  type: Number,
  default: 0
}
```

- Incremented on: password change, forced logout, account compromise response
- Checked in `authenticate` middleware: decode JWT → compare `decoded.tokenVersion` with stored `user.tokenVersion` → reject if mismatch
- JWT payload must include `tokenVersion` at sign time

> [!CAUTION]
> **Current Risk**: Without token versioning, a user who changes their password still has all old JWTs valid for up to 7 days. This is a **critical security gap** for a healthcare platform.

### 11.3 Password Reset Flow ❌ (Not Implemented — Must Add)

**Phase 1 mechanism: Email-based password reset only.** SMS/WhatsApp reset is deferred to Phase 1.5.

```
Forgot Password → Enter registered email → Backend generates short-lived reset token (15 min)
→ Nodemailer sends reset link to email → User clicks link → Enter new password
→ tokenVersion++ → All existing sessions invalidated
```

> [!NOTE]
> `nodemailer` is already in `package.json` — the dependency exists but no reset flow is built. Use this existing dependency. Do not add SMS provider integration for Phase 1.

### 11.4 Audit Logging ❌ (Must Add `AuditLog` Collection)

> [!CAUTION]
> **Audit logs are immutable and append-only.** They are never updated or deleted through the application. No `deletedAt` field, no soft deletion, no `findOneAndUpdate`. CREATE only.

```js
const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, required: true },
  actorRole: { type: String, required: true },
  actorCollection: { type: String, enum: ['User', 'Doctor'], required: true },
  action: {
    type: String,
    enum: [
      'login', 'password_change', 'password_reset',
      'appointment_status_change', 'appointment_cancel',
      'prescription_create', 'prescription_update',
      'report_upload',
      'institution_approve', 'institution_reject',
      'staff_permission_change', 'staff_create', 'staff_deactivate',
      'profile_update'
    ],
    required: true
  },
  resourceType: { type: String, required: true },
  resourceId: { type: mongoose.Schema.Types.ObjectId },
  tenantId: { type: mongoose.Schema.Types.ObjectId },
  tenantType: { type: String, enum: ['hospital', 'diagnostic_center', 'platform'] },
  ipAddress: { type: String },
  userAgent: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now }
}, {
  timestamps: false,
  // Prevent updates and deletes at the Mongoose level
  strict: true
});

// Block all update/delete operations at the schema level
auditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndDelete', 'deleteOne', 'deleteMany'], function() {
  throw new Error('AuditLog records are immutable. Updates and deletes are not permitted.');
});

auditLogSchema.index({ actorId: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
auditLogSchema.index({ tenantId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
```

### 11.5 File Upload Validation ⚠️ (Partial)

Current `upload.middleware.js` exists (4KB) but must enforce:

- [x] Multer file size limits
- [ ] **MIME type validation** (not just extension checking)
- [ ] **Magic byte verification** (check file header, not `Content-Type` header)
- [ ] **Randomized storage filenames** (never use `req.file.originalname` for storage path)
- [ ] **No executable uploads** (reject `.exe`, `.sh`, `.bat`, `.js`, etc.)
- [ ] **PDF sanitization** (strip embedded JavaScript from uploaded PDFs)

### 11.6 Soft Deletion ❌ (Not Implemented)

Add `deletedAt` field to: `Appointment`, `Prescription`, `Order`. Never hard-delete medical records.

```js
// Add to Appointment, Prescription, and Order schemas:
deletedAt: { type: Date, default: null }

// Add query middleware to exclude soft-deleted records by default:
schema.pre(/^find/, function() {
  if (!this.getOptions().includeSoftDeleted) {
    this.where({ deletedAt: null });
  }
});
```

> [!IMPORTANT]
> - **`AuditLog`** is excluded from soft deletion — it is append-only and immutable (see §11.4).
> - **`Earning`** records should use **immutable transaction records** rather than soft deletion. For Phase 1 (cash-only), `Earning` records are created upon consultation completion and are never modified or deleted. When online payments are introduced in Phase 2, use proper financial ledger entries (credit/debit) rather than mutating or soft-deleting earnings.
> - Document the retention/deletion policy before real patient data goes live: how long records are kept, how a patient requests deletion, what "anonymized" means for this schema.

### 11.7 Encryption

Use MongoDB Atlas encryption-at-rest as the Phase 1 baseline, plus:
- Strict authorization (tenant guards)
- TLS for all connections
- Proper secret management (env vars, never hardcoded)

Do **not** build application-level field encryption during initial scaffolding.

### 11.8 CORS Configuration ⚠️ (Needs Fix)

```js
// Current (INSECURE — allows all origins):
app.use(cors());

// Required:
const corsOrigin = process.env.FRONTEND_URL;
if (process.env.NODE_ENV === 'production' && !corsOrigin) {
  throw new Error('FRONTEND_URL environment variable is required in production.');
}

app.use(cors({
  origin: corsOrigin || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

> [!NOTE]
> `credentials: true` is omitted because authentication uses JWT bearer tokens in the `Authorization` header, not cookies. Only add `credentials: true` if cookie-based credentials are actually needed. `FRONTEND_URL` is mandatory in production — the server must refuse to start without it.

---

## 12. UX/UI Simplicity Guidelines

Every primary flow reachable in **3 taps from home** — make this a product acceptance criterion:

```
Patient:      Home → Find Doctor → Doctor → Book
Prescription: Home → My Health → Prescription
Serial:       Home → Appointment → Current Serial
```

### 12.1 Design System Rules

- Use the existing glassmorphism design system (`AuthShared.css`) consistently — no second visual language for new features.
- No new settings screen unless an MVP flow actually depends on it being configurable.
- Error messages written for patients, not developers:
  - ✅ "This time slot was just booked, here are today's next available serials"
  - ❌ "Duplicate key error: E11000"

### 12.2 Patient-Facing Error Messages

| Scenario | Message |
|---|---|
| Serial just taken | "That serial was just booked by another patient. Please try again to get the next available serial." |
| No serials available | "Dr. {name} has no available serials for {date}. Try another date?" |
| Token expired | "Your session has expired. Please log in again." |
| Cross-tenant access | "You don't have access to this resource." |
| Validation failed | "Please check the highlighted fields and try again." |

---

## 13. Testing (Build Alongside, Not After)

> [!CAUTION]
> **Current State**: Zero tests exist. The original PROJECT_OVERVIEW.md defers ALL testing to "Phase 3". This is corrected — the tests below are required for Phase 1 ship.

### 13.1 Phase 1 Required Tests

| Category | Tests | Priority |
|---|---|---|
| **Tenant Guards** | Hospital cross-tenant isolation (6 cases from §4.2) | 🔴 P0 |
| **Serial Counter** | Atomic increment, no reuse after cancel, concurrent booking | 🔴 P0 |
| **Status Transitions** | Valid/invalid appointment status changes | 🟡 P1 |
| **Auth** | Token versioning rejects old tokens after password change | 🟡 P1 |
| **Booking Lifecycle** | Book → Complete → Earning generated | 🟡 P1 |
| **Booking Lifecycle** | Book → Reject → Serial not reused | 🟡 P1 |

### 13.2 Test Stack

```json
// Add to backend/package.json devDependencies:
{
  "vitest": "^3.x",
  "supertest": "^7.x",
  "mongodb-memory-server": "^10.x"
}
```

### 13.3 Deferred Tests

- Full E2E (Playwright/Cypress) → Phase 2
- Load/concurrency testing → Phase 2
- Frontend component tests → Phase 2

---

## 14. In-App Reminders (Phase 1 Scope)

> [!NOTE]
> **Phase 1 ships in-app reminders only.** SMS/WhatsApp is deferred to Phase 1.5. External messaging adds provider integration, delivery failures, templates, cost, and retry logic that don't belong in a first build.

### 14.1 Scope: 1-Hour Reminder Only

Phase 1 implements a **single reminder**: approximately 1 hour before the scheduled consultation window. Do not implement the 24-hour reminder in Phase 1 — start with the highest-value reminder for the serial system.

> [!NOTE]
> "1 hour before their turn" is more complex than "1 hour before the scheduled time" because the queue can move dynamically. For MVP, define the trigger as: **send reminder approximately one hour before the expected consultation time based on the configured chamber schedule start time + (serialNumber × fixedConsultationMinutes)**. True dynamic queue reminders can be built later.

### 14.2 Implementation

```js
// Simple cron-based reminder scheduler (runs every 5 minutes)
// Checks for appointments where:
//   - status = 'booked'
//   - estimated consultation time is within next 60 minutes
//   - reminderSent === false

// For each match:
//   1. Create Notification record
//   2. Emit Socket.IO event to user-{patientId}
//   3. Set reminderSent = true
```

### 14.3 Simplified Schema Field

```js
// Replace the current nested reminderSent object:
// OLD: reminderSent: { t24h: Boolean, t1h: Boolean }
// NEW:
reminderSent: {
  type: Boolean,
  default: false
}
```

### 14.4 Scheduler Constraints

Use `node-cron` for Phase 1 (simplest, in-process). Migrate to `agenda` (MongoDB-backed job queue) if reliability issues arise.

> [!CAUTION]
> **The reminder scheduler is single-instance only in Phase 1.** Do not run multiple scheduler instances (e.g., multiple backend containers) until distributed locking or a persistent job queue (like `agenda`) is introduced. This is especially important if the architecture later scales to multiple backend instances — duplicate reminders would be sent without a lock.

---

## 15. Environment Variables

| Variable | Purpose | Format |
|---|---|---|
| `PORT` | Server listening port | `5000` |
| `NODE_ENV` | Environment scope | `production` |
| `MONGO_URI` | MongoDB connection string | `mongodb+srv://...` |
| `JWT_SECRET` | Token signature secret | 256-bit random string |
| `JWT_EXPIRE` | Token expiration duration | `7d` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary storage bucket | string |
| `CLOUDINARY_API_KEY` | Cloudinary API access key | string |
| `CLOUDINARY_API_SECRET` | Cloudinary API access secret | string |
| `FRONTEND_URL` | Allowed CORS origin | `https://medify247.vercel.app` |

> [!WARNING]
> **Current `server.js` has a fallback JWT secret**: `process.env.JWT_SECRET || 'your_jwt_secret'`. This is a **critical vulnerability** — if the env var is missing, the app runs with a guessable secret. Change the fallback to throw an error at startup instead.

---

## 16. Critical Gaps Summary — Fix Before Ship

| # | Gap | Severity | Section |
|---|---|---|---|
| 1 | **No tenant guard integration tests** | 🔴 Critical | §4 |
| 2 | **Serial booking uses count-based (not atomic counter)** | 🔴 Critical | §5 |
| 3 | **No token versioning** — password change doesn't revoke old JWTs | 🔴 Critical | §11.2 |
| 4 | **No password reset flow** | 🔴 Critical | §11.3 |
| 5 | **No rate limiting** on any route | 🟠 High | §10.3 |
| 6 | **No audit logging** (`AuditLog` collection missing) | 🟠 High | §11.4 |
| 7 | **CORS allows all origins** (`app.use(cors())`) | 🟠 High | §11.8 |
| 8 | **No appointment status transition validation** | 🟡 Medium | §6 |
| 9 | **No queue position / wait estimate** exposed to patients | 🟡 Medium | §5.2 |
| 10 | **No in-app reminder scheduler** | 🟡 Medium | §14 |
| 11 | **No soft deletion** on medical records | 🟡 Medium | §11.6 |
| 12 | **JWT fallback secret in server.js** | 🟠 High | §15 |
| 13 | **`User.role` enum includes doctor/doctor_staff** | 🟡 Medium | §3.1 |

---

## 17. Definition of Done for Phase 1

A patient can:
- ✅ Register once (platform-wide)
- ✅ Find a doctor or diagnostic test
- ⚠️ Book a serial with an accurate queue position and wait estimate
- ❌ Receive an in-app reminder approximately one hour before their consultation
- ⚠️ Complete a consultation and access their digital prescription, or complete a diagnostic order and access the uploaded report

With **zero tolerance** for:
- ❌ Double-booked serials → Requires atomic counter with daily-cap enforcement
- ❌ Over-allocated serials → Daily patient limit must be enforced atomically
- ❌ Unrevoked tokens outliving a password reset → Requires token versioning
- ❌ Institution A seeing Institution B's data → Requires guard tests proving this
- ❌ No password-reset flow → Email-based reset must exist and work end-to-end

---

## 18. Execution Priority Order

> [!IMPORTANT]
> If building from this spec, execute in this order. Each step depends on the previous.

```
1.  Security foundations (token versioning, CORS fix, JWT secret validation, FRONTEND_URL mandatory)
2.  Tenant guard integration tests
3.  Atomic serial counter migration (SerialCounter collection + daily-cap enforcement)
4.  Appointment status model migration (pending/accepted → booked, transition guard)
5.  AuditLog collection (append-only, immutable) + audit middleware
6.  Rate limiting (express-rate-limit, tiered)
7.  Email-based password reset flow (Nodemailer)
8.  Queue position + wait estimate API
9.  In-app 1-hour reminder scheduler (node-cron, single-instance)
10. Soft deletion for medical records (Appointment, Prescription, Order)
11. File upload hardening (MIME validation, magic bytes, randomized filenames)
12. User.role enum cleanup (remove doctor/doctor_staff)
```

---

## Appendix A: Files Changed Since Original Spec

| File | Change Type | Notes |
|---|---|---|
| `backend/src/models/AuditLog.model.js` | **NEW** | §11.4 |
| `backend/src/models/SerialCounter.model.js` | **NEW** | §5.1 (replaces count-based allocation) |
| `backend/src/models/User.model.js` | **MODIFY** | Add `tokenVersion`, clean `role` enum |
| `backend/src/models/Doctor.model.js` | **MODIFY** | Add `tokenVersion` |
| `backend/src/models/Appointment.model.js` | **MODIFY** | Add `deletedAt`, migrate status enum (`booked` replaces `pending`+`accepted`), keep compound unique index as safety net |
| `backend/src/models/Prescription.model.js` | **MODIFY** | Add `deletedAt` |
| `backend/src/models/Order.model.js` | **MODIFY** | Add `deletedAt` |
| `backend/src/models/Chamber.model.js` | **MODIFY** | Add `dailyPatientLimit` field |
| `backend/src/models/Earning.model.js` | **NOTE** | No `deletedAt` — use immutable transaction records, not soft deletion |
| `backend/src/middlewares/auth.middleware.js` | **MODIFY** | Add token version check |
| `backend/src/middlewares/rateLimiter.middleware.js` | **NEW** | §10.3 |
| `backend/src/middlewares/auditLog.middleware.js` | **NEW** | §11.4 |
| `backend/src/services/reminderScheduler.js` | **NEW** | §14 |
| `backend/server.js` | **MODIFY** | CORS fix, JWT validation, rate limiter, reminder scheduler init |
| `backend/test/guards.test.js` | **NEW** | §4.2 |
| `backend/test/serial.test.js` | **NEW** | §5.1 |
| `backend/test/statusTransitions.test.js` | **NEW** | §6 |
| `backend/test/auth.test.js` | **NEW** | §11.2 |
| `backend/test/booking-lifecycle.test.js` | **NEW** | §13.1 |

---

> **Summary**: This corrected specification identifies 13 pre-ship gaps (4 critical, 4 high, 5 medium) between the original spec and the live codebase, and provides a 12-step execution order that builds security foundations first, then correctness, then features. The existing codebase is approximately 75% complete for Phase 1 — the remaining 25% is almost entirely security, data integrity, and architectural correctness work. **This document should be frozen as `PHASE_1_MVP_BUILD_SPEC.md` — stop expanding the specification.**
