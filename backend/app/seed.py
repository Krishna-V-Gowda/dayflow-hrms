from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from .auth import hash_password
from .db import Base, SessionLocal, engine
from .models import Attendance, AttendanceStatus, Employee, LeaveRequest, LeaveStatus, Role, User


def seed():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        if db.query(User).count() > 0:
            return

        hr = User(email="hr@dayflow.local", password_hash=hash_password("Admin123!"), role=Role.HR)
        employee_user = User(email="employee@dayflow.local", password_hash=hash_password("Employee123!"), role=Role.EMPLOYEE)
        meera_user = User(email="meera@dayflow.local", password_hash=hash_password("Employee123!"), role=Role.EMPLOYEE)
        db.add_all([hr, employee_user, meera_user])
        db.flush()

        hr_employee = Employee(
            employee_code="DF-HR-001", full_name="Priya Menon", email=hr.email,
            department="People Operations", job_title="HR Manager", salary=110000, user_id=hr.id
        )
        arjun = Employee(
            employee_code="DF-EMP-001", full_name="Arjun Rao", email=employee_user.email,
            department="Engineering", job_title="Software Engineer", salary=68500, user_id=employee_user.id
        )
        meera = Employee(
            employee_code="DF-EMP-002", full_name="Meera Shah", email=meera_user.email,
            department="Engineering", job_title="Product Analyst", salary=72000, user_id=meera_user.id
        )
        db.add_all([hr_employee, arjun, meera])
        db.flush()

        today = date.today()
        db.add_all([
            Attendance(employee_id=arjun.id, work_date=today, check_in=datetime.now()),
            Attendance(employee_id=meera.id, work_date=today, status=AttendanceStatus.LEAVE),
            LeaveRequest(
                employee_id=arjun.id,
                leave_type="Paid",
                start_date=today + timedelta(days=3),
                end_date=today + timedelta(days=4),
                remarks="Family commitment",
                status=LeaveStatus.PENDING,
            ),
        ])
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
