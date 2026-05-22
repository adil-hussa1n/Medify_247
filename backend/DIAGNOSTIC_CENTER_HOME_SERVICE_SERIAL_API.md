# Diagnostic Center Home Service Serial API

Serial booking for diagnostic center home services (e.g. home sample collection). Same rules as hospital home service serials: **only even serial numbers (2, 4, 6, …)** are bookable online.

## Diagnostic Center Admin

### Create or update serial settings
`POST /api/diagnostic-centers/:centerId/home-services/:serviceId/serial-settings`

Body:
```json
{
  "totalSerialsPerDay": 20,
  "serialTimeRange": { "startTime": "09:00", "endTime": "17:00" },
  "servicePrice": 500,
  "availableDays": [1, 2, 3, 4, 5],
  "isActive": true
}
```

### Get serial settings
`GET /api/diagnostic-centers/:centerId/home-services/:serviceId/serial-settings`

### Get serial stats for a date
`GET /api/diagnostic-centers/:centerId/home-services/:serviceId/serial-stats?date=YYYY-MM-DD`

### List serial bookings
`GET /api/diagnostic-centers/:centerId/home-service-serial-bookings?date=&status=&serviceId=`

### Update booking status
`PUT /api/diagnostic-centers/:centerId/home-service-serial-bookings/:bookingId/status`

Body: `{ "status": "confirmed|completed|cancelled", "notes": "optional" }`

### Update serial booking (reschedule, patient info, status)
`PUT /api/diagnostic-centers/:centerId/home-service-serial-bookings/:bookingId`

Body (all optional): `status`, `notes`, `date`, `serialNumber`, `patientName`, `patientAge`, `patientGender`, `phoneNumber`, `homeAddress`

## Patient

### Available serials (diagnostic center)
`GET /api/patient/diagnostic-centers/:diagnosticCenterId/home-services/:serviceId/serials?date=YYYY-MM-DD`

### Book serial (hospital or diagnostic center)
`POST /api/patient/home-service-serials/book`

Body (diagnostic center):
```json
{
  "diagnosticCenterId": "...",
  "homeServiceId": "...",
  "serialNumber": 2,
  "date": "2026-05-22",
  "patientName": "John Doe",
  "patientAge": 30,
  "patientGender": "male",
  "phoneNumber": "01700000000",
  "homeAddress": { "street": "...", "city": "..." }
}
```

### My serial bookings
`GET /api/patient/home-service-serials/my-bookings`

### Update my serial booking
`PUT /api/patient/home-service-serials/:bookingId`

Body: `date`, `serialNumber`, `phoneNumber`, `homeAddress`, `notes`, or `status: "cancelled"`
