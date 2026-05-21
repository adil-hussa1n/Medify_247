# Hospital Home Service Serial Management API

Serial booking for hospital home services follows the same rules as doctor/test serials: **only even-numbered serials (2, 4, 6, …) are available for online booking**.

## Hospital Admin

### Create or update serial settings
`POST /api/hospitals/:hospitalId/home-services/:serviceId/serial-settings`

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
`GET /api/hospitals/:hospitalId/home-services/:serviceId/serial-settings`

### Get serial stats for a date
`GET /api/hospitals/:hospitalId/home-services/:serviceId/serial-stats?date=2026-05-20`

### List all serial bookings
`GET /api/hospitals/:hospitalId/home-service-serial-bookings?date=&status=&serviceId=`

### Update booking status
`PUT /api/hospitals/:hospitalId/home-service-serial-bookings/:bookingId/status`

```json
{ "status": "confirmed", "notes": "optional" }
```

Status values: `pending`, `confirmed`, `completed`, `cancelled`

## Patient

### Get available serials
`GET /api/patient/hospitals/:hospitalId/home-services/:serviceId/serials?date=YYYY-MM-DD`

### Book a serial
`POST /api/patient/home-service-serials/book`

```json
{
  "hospitalId": "...",
  "homeServiceId": "...",
  "serialNumber": 2,
  "date": "2026-05-20",
  "patientName": "John Doe",
  "patientAge": 35,
  "patientGender": "male",
  "phoneNumber": "+8801...",
  "homeAddress": {
    "street": "123 Main St",
    "city": "Dhaka"
  },
  "notes": "optional"
}
```

### My serial bookings
`GET /api/patient/home-service-serials/my-bookings`

### History (includes serial bookings)
`GET /api/patient/history?type=home_service_serials`
