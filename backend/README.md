# AETHER - Campus Workflow Application Backend

AETHER is a modern, role-based campus workflow application backend designed to streamline university operations. It features smart request routing, multi-stage approval chains, conflict-aware scheduling, and robust access controls.

## 🛠 Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB
- **ODM:** Mongoose
- **Authentication:** JSON Web Tokens (JWT) & bcrypt

## 🏗 Architecture

The backend follows the **Controller-Route Pattern** for maximum modularity and maintainability:
- **`routes/`**: Clean routing definitions utilizing Express routers. Responsible for binding middleware (like authentication) to specific endpoints.
- **`controllers/`**: Contains the core business logic.
- **`middleware/`**: Contains custom middleware such as `protect` (verifies JWT) and `authorize` (verifies user roles).
- **`models/`**: Mongoose schema definitions powering the database layer.

## 🗄 Database Schema (Mongoose Models)

The system relies on a rich, highly relational data model built for scale:

1. **User**: The core identity document. Handles authentication (bcrypt password hashing), stores roles (`student`, `faculty`, `hod`, `principal`, `admin`, `support`, `club`), and maintains FCM tokens for push notifications and copilot context.
2. **ProfessorProfile**: A supplementary profile linked to a `User` (faculty). Stores academic details like `researchInterests`, `teachingAreas`, and `availability`. Used heavily by the smart routing engine.
3. **ApprovalRequest**: The backbone of the workflow engine. Supports multi-stage chain-of-responsibility approvals. Contains an array of `steps`, tracking individual approvers, their statuses, and timestamps.
4. **Department**: Connects users, courses, and requests. Facilitates automatic routing (e.g., finding a student's HOD or Principal).
5. **Course**: Represents an academic subject. Links faculty to enrolled students for attendance tracking.
6. **Schedule**: A conflict-aware scheduling layer that merges classes, exams, and room bookings to prevent location/time clashes.
7. **Attendance**: Highly optimized, date-based attendance tracking linked to specific courses.
8. **Notification**: Powers dashboard feeds and push alerts. Supports deep-linking via `refModel` and `refId`.
9. **Issue**: Mobile resolution and support protocol (e.g., IT or facility reports) featuring category-based routing, severities, and geospatial tagging.
10. **Payment**: Financial settlement gateway for fines and fees.
11. **ChatMessage**: Maintains conversation history and live data citations for an AI Campus Copilot.
12. **Plugin**: A super-app architecture layer allowing extensible mini-apps with robust permission manifests.

## ✨ Key Features & Technical Details

### 1. Smart Workflow Engine (ApprovalRequest)
Unlike traditional flat-state tracking, the workflow engine dynamically builds an approval chain (`steps`) based on the request type:
- **Research / Letter of Recommendation (LOR):** Uses an algorithmic matching score. It compares the request's `meta.tags` against all faculty members' `researchInterests` and `teachingAreas` via the `ProfessorProfile` collection, automatically routing the request to the best-matched professor.
- **Leave / Room Bookings:** Queries the `Department` collection to build a multi-stage approval chain (e.g., HOD → Principal).

### 2. Multi-Stage Action Resolution
The `actionRequest` controller handles the progression of the `ApprovalRequest` chain:
- **Rejection:** If any approver in the chain rejects the request, the `overallStatus` immediately flips to `rejected`, halting the chain.
- **Approval:** If approved, the system increments the `currentStep`. If there are more approvers, it notifies the next person in line. If it was the final step, it flips `overallStatus` to `approved`.

### 3. Automated Notification Triggers
Notifications are tightly coupled with the approval engine. 
- When a request is created, the first approver receives a `Notification`.
- When an approver advances the chain, the next approver is notified.
- When the chain concludes (fully approved or rejected), the original requester is notified instantly.

### 4. JWT & Role-Based Access Control (RBAC)
- **`protect` Middleware:** Extracts the Bearer token, verifies it against the `JWT_SECRET`, decodes the `userId`, and attaches the full `User` document to `req.user`.
- **`authorize(...roles)` Middleware:** Evaluates `req.user.role` against a whitelist of permitted roles before granting route access. For example, `authorize('faculty', 'admin')` protects the action endpoint so students cannot approve their own requests.

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher recommended)
- MongoDB Cluster (e.g., MongoDB Atlas)

### Setup Instructions

1. **Clone the repository and navigate to the backend directory.**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure Environment Variables:**
   Create a `.env` file in the root of the backend directory with the following variables:
   ```env
   PORT=6969
   MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>
   JWT_SECRET=your_super_secret_key
   ```
4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   *The server will start using nodemon, auto-reloading on file changes.*

### Testing the API
You can test the endpoints using Postman or cURL.
1. `POST /auth/register` to create an account.
2. `POST /auth/login` to obtain your JWT.
3. Attach the JWT as a `Bearer` token in the `Authorization` header for protected routes like `POST /prof/setup` or `POST /request`.
