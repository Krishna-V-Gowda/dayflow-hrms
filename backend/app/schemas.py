from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field
from .models import LeaveStatus


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


class UserLogin(BaseModel):
    email: str
    password: str


class EmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_code: str
    full_name: str
    email: str
    department: str
    job_title: str
    salary: float
    phone: str
    address: str


class LeaveCreate(BaseModel):
    leave_type: str = Field(min_length=2, max_length=30)
    start_date: date
    end_date: date
    remarks: str = Field(default="", max_length=500)


class LeaveOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_id: int
    employee_name: str
    leave_type: str
    start_date: date
    end_date: date
    remarks: str
    status: LeaveStatus
    reviewer_comment: str
    created_at: datetime


class LeaveDecision(BaseModel):
    status: LeaveStatus
    reviewer_comment: str = Field(default="", max_length=500)
