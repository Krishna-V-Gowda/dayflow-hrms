from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..auth import get_current_user, require_hr
from ..db import get_db
from ..models import Employee, User
from ..schemas import EmployeeOut, EmployeeSelfUpdate, EmployeeUpdate
from ..services import audit

router = APIRouter(prefix="/api/employees", tags=["employees"])


@router.get("/me", response_model=EmployeeOut)
def my_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Employee).filter(Employee.user_id == user.id).first()


@router.patch("/me", response_model=EmployeeOut)
def update_my_profile(payload: EmployeeSelfUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    employee = user.employee
    employee.phone = payload.phone
    employee.address = payload.address
    audit(db, user, "profile_updated", "employee", employee.id, payload.model_dump())
    db.commit()
    db.refresh(employee)
    return employee


@router.get("", response_model=list[EmployeeOut])
def all_employees(_: User = Depends(require_hr), db: Session = Depends(get_db)):
    return db.query(Employee).order_by(Employee.full_name).all()


@router.patch("/{employee_id}", response_model=EmployeeOut)
def update_employee(employee_id: int, payload: EmployeeUpdate, user: User = Depends(require_hr), db: Session = Depends(get_db)):
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(404, "Employee not found")
    for field, value in payload.model_dump().items():
        setattr(employee, field, value)
    audit(db, user, "employee_updated", "employee", employee.id, payload.model_dump())
    db.commit()
    db.refresh(employee)
    return employee
