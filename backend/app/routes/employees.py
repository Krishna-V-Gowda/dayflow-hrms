from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..auth import get_current_user, require_hr
from ..db import get_db
from ..models import Employee, User
from ..schemas import EmployeeOut

router = APIRouter(prefix="/api/employees", tags=["employees"])


@router.get("/me", response_model=EmployeeOut)
def my_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Employee).filter(Employee.user_id == user.id).first()


@router.get("", response_model=list[EmployeeOut])
def all_employees(_: User = Depends(require_hr), db: Session = Depends(get_db)):
    return db.query(Employee).order_by(Employee.full_name).all()
