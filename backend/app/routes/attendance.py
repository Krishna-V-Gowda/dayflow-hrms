from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..auth import get_current_user
from ..db import get_db
from ..models import Attendance, AttendanceStatus, User
from ..services import audit, notify
from ..schemas import AttendanceOut

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


def serialize(record: Attendance) -> dict:
    duration = None
    signal = None
    if record.check_in and record.check_out:
        duration = max(0, int((record.check_out - record.check_in).total_seconds() // 60))
        if duration < 240:
            record.status = AttendanceStatus.HALF_DAY
            signal = "Short shift: completed duration is under 4 hours."
        elif duration > 600:
            signal = "Overtime: completed duration exceeds 10 hours."
        else:
            record.status = AttendanceStatus.PRESENT
    elif record.check_in:
        signal = "Missing checkout: the attendance record is still open."
    return {"id": record.id, "employee_name": record.employee.full_name, "work_date": record.work_date, "check_in": record.check_in, "check_out": record.check_out, "status": record.status, "duration_minutes": duration, "signal": signal}


@router.post("/check-in")
def check_in(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    employee = user.employee
    today = date.today()
    record = db.query(Attendance).filter(Attendance.employee_id == employee.id, Attendance.work_date == today).first()
    if record and record.check_in:
        raise HTTPException(409, "Already checked in today")
    now = datetime.now()
    if not record:
        record = Attendance(employee_id=employee.id, work_date=today, check_in=now)
        db.add(record)
    else:
        record.check_in = now
    db.commit()
    db.refresh(record)
    audit(db, user, "attendance_check_in", "attendance", record.id, {"work_date": today})
    notify(db, user.id, "Checked in", f"Attendance started at {record.check_in.strftime('%H:%M')}.", "attendance")
    db.commit()
    return {"message": "Checked in", "check_in": record.check_in}


@router.post("/check-out")
def check_out(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    employee = user.employee
    today = date.today()
    record = db.query(Attendance).filter(Attendance.employee_id == employee.id, Attendance.work_date == today).first()
    if not record or not record.check_in:
        raise HTTPException(409, "Check in before checking out")
    if record.check_out:
        raise HTTPException(409, "Already checked out today")
    record.check_out = datetime.now()
    audit(db, user, "attendance_check_out", "attendance", record.id, {"work_date": today})
    db.commit()
    db.refresh(record)
    return {"message": "Checked out", "check_out": record.check_out}


@router.get("/me")
def my_attendance(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    employee = user.employee
    records = db.query(Attendance).filter(Attendance.employee_id == employee.id).order_by(Attendance.work_date.desc()).limit(31).all()
    return [serialize(record) for record in records]


@router.get("", response_model=list[AttendanceOut])
def attendance_overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Attendance).order_by(Attendance.work_date.desc()).limit(100)
    if (user.role.value if hasattr(user.role, "value") else str(user.role)) != "hr":
        query = query.filter(Attendance.employee_id == user.employee.id)
    return [serialize(record) for record in query.all()]
