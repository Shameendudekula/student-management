# Student Management System

A full-stack CRUD web application for managing student records: add, view, search, update and delete students through a clean, responsive dashboard. Built with **Node.js, Express, MongoDB (Mongoose)** and a **plain HTML/CSS/JavaScript** frontend.

🔗 **Live demo:** _coming soon (Render)_
💻 **Source:** https://github.com/Shameendudekula/student-management

---

## ✨ Features

**Backend (REST API)**
- Full CRUD for students: create, list, view one, update, delete
- Search across name, roll number and email (case-insensitive, special characters matched literally)
- Filter by course and year, sorting, and pagination
- Dashboard statistics with MongoDB aggregation (total, per course, per year)
- Server-side validation with clear messages per field
- Proper status codes: `400` invalid input, `404` not found, `409` duplicate roll number/email, `500` server error
- Unique roll number and email, enforced by MongoDB indexes; roll numbers are stored uppercase and emails lowercase, so `cs01` and `CS01` count as the same
- Only known fields are accepted from requests, so clients can't set `_id` or `createdAt`
- Health check endpoint for deployment monitoring

**Frontend**
- Dashboard stat cards (total students and per course)
- Searchable, filterable, paginated student table
- Add / edit form in a modal, with instant validation in the browser plus the server's error messages shown next to each field
- View-details modal and delete confirmation dialog
- Toast notifications plus loading, empty and error states
- Responsive: on phones each table row becomes a card
- All user input is escaped before display (prevents XSS)

---

## 🛠 Tech Stack

| Layer | Technology |
|------|------------|
| Backend | Node.js, Express 5 |
| Database | MongoDB Atlas, Mongoose 9 |
| Frontend | HTML5, CSS3, vanilla JavaScript (Fetch API), native `<dialog>` modals |
| Config | dotenv, cors |
| Testing | Node.js test runner (`node:test`), Supertest, mongodb-memory-server, Puppeteer (UI) |
| Deployment | Render (one Web Service serves the API and the frontend) |

---

## 📁 Project Structure

```
student-management/
├── server.js                 # Entry point: loads .env, connects to MongoDB, starts the server
├── app.js                    # Express app: middleware, routes, static frontend, error handler
├── config/
│   ├── db.js                 # MongoDB connection
│   └── constants.js          # Allowed courses and genders (shared by validation and UI)
├── models/
│   └── Student.js            # Mongoose schema with validation rules and unique indexes
├── controllers/
│   └── studentController.js  # Request handlers: list/search/paginate, stats, CRUD
├── routes/
│   └── studentRoutes.js      # /api/students routes
├── middleware/
│   ├── validateObjectId.js   # 400 for malformed ids
│   └── errorHandler.js       # Maps errors to 400 / 404 / 409 / 500 JSON responses
├── public/                   # Frontend served by Express
│   ├── index.html
│   ├── css/styles.css
│   └── js/
│       ├── api.js            # All fetch() calls to the backend
│       └── app.js            # UI logic: table, filters, modals, toasts
├── seed/
│   ├── students.js           # 15 sample students
│   ├── seed.js               # npm run seed – load sample data into MongoDB
│   └── demo.js               # npm run demo – run with an in-memory DB (no Atlas needed)
├── tests/
│   └── api.test.js           # 17 API tests
├── .env.example
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20 or newer
- A free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

### Setup

```bash
git clone https://github.com/Shameendudekula/student-management.git
cd student-management
npm install
cp .env.example .env        # then put your MongoDB Atlas connection string in .env
npm run seed                # optional: load 15 sample students
npm run dev                 # starts with auto-reload on http://localhost:5050
```

> In MongoDB Atlas → **Network Access**, allow your IP address (or `0.0.0.0/0` for deployment on Render).

### Try it without MongoDB Atlas

```bash
npm run demo
```

Starts the full app on http://localhost:5050 with a temporary in-memory database pre-filled with the sample students. Data is lost when you stop it.

### Scripts

| Command | What it does |
|---------|--------------|
| `npm start` | Start the server (production) |
| `npm run dev` | Start with nodemon (restarts on file changes) |
| `npm run seed` | Replace all students in the database with 15 sample students |
| `npm run demo` | Run the app with an in-memory database and sample data |
| `npm test` | Run the API test suite (uses an in-memory database, never touches Atlas) |

---

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | ✅ | MongoDB Atlas connection string, including the database name |
| `PORT` | – | Server port (default `5050`; Render sets this automatically) |
| `CLIENT_URL` | – | Allowed CORS origin(s), comma-separated. Only needed if the frontend is hosted on a different domain |
| `NODE_ENV` | – | Set to `production` to hide internal error details from API responses |

---

## 📡 API Endpoints

Base URL: `/api`

| Method | Endpoint | Description | Success | Errors |
|--------|----------|-------------|---------|--------|
| GET | `/health` | Server and database status | 200 | – |
| GET | `/meta` | Allowed courses and genders | 200 | – |
| GET | `/students` | List students (search, filter, paginate) | 200 | 400 |
| GET | `/students/stats` | Totals per course and per year | 200 | – |
| GET | `/students/:id` | Get one student | 200 | 400, 404 |
| POST | `/students` | Create a student | 201 | 400, 409 |
| PUT | `/students/:id` | Update a student | 200 | 400, 404, 409 |
| DELETE | `/students/:id` | Delete a student | 200 | 400, 404 |

**Query parameters for `GET /students`**

| Param | Example | Description |
|-------|---------|-------------|
| `search` | `?search=diya` | Matches name, roll number or email |
| `course` | `?course=Civil` | Exact course |
| `year` | `?year=2` | 1–4 |
| `page` / `limit` | `?page=2&limit=10` | Pagination (limit max 100, default 10) |
| `sort` | `?sort=name` | `name`, `rollNumber`, `year`, `createdAt`; prefix with `-` for descending (default `-createdAt`) |

**Example: create a student**

```bash
curl -X POST http://localhost:5050/api/students \
  -H "Content-Type: application/json" \
  -d '{"name":"Asha Reddy","rollNumber":"CS2023001","email":"asha@example.com","phone":"+91 9876543210","course":"Computer Science","year":2,"gender":"Female","dateOfBirth":"2005-04-12","address":"Anantapur"}'
