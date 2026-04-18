import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from faker import Faker
from bson import ObjectId
from datetime import datetime, timedelta
import random

fake = Faker()

import asyncio
import os
from dotenv import load_dotenv

load_dotenv()  # loads your .env file

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME   = os.getenv("MONGO_DB_NAME", "campus_erp")
DEPARTMENTS = [
    {"name": "Computer Engineering",              "code": "CE"},
    {"name": "Information Technology",            "code": "IT"},
    {"name": "Mechanical Engineering",            "code": "MECH"},
    {"name": "Electronics & Telecommunication",   "code": "EXTC"},
]

async def seed():
    client = AsyncIOMotorClient(MONGO_URI)
    db     = client[DB_NAME]

    print("Clearing old data...")
    await db.users.drop()
    await db.departments.drop()
    await db.courses.drop()
    await db.approvalrequests.drop()
    await db.schedules.drop()
    await db.payments.drop()
    await db.issues.drop()
    await db.attendances.drop()

    # ── 1. Departments ───────────────────────────────────────────────
    print("Seeding departments...")
    dept_ids = []
    for d in DEPARTMENTS:
        result = await db.departments.insert_one({
            "_id":  ObjectId(),
            "name": d["name"],
            "code": d["code"],
        })
        dept_ids.append(result.inserted_id)

    # ── 2. HODs ──────────────────────────────────────────────────────
    print("Seeding HODs...")
    hod_ids = []
    for dept_id in dept_ids:
        result = await db.users.insert_one({
            "_id":        ObjectId(),
            "name":       fake.name(),
            "email":      fake.unique.email(),
            "password":   "hashed_password",
            "role":       "hod",
            "department": dept_id,
            "isActive":   True,
            "createdAt":  datetime.utcnow(),
        })
        hod_id = result.inserted_id
        hod_ids.append(hod_id)
        # link HOD back to department
        await db.departments.update_one(
            {"_id": dept_id},
            {"$set": {"hod": hod_id}}
        )

    # ── 3. Faculty ───────────────────────────────────────────────────
    print("Seeding faculty...")
    faculty_ids = []
    for _ in range(10):
        result = await db.users.insert_one({
            "_id":        ObjectId(),
            "name":       fake.name(),
            "email":      fake.unique.email(),
            "password":   "hashed_password",
            "role":       "faculty",
            "employeeId": fake.bothify("EMP####"),
            "department": random.choice(dept_ids),
            "isActive":   True,
            "createdAt":  datetime.utcnow(),
        })
        faculty_ids.append(result.inserted_id)

    # ── 4. Students ──────────────────────────────────────────────────
    print("Seeding students...")
    student_ids = []
    for _ in range(30):
        result = await db.users.insert_one({
            "_id":        ObjectId(),
            "name":       fake.name(),
            "email":      fake.unique.email(),
            "password":   "hashed_password",
            "role":       "student",
            "rollNumber": fake.bothify("##CE###"),
            "department": random.choice(dept_ids),
            "isActive":   True,
            "fcmTokens":  [],
            "createdAt":  datetime.utcnow(),
        })
        student_ids.append(result.inserted_id)

    # ── 5. Courses ───────────────────────────────────────────────────
    print("Seeding courses...")
    course_ids = []
    course_names = [
        "Data Structures", "DBMS", "Operating Systems",
        "Computer Networks", "Machine Learning", "Web Technology",
    ]
    for i, name in enumerate(course_names):
        dept_id    = random.choice(dept_ids)
        faculty_id = random.choice(faculty_ids)
        enrolled   = random.sample(student_ids, k=min(15, len(student_ids)))
        result = await db.courses.insert_one({
            "_id":             ObjectId(),
            "code":            f"CS{300 + i}",
            "name":            name,
            "department":      dept_id,
            "faculty":         faculty_id,
            "semester":        random.choice([3, 4, 5, 6]),
            "enrolledStudents": enrolled,
            "createdAt":       datetime.utcnow(),
        })
        course_ids.append(result.inserted_id)

    # ── 6. Schedules ─────────────────────────────────────────────────
    print("Seeding schedules...")
    for course_id in course_ids:
        for day_offset in range(5):
            start = datetime.utcnow() + timedelta(days=day_offset, hours=random.randint(8, 14))
            end   = start + timedelta(hours=1)
            await db.schedules.insert_one({
                "_id":        ObjectId(),
                "title":      f"Class - {fake.word().title()}",
                "type":       "class",
                "course":     course_id,
                "room":       f"LH-{random.randint(100, 310)}",
                "department": random.choice(dept_ids),
                "start":      start,
                "end":        end,
                "audience":   "course",
                "audienceIds": random.sample(student_ids, k=10),
                "createdBy":  random.choice(faculty_ids),
                "isActive":   True,
                "createdAt":  datetime.utcnow(),
            })

    # ── 7. Approval Requests ─────────────────────────────────────────
    print("Seeding approval requests...")
    req_types = ["leave", "od", "certificate", "lab_access"]
    statuses  = ["pending", "approved", "rejected"]
    for student_id in random.sample(student_ids, k=15):
        req_type   = random.choice(req_types)
        hod_id     = random.choice(hod_ids)
        status     = random.choice(statuses)
        await db.approvalrequests.insert_one({
            "_id":         ObjectId(),
            "type":        req_type,
            "title":       f"{req_type.title()} Request",
            "description": fake.sentence(),
            "requestedBy": student_id,
            "department":  random.choice(dept_ids),
            "steps": [
                {
                    "order":    1,
                    "approver": hod_id,
                    "role":     "hod",
                    "status":   status,
                    "remarks":  fake.sentence() if status != "pending" else None,
                    "actionAt": datetime.utcnow() if status != "pending" else None,
                }
            ],
            "currentStep":   0,
            "overallStatus": status,
            "createdAt":     datetime.utcnow(),
        })

    # ── 8. Payments ──────────────────────────────────────────────────
    print("Seeding payments...")
    pay_types = ["library_fine", "lab_due", "fee", "canteen_bill"]
    for student_id in random.sample(student_ids, k=20):
        await db.payments.insert_one({
            "_id":        ObjectId(),
            "paidBy":     student_id,
            "type":       random.choice(pay_types),
            "amount":     round(random.uniform(50, 5000), 2),
            "currency":   "INR",
            "description": fake.sentence(),
            "status":     random.choice(["pending", "success"]),
            "createdAt":  datetime.utcnow(),
        })

    # ── 9. Issues ────────────────────────────────────────────────────
    print("Seeding issues...")
    categories = ["it", "facility", "electrical", "plumbing", "safety"]
    locations  = ["Lab 101", "Library", "Canteen", "Classroom 203", "Hostel Block A"]
    for _ in range(10):
        await db.issues.insert_one({
            "_id":         ObjectId(),
            "title":       fake.sentence(nb_words=5),
            "description": fake.paragraph(),
            "category":    random.choice(categories),
            "location":    random.choice(locations),
            "reportedBy":  random.choice(student_ids),
            "status":      random.choice(["open", "in_progress", "resolved"]),
            "priority":    random.choice(["low", "medium", "high"]),
            "timeline":    [],
            "createdAt":   datetime.utcnow(),
        })

    # ── 10. Attendance ───────────────────────────────────────────────
    print("Seeding attendance...")
    for course_id in course_ids:
        for day_offset in range(10):
            date    = datetime.utcnow() - timedelta(days=day_offset)
            records = [
                {
                    "student": s,
                    "status":  random.choice(["present", "absent", "late"]),
                }
                for s in random.sample(student_ids, k=15)
            ]
            present = sum(1 for r in records if r["status"] == "present")
            await db.attendances.insert_one({
                "_id":          ObjectId(),
                "course":       course_id,
                "date":         date,
                "markedBy":     random.choice(faculty_ids),
                "records":      records,
                "totalPresent": present,
                "totalAbsent":  len(records) - present,
                "totalEnrolled": len(records),
                "createdAt":    datetime.utcnow(),
            })

    print("\n✅ Seeding complete!")
    print(f"   Departments:       {len(dept_ids)}")
    print(f"   HODs:              {len(hod_ids)}")
    print(f"   Faculty:           {len(faculty_ids)}")
    print(f"   Students:          {len(student_ids)}")
    print(f"   Courses:           {len(course_ids)}")
    print(f"   Schedules:         {len(course_ids) * 5}")
    print(f"   Approval Requests: 15")
    print(f"   Payments:          20")
    print(f"   Issues:            10")
    print(f"   Attendance:        {len(course_ids) * 10}")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed())

async def print_ids():
    client = AsyncIOMotorClient(MONGO_URI)
    db     = client[DB_NAME]

    print("\n--- STUDENT IDs ---")
    async for u in db.users.find({"role": "student"}).limit(3):
        print(f"  {u['_id']}  →  {u['name']}")

    print("\n--- HOD IDs ---")
    async for u in db.users.find({"role": "hod"}).limit(2):
        print(f"  {u['_id']}  →  {u['name']}")

    print("\n--- DEPARTMENT IDs ---")
    async for d in db.departments.find().limit(4):
        print(f"  {d['_id']}  →  {d['name']}")

    client.close()

asyncio.run(print_ids())