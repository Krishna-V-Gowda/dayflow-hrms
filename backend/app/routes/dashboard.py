from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..auth import get_current_user
from ..db import get_db
from ..models import Attendance, AttendanceStatus, Employee, LeaveRequest, LeaveStatus, User

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def dashboard_summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    is_hr = (user.role.value if hasattr(user.role, "value") else str(user.role)) == "hr"
    employees = db.query(Employee).all() if is_hr else [user.employee]
    employee_ids = [employee.id for employee in employees]
    today = date.today()
    records = db.query(Attendance).filter(Attendance.employee_id.in_(employee_ids)).all()
    today_records = [record for record in records if record.work_date == today]
    leaves = db.query(LeaveRequest).filter(LeaveRequest.employee_id.in_(employee_ids)).all()
    open_checkins = sum(1 for record in today_records if record.check_in and not record.check_out)
    present = sum(1 for record in today_records if record.check_in)
    return {
        "employee_count": len(employees),
        "attendance_today": round(present / len(employees) * 100, 1) if employees else 0,
        "open_checkins": open_checkins,
        "pending_leaves": sum(leave.status == LeaveStatus.PENDING for leave in leaves),
        "approved_leaves": sum(leave.status == LeaveStatus.APPROVED for leave in leaves),
        "attendance_records": len(records),
        "half_days": sum(record.status == AttendanceStatus.HALF_DAY for record in records),
    }