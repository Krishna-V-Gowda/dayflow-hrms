from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..auth import get_current_user
from ..db import get_db
from ..models import Attendance, User

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


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
    db.commit()
    db.refresh(record)
    return {"message": "Checked out", "check_out": record.check_out}


@router.get("/me")
def my_attendance(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    employee = user.employee
    return db.query(Attendance).filter(Attendance.employee_id == employee.id).order_by(Attendance.work_date.desc()).limit(31).all()