```

**Example error (409)**

```json
{ "message": "Roll number \"CS2023001\" is already registered", "errors": { "rollNumber": "Roll number is already registered" } }
```

### Student fields

| Field | Type | Rules |
|-------|------|-------|
| `name` | String | Required, 2–80 characters |
| `rollNumber` | String | Required, unique, letters/digits/`-`, 3–20 characters, stored uppercase |
| `email` | String | Required, unique, valid email, stored lowercase |
| `phone` | String | Required, 7–15 digits, optional leading `+` |
| `course` | String | Required, one of the courses in `config/constants.js` |
| `year` | Number | Required, integer 1–4 |
| `gender` | String | Required: Male, Female or Other |
| `dateOfBirth` | Date | Optional, must be in the past |
| `address` | String | Optional, max 200 characters |
| `createdAt` / `updatedAt` | Date | Set automatically |

---

## 🧪 Testing

```bash
npm test
```

17 automated API tests cover every endpoint, including validation errors, duplicates (409), malformed ids, pagination with no repeats or gaps, search escaping and statistics. The tests run against a temporary in-memory MongoDB.

The UI was also tested end-to-end in Chrome at desktop (1280px) and mobile (375px) widths: listing, pagination, search, filters, add, duplicate handling, view, edit, delete with confirmation, and HTML escaping.

---

## ☁️ Deployment (Render)

1. Push this repo to GitHub.
2. In MongoDB Atlas → **Network Access**, add `0.0.0.0/0` (Render's IP addresses change).
3. On [Render](https://render.com) → **New → Web Service** → connect the GitHub repo.
4. Settings:
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Health check path:** `/api/health`
5. **Environment variables:** `MONGO_URI` (your Atlas string) and `NODE_ENV=production`.
6. Deploy, then optionally run `npm run seed` locally against the same `MONGO_URI` to load sample data.

> The free Render instance sleeps after inactivity, so the first request can take ~50 seconds.

---

## 📸 Screenshots

> _Screenshots coming soon._

| View | Screenshot |
|------|-----------|
| Dashboard (desktop) | `![Dashboard](screenshots/dashboard.png)` |
| Add / edit form | `![Form](screenshots/form.png)` |
| Validation errors | `![Validation](screenshots/validation.png)` |
| Student details | `![Details](screenshots/details.png)` |
| Delete confirmation | `![Delete](screenshots/delete.png)` |
| Mobile view | `![Mobile](screenshots/mobile.png)` |

---

## 👩‍💻 Author

**Shameen Dudekula** · [Portfolio](https://portfolio-shameen.vercel.app) · [GitHub](https://github.com/Shameendudekula) · [LinkedIn](https://linkedin.com/in/shameen-d)
